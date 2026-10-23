import { z } from 'zod';

const STORAGE_KEY = 'riftbrand.settings';
export const SETTINGS_VERSION = 2;

const unit = z.number().min(0).max(1);

const buttonOverride = z.object({
  x: unit,
  y: unit,
  scale: z.number().min(0.6).max(1.8),
});
const layoutProfile = z.partialRecord(
  z.enum(['attack', 'dash', 'special', 'cast', 'ultimate', 'pause']),
  buttonOverride,
);

/**
 * Player settings (GDD §13). Every field has a default via `.catch`, so a missing, corrupt or
 * older save never breaks loading: v1 → v2 is exactly that (new fields get their defaults).
 * New fields → bump SETTINGS_VERSION and extend migrate.
 */
const settingsSchema = z.object({
  version: z.literal(SETTINGS_VERSION).catch(SETTINGS_VERSION),
  masterVolume: unit.catch(0.8),
  sfxVolume: unit.catch(1),
  musicVolume: unit.catch(0.7),
  shake: unit.catch(1),
  flashes: unit.catch(1),
  vibration: unit.catch(1),
  damageNumbers: z.boolean().catch(true),
  quality: z.enum(['high', 'low']).catch('high'),
  // v2 (M2.7): touch layout editor. Older saves simply get the default layout.
  touchLayout: z
    .object({ portrait: layoutProfile, landscape: layoutProfile })
    .catch({ portrait: {}, landscape: {} }),
  /** Idle opacity of the touch buttons. */
  touchOpacity: z.number().min(0.1).max(1).catch(0.35),
});

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze(settingsSchema.parse({}));

/** Accepts anything (parsed JSON, older versions) and returns valid current settings. */
export function migrateSettings(raw: unknown): Settings {
  const input = typeof raw === 'object' && raw !== null ? raw : {};
  return settingsSchema.parse(input);
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export function loadSettings(store: KeyValueStore | null): Settings {
  try {
    const raw = store?.getItem(STORAGE_KEY);
    return migrateSettings(raw ? JSON.parse(raw) : {});
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(store: KeyValueStore | null, settings: Settings): void {
  try {
    store?.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage can be full or blocked (private mode); settings then last for the session only.
  }
}

/** localStorage when available; settings are tiny, so IndexedDB is not needed here. */
export function browserStore(): KeyValueStore | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}
