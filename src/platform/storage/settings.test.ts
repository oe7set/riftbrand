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
