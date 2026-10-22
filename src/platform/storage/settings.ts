import { z } from 'zod';

const STORAGE_KEY = 'riftbrand.settings';
export const SETTINGS_VERSION = 1;

const unit = z.number().min(0).max(1);

/**
 * Player settings (GDD §13). Every field has a default via `.catch`, so a missing, corrupt or
 * older save never breaks loading. New fields → bump SETTINGS_VERSION and extend migrate.
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
