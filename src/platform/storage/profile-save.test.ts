import { describe, expect, it } from 'vitest';
import { buyRank, createProfile } from '../../sim/meta/profile';
import {
  exportProfile,
  importProfile,
  loadProfile,
  memoryProfileStore,
  migrateProfile,
  saveProfile,
  serializeProfile,
} from './profile-save';

describe('profile save', () => {
  it('round-trips and keeps the previous state as backup', async () => {
    const store = memoryProfileStore();
    const first = createProfile();
    first.ember = 50;
    const raw1 = await saveProfile(store, first, null);
    const second = { ...first, ember: 80 };
    await saveProfile(store, second, raw1);
    expect((await loadProfile(store)).profile.ember).toBe(80);
    expect(migrateProfile(JSON.parse((await store.read('profile.backup')) ?? ''))?.ember).toBe(50);
  });

  it('falls back to the backup when the main slot is corrupt, then to a fresh profile', async () => {
    const good = createProfile();
    good.runs = 7;
    const store = memoryProfileStore({
      profile: '{broken',
      'profile.backup': serializeProfile(good),
    });
    expect((await loadProfile(store)).profile.runs).toBe(7);
    const empty = memoryProfileStore({ profile: 'nope' });
    expect((await loadProfile(empty)).profile).toEqual(createProfile());
  });

  it('rejects other versions and garbage', () => {
    expect(migrateProfile({ version: 99, profile: createProfile() })).toBeNull();
    expect(migrateProfile('x')).toBeNull();
  });

  it('migrates a v1 profile: keeps progress, adds the start spells (M3.6)', () => {
    const { spellsUnlocked, spellsDiscovered, loadout, ...v1 } = createProfile();
    v1.ember = 123;
    v1.runs = 4;
    const p = migrateProfile({ version: 1, profile: v1 });
    expect(p?.ember).toBe(123);
    expect(p?.runs).toBe(4);
    expect(p?.spellsUnlocked).toEqual(spellsUnlocked);
    expect(p?.spellsDiscovered).toEqual(spellsDiscovered);
    expect(p?.loadout).toEqual(loadout);
  });

  it('migrates a v2 profile: earlier runs and wins count for the Ember Wastes (M5.2)', () => {
    const { worlds: _w, ...v2 } = createProfile();
    v2.runs = 5;
    v2.wins = 2;
    const lastRun = {
      result: 'won',
      roomsCleared: 9,
      kills: 80,
      timeSec: 500,
      killedBy: null,
      dominant: null,
      reachedBoss: true,
      ember: 40,
      dust: 3,
    };
    const p = migrateProfile({ version: 2, profile: { ...v2, lastRun } });
    expect(p?.worlds.ember_wastes).toEqual({
      runs: 5,
      bossKills: 2,
      bestTimeSec: null,
      duelsWon: [],
    });
    expect(p?.lastRun?.worldId).toBe('ember_wastes');
    expect(p?.lastRun?.unlockedWorlds).toEqual([]);
  });

  it('migrates a fresh v2 profile without world entries', () => {
    const { worlds: _w, ...v2 } = createProfile();
    expect(migrateProfile({ version: 2, profile: v2 })?.worlds).toEqual({});
  });
});

describe('export and import', () => {
  it('a code round-trips the full profile', async () => {
    const p = createProfile();
    p.ember = 500;
    buyRank(p, 'vitality');
    p.seenDialogue.push('maren_intro');
    const code = await exportProfile(p);
    expect(code.startsWith('RB1.')).toBe(true);
    expect(await importProfile(code)).toEqual(p);
  });

  it('rejects tampered, truncated or foreign codes', async () => {
    const code = await exportProfile(createProfile());
    const [tag, sum, data] = code.split('.');
    expect(await importProfile(`${tag}.00000000.${data}`)).toBeNull();
    expect(await importProfile(`${tag}.${sum}.${data?.slice(0, 10)}`)).toBeNull();
    expect(await importProfile('hello')).toBeNull();
    expect(await importProfile('')).toBeNull();
  });
});
