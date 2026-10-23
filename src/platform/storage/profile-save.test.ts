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
