import { z } from 'zod';

const STORAGE_KEY = 'riftbrand.settings';
export const SETTINGS_VERSION = 9;

const unit = z.number().min(0).max(1);

const buttonOverride = z.object({
  x: unit,
  y: unit,
  scale: z.number().min(0.6).max(1.8),
});
const layoutProfile = z.partialRecord(
  // v4 (M3.2): 'spell' joined; older layouts simply keep the default spell position.
  z.enum(['attack', 'dash', 'special', 'cast', 'ultimate', 'spell', 'pause']),
  buttonOverride,
);

/**
 * Player settings (GDD §13). Every field has a default via `.catch`, so a missing, corrupt or
 * older save never breaks loading: v1 → … → v9 is exactly that (new fields get their defaults).
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
  // v3 (M3.1): status icons above enemies can be hidden for a calmer screen.
  statusIcons: z.boolean().catch(true),
  // v5: the aura's pulse ring around Vesper is opt-in; the aura itself keeps working.
  auraRing: z.boolean().catch(false),
  // v6: language picked in the settings; 'auto' follows the browser.
  language: z.enum(['auto', 'en', 'de']).catch('auto'),
  // v7 (M4.2): classic glowing shapes instead of animated bodies, for weak devices.
  simpleGraphics: z.boolean().catch(false),
  // v8 (M4.5) had `artStyle` for the style prototype; v9 dropped it with the PO's pick (the
  // picture book), and the parser simply ignores the old field.
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
