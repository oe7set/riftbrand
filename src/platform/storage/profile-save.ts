import { z } from 'zod';
import { FIRST_WORLD_ID } from '../../content/worlds';
import { createProfile, type Profile } from '../../sim/meta/profile';

export const PROFILE_VERSION = 5;
const KEY = 'profile';
const BACKUP_KEY = 'profile.backup';

const lastRunSchema = z.object({
  result: z.enum(['won', 'lost']),
  roomsCleared: z.number().int().min(0),
  kills: z.number().int().min(0),
  timeSec: z.number().int().min(0),
  killedBy: z.string().nullable(),
  dominant: z.enum(['ignara', 'vaelis']).nullable(),
  reachedBoss: z.boolean(),
  ember: z.number().int().min(0),
  dust: z.number().int().min(0),
  worldId: z.string(),
  unlockedWorlds: z.array(z.string()),
  materials: z.record(z.string(), z.number().int().min(0)),
});

const worldProgressSchema = z.object({
  runs: z.number().int().min(0),
  bossKills: z.number().int().min(0),
  bestTimeSec: z.number().int().min(0).nullable(),
  duelsWon: z.array(z.string()),
});

const profileSchema = z.object({
  ember: z.number().int().min(0),
  dust: z.number().int().min(0),
  tree: z.record(z.string(), z.number().int().min(0)),
  relicsUnlocked: z.array(z.string()),
  runs: z.number().int().min(0),
  wins: z.number().int().min(0),
  bestRooms: z.number().int().min(0),
  seenDialogue: z.array(z.string()),
  flags: z.array(z.string()),
  lastRun: lastRunSchema.nullable(),
  spellsUnlocked: z.array(z.string()),
  spellsDiscovered: z.array(z.string()),
  loadout: z.object({ active: z.string(), aura: z.string() }),
  worlds: z.record(z.string(), worldProgressSchema),
  materials: z.record(z.string(), z.number().int().min(0)),
  buildings: z.record(z.string(), z.number().int().min(0).max(2)),
  decorations: z.array(z.string()),
  armor: z.record(z.string(), z.number().int().min(1).max(3)),
  equipped: z.object({
    head: z.string().optional(),
    chest: z.string().optional(),
    hands: z.string().optional(),
    feet: z.string().optional(),
  }),
});

const saveSchema = z.object({ version: z.literal(PROFILE_VERSION), profile: profileSchema });

/** v1 → v2 (M3.6): spells at Sel's rune tower; old profiles own the start spells. */
function migrate1to2(raw: { version: number; profile?: Record<string, unknown> }): unknown {
  const fresh = createProfile();
  return {
    ...raw,
    version: 2,
    profile: {
      ...raw.profile,
      spellsUnlocked: fresh.spellsUnlocked,
      spellsDiscovered: [],
      loadout: fresh.loadout,
    },
  };
}

/**
 * v2 → v3 (M5.2): world progress. Every earlier run was in the Ember Wastes, and a won run
 * means its boss fell; old won runs didn't record their time, so there is no best time yet.
 */
function migrate2to3(raw: { version: number; profile?: Record<string, unknown> }): unknown {
  const p = raw.profile ?? {};
  const runs = typeof p.runs === 'number' ? p.runs : 0;
  const wins = typeof p.wins === 'number' ? p.wins : 0;
  const last = p.lastRun as Record<string, unknown> | null | undefined;
  return {
    ...raw,
    version: 3,
    profile: {
      ...p,
      lastRun: last ? { ...last, worldId: FIRST_WORLD_ID, unlockedWorlds: [] } : (last ?? null),
      worlds:
        runs > 0
          ? { [FIRST_WORLD_ID]: { runs, bossKills: wins, bestTimeSec: null, duelsWon: [] } }
          : {},
    },
  };
}

/** v3 → v4 (M5.3): materials, building levels and decorations; everything starts empty. */
function migrate3to4(raw: { version: number; profile?: Record<string, unknown> }): unknown {
  const p = raw.profile ?? {};
  const last = p.lastRun as Record<string, unknown> | null | undefined;
  return {
    ...raw,
    version: 4,
    profile: {
      ...p,
      lastRun: last ? { ...last, materials: {} } : (last ?? null),
      materials: {},
      buildings: {},
      decorations: [],
    },
  };
}

/** v4 → v5 (M5.4): armour at Toll's forge; nobody owns or wears any yet. */
function migrate4to5(raw: { version: number; profile?: Record<string, unknown> }): unknown {
  return { ...raw, version: 5, profile: { ...raw.profile, armor: {}, equipped: {} } };
}

/**
 * Upgrades older profile saves step by step (vN → vN+1). Broken data yields null so the caller
 * can fall back to the backup slot: losing progress is the worst bug there is.
 */
export function migrateProfile(raw: unknown): Profile | null {
  if (typeof raw !== 'object' || raw === null) return null;
  let data = raw as { version?: unknown; profile?: Record<string, unknown> };
  if (data.version === 1) data = migrate1to2(data as { version: number }) as typeof data;
  if (data.version === 2) data = migrate2to3(data as { version: number }) as typeof data;
  if (data.version === 3) data = migrate3to4(data as { version: number }) as typeof data;
  if (data.version === 4) data = migrate4to5(data as { version: number }) as typeof data;
  const parsed = saveSchema.safeParse(data);
  return parsed.success ? parsed.data.profile : null;
}

export function serializeProfile(profile: Profile): string {
  return JSON.stringify({ version: PROFILE_VERSION, profile });
}

function parse(json: string | null): Profile | null {
  if (!json) return null;
  try {
    return migrateProfile(JSON.parse(json));
  } catch {
    return null;
  }
}

/** Async key-value storage; IndexedDB in the browser, memory in tests. */
export interface ProfileStore {
  read(key: string): Promise<string | null>;
  /** Writes all entries at once (one transaction where the backend supports it). */
  write(entries: Record<string, string>): Promise<void>;
}

export function memoryProfileStore(initial: Record<string, string> = {}): ProfileStore {
  const data = new Map(Object.entries(initial));
  return {
    read: async (key) => data.get(key) ?? null,
    write: async (entries) => {
      for (const [k, v] of Object.entries(entries)) data.set(k, v);
    },
  };
}

/**
 * Loads the profile: the main slot, else the last good backup, else a fresh profile. Also
 * returns the raw JSON it came from, which becomes the backup on the next save.
 */
export async function loadProfile(
  store: ProfileStore | null,
): Promise<{ profile: Profile; raw: string | null }> {
  try {
    const main = await store?.read(KEY);
    const fromMain = parse(main ?? null);
    if (fromMain && main) return { profile: fromMain, raw: main };
    const backup = await store?.read(BACKUP_KEY);
    const fromBackup = parse(backup ?? null);
    if (fromBackup && backup) return { profile: fromBackup, raw: backup };
  } catch {
    // Unreadable storage: play on with a fresh profile rather than not at all.
  }
  return { profile: createProfile(), raw: null };
}

/**
 * Saves the profile and keeps the previous good state as backup (TECH_DESIGN §11). Returns the
 * JSON written, to be passed back as `previous` next time.
 */
export async function saveProfile(
  store: ProfileStore | null,
  profile: Profile,
  previous: string | null,
): Promise<string> {
  const json = serializeProfile(profile);
  try {
    await store?.write(previous ? { [KEY]: json, [BACKUP_KEY]: previous } : { [KEY]: json });
  } catch {
    // Storage full or blocked: progress lives on in memory for this session.
  }
  return json;
}

// ── Export / import (TECH_DESIGN §11) ─────────────────────────────────────

/** FNV-1a over the JSON text: catches typos and truncated pastes, not tampering. */
function checksum(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h.toString(16).padStart(8, '0');
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i] as number);
  return btoa(bin);
}

function fromBase64(text: string): Uint8Array {
  const bin = atob(text);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipe(bytes: Uint8Array, stream: GenericTransformStream): Promise<Uint8Array> {
  const blob = new Blob([bytes as BlobPart]);
  const out = await new Response(blob.stream().pipeThrough(stream)).arrayBuffer();
  return new Uint8Array(out);
}

const hasCompression = () =>
  typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

/**
 * A copyable save code: `RB1.<checksum>.<base64 deflate JSON>`, or `RB0.` with plain base64
 * where compression streams are missing.
 */
export async function exportProfile(profile: Profile): Promise<string> {
  const json = serializeProfile(profile);
  const bytes = new TextEncoder().encode(json);
  if (hasCompression()) {
    const packed = await pipe(bytes, new CompressionStream('deflate'));
    return `RB1.${checksum(json)}.${toBase64(packed)}`;
  }
  return `RB0.${checksum(json)}.${toBase64(bytes)}`;
}

/** Decodes a save code; null for anything malformed, corrupted or of an unknown version. */
export async function importProfile(code: string): Promise<Profile | null> {
  try {
    const [tag, sum, data] = code.trim().split('.');
    if (!sum || !data || (tag !== 'RB1' && tag !== 'RB0')) return null;
    let bytes = fromBase64(data);
    if (tag === 'RB1') {
      if (!hasCompression()) return null;
      bytes = await pipe(bytes, new DecompressionStream('deflate'));
    }
    const json = new TextDecoder().decode(bytes);
    if (checksum(json) !== sum) return null;
    return migrateProfile(JSON.parse(json));
  } catch {
    return null;
  }
}
