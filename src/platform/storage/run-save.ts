import { z } from 'zod';
import { type RunState, startSpellSlots } from '../../sim/run/run-state';
import type { KeyValueStore } from './settings';

const STORAGE_KEY = 'riftbrand.run';
export const RUN_SAVE_VERSION = 8;

const mapNodeSchema = z.object({
  id: z.number().int().min(0),
  layer: z.number().int().min(0),
  x: z.number(),
  type: z.enum(['combat', 'elite', 'horde', 'rest', 'boss', 'altar', 'shop', 'event', 'duel']),
  next: z.array(z.number().int().min(0)),
});

const upgradeStateSchema = z.object({
  level: z.number().int().min(1).max(5),
  branches: z.array(z.number().int().min(0).max(1)),
});
const ownedSpellSchema = upgradeStateSchema.extend({ id: z.string() });

const runSchema = z.object({
  seed: z.number().int().min(0),
  biomeId: z.string(),
  map: z.object({ nodes: z.array(mapNodeSchema), layers: z.array(z.array(z.number().int())) }),
  currentNodeId: z.number().int().min(-1),
  visited: z.array(z.number().int()),
  status: z.enum(['map', 'room', 'won', 'lost']),
  hp: z.number().min(0),
  maxHp: z.number().positive(),
  kills: z.number().int().min(0),
  roomsCleared: z.number().int().min(0),
  playTimeSec: z.number().min(0),
  boons: z.array(
    z.object({
      id: z.string(),
      rarity: z.enum(['common', 'rare', 'epic', 'heroic']),
      level: z.number().int().min(1).optional(),
    }),
  ),
  evolutions: z.array(z.string()),
  ultCharge: z.number().min(0).max(1),
  meta: z.object({
    maxHp: z.number(),
    allDamage: z.number(),
    staminaRegen: z.number(),
    roomHeal: z.number(),
    startShards: z.number(),
    lastSparks: z.number().int().min(0),
    lastSparkHeal: z.number().min(0).max(1),
    rerolls: z.number().int().min(0),
    staminaBonus: z.number().int().min(0),
  }),
  lockedRelics: z.array(z.string()),
  lastSparks: z.number().int().min(0),
  rerolls: z.number().int().min(0),
  rerollSalt: z.number().int().min(0),
  clearedCombat: z.number().int().min(0),
  clearedElite: z.number().int().min(0),
  clearedBoss: z.number().int().min(0),
  reachedBoss: z.boolean(),
  relics: z.array(z.object({ id: z.string(), stacks: z.number().int().min(1) })),
  shards: z.number().int().min(0),
  shopBought: z.array(z.number().int().min(0)),
  maxHpBonus: z.number().int(),
  spells: z.object({ active: ownedSpellSchema.nullable(), aura: ownedSpellSchema.nullable() }),
  cast: upgradeStateSchema,
});

const saveSchema = z.object({
  version: z.literal(RUN_SAVE_VERSION),
  run: runSchema,
});

/**
 * Upgrades older saves step by step (vN → vN+1). Unknown or broken data yields null:
 * a lost mid-run save is annoying, a crash on load is worse.
 */
/** v1 → v2: boons were added (M2.2). Old runs simply have none yet. */
function migrate1to2(raw: { version: number; run?: Record<string, unknown> }): unknown {
  return { ...raw, version: 2, run: { ...raw.run, boons: [] } };
}

/** v2 → v3: relics, shards and shop purchases were added (M2.3). */
function migrate2to3(raw: { version: number; run?: Record<string, unknown> }): unknown {
  return {
    ...raw,
    version: 3,
    run: { ...raw.run, relics: [], shards: 0, shopBought: [], maxHpBonus: 0 },
  };
}

/** v3 → v4: weapon evolutions and the carried ultimate meter were added (M2.4). */
function migrate3to4(raw: { version: number; run?: Record<string, unknown> }): unknown {
  return { ...raw, version: 4, run: { ...raw.run, evolutions: [], ultCharge: 0 } };
}

/**
 * v4 → v5: meta progression (M2.6). Old runs started without Ember Tree bonuses and with every
 * relic in the pool; room kinds weren't tracked, so all cleared rooms count as normal fights.
 */
function migrate4to5(raw: { version: number; run?: Record<string, unknown> }): unknown {
  const run = raw.run ?? {};
  const cleared = typeof run.roomsCleared === 'number' ? run.roomsCleared : 0;
  return {
    ...raw,
    version: 5,
    run: {
      ...run,
      meta: {
        maxHp: 0,
        allDamage: 0,
        staminaRegen: 0,
        roomHeal: 0,
        startShards: 0,
        lastSparks: 0,
        lastSparkHeal: 0,
        rerolls: 0,
        staminaBonus: 0,
      },
      lockedRelics: [],
      lastSparks: 0,
      rerolls: 0,
      rerollSalt: 0,
      clearedCombat: cleared,
      clearedElite: 0,
      clearedBoss: 0,
      reachedBoss: false,
    },
  };
}

/** v5 → v6: spell slots (M3.2). Runs in progress get the start spells. */
function migrate5to6(raw: { version: number; run?: Record<string, unknown> }): unknown {
  return { ...raw, version: 6, run: { ...raw.run, spells: startSpellSlots() } };
}

/** v6 → v7: upgrade branches for spells and the rift shot (M3.4). */
function migrate6to7(raw: { version: number; run?: Record<string, unknown> }): unknown {
  const run = raw.run ?? {};
  const spells = (run.spells ?? {}) as Record<string, Record<string, unknown> | null>;
  const withBranches = (slot: Record<string, unknown> | null | undefined) =>
    slot ? { ...slot, branches: [] } : null;
  return {
    ...raw,
    version: 7,
    run: {
      ...run,
      spells: { active: withBranches(spells.active), aura: withBranches(spells.aura) },
      cast: { level: 1, branches: [] },
    },
  };
}

/** v7 → v8: duel nodes may appear in maps (M3.5); saved maps simply have none. */
function migrate7to8(raw: { version: number; run?: Record<string, unknown> }): unknown {
  return { ...raw, version: 8 };
}

export function migrateRunSave(raw: unknown): RunState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  let data = raw as { version?: unknown; run?: Record<string, unknown> };
  if (data.version === 1) data = migrate1to2(data as { version: number }) as typeof data;
  if (data.version === 2) data = migrate2to3(data as { version: number }) as typeof data;
  if (data.version === 3) data = migrate3to4(data as { version: number }) as typeof data;
  if (data.version === 4) data = migrate4to5(data as { version: number }) as typeof data;
  if (data.version === 5) data = migrate5to6(data as { version: number }) as typeof data;
  if (data.version === 6) data = migrate6to7(data as { version: number }) as typeof data;
  if (data.version === 7) data = migrate7to8(data as { version: number }) as typeof data;
  if (data.version !== RUN_SAVE_VERSION) return null;
  raw = data;
  const parsed = saveSchema.safeParse(raw);
  if (!parsed.success) return null;
  const run = parsed.data.run;
  // A run that ended has nothing to continue.
  if (run.status === 'won' || run.status === 'lost') return null;
  // Saved mid-room means the room restarts from its entry state.
  return run;
}

export function loadRun(store: KeyValueStore | null): RunState | null {
  try {
    const raw = store?.getItem(STORAGE_KEY);
    return raw ? migrateRunSave(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveRun(store: KeyValueStore | null, run: RunState): void {
  try {
    store?.setItem(STORAGE_KEY, JSON.stringify({ version: RUN_SAVE_VERSION, run }));
  } catch {
    // Storage full or blocked: the run continues, it just can't be resumed after a reload.
  }
}

export function clearRun(store: KeyValueStore | null): void {
  try {
    store?.removeItem?.(STORAGE_KEY);
  } catch {
    // Ignore: an orphaned save is filtered out on load once its run has ended.
  }
}
