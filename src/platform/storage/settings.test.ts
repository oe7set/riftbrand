import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, loadSettings, migrateSettings, saveSettings } from './settings';

function memoryStore(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
}

describe('settings', () => {
  it('falls back to defaults for garbage', () => {
    expect(migrateSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(migrateSettings('nope')).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(memoryStore({ 'riftbrand.settings': '{broken' }))).toEqual(
      DEFAULT_SETTINGS,
    );
  });

  it('keeps valid fields and repairs invalid ones', () => {
    const s = migrateSettings({
      shake: 0.25,
      vibration: 7,
      quality: 'ultra',
      damageNumbers: false,
    });
    expect(s.shake).toBe(0.25);
    expect(s.vibration).toBe(DEFAULT_SETTINGS.vibration);
    expect(s.quality).toBe(DEFAULT_SETTINGS.quality);
    expect(s.damageNumbers).toBe(false);
  });

  it('migrates v1 settings: keeps values, adds the default touch layout', () => {
    const s = migrateSettings({ version: 1, masterVolume: 0.4, quality: 'low' });
    expect(s.version).toBe(3);
    expect(s.masterVolume).toBe(0.4);
    expect(s.quality).toBe('low');
    expect(s.touchLayout).toEqual({ portrait: {}, landscape: {} });
    expect(s.touchOpacity).toBe(0.35);
  });

  it('migrates v2 settings: keeps the touch layout, shows status icons by default', () => {
    const layout = { portrait: {}, landscape: { dash: { x: 0.7, y: 0.8, scale: 1 } } };
    const s = migrateSettings({ version: 2, touchLayout: layout, touchOpacity: 0.5 });
    expect(s.version).toBe(3);
    expect(s.touchLayout).toEqual(layout);
    expect(s.touchOpacity).toBe(0.5);
    expect(s.statusIcons).toBe(true);
  });

  it('keeps a valid touch layout and drops a broken one', () => {
    const layout = { portrait: { attack: { x: 0.8, y: 0.9, scale: 1.2 } }, landscape: {} };
    expect(migrateSettings({ touchLayout: layout }).touchLayout).toEqual(layout);
    const broken = migrateSettings({ touchLayout: { portrait: { attack: { x: 5 } } } });
    expect(broken.touchLayout).toEqual({ portrait: {}, landscape: {} });
  });

  it('round-trips through storage', () => {
    const store = memoryStore();
    const s = { ...DEFAULT_SETTINGS, masterVolume: 0.3 };
    saveSettings(store, s);
    expect(loadSettings(store)).toEqual(s);
  });

  it('survives a throwing store', () => {
    const store = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadSettings(store)).toEqual(DEFAULT_SETTINGS);
    expect(() => saveSettings(store, DEFAULT_SETTINGS)).not.toThrow();
  });
});
