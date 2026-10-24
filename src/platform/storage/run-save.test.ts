import { describe, expect, it } from 'vitest';
import { availableNodes, createRun, enterNode, startSpellSlots } from '../../sim/run/run-state';
import { clearRun, loadRun, migrateRunSave, RUN_SAVE_VERSION, saveRun } from './run-save';

function memoryStore() {
  const data: Record<string, string> = {};
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
    removeItem: (k: string) => {
      delete data[k];
    },
  };
}

describe('run save', () => {
  it('round-trips a run in progress', () => {
    const store = memoryStore();
    const run = createRun(123);
    const first = availableNodes(run)[0];
    if (!first) throw new Error('no node');
    enterNode(run, first.id);
    run.hp = 55;
    saveRun(store, run);
    expect(loadRun(store)).toEqual(run);
  });

  it('rejects garbage, other versions and finished runs', () => {
    expect(migrateRunSave(null)).toBeNull();
    expect(migrateRunSave({ version: 999, run: {} })).toBeNull();
    expect(migrateRunSave({ version: RUN_SAVE_VERSION, run: { seed: 'x' } })).toBeNull();
    const won = { ...createRun(1), status: 'won' as const };
    expect(migrateRunSave({ version: RUN_SAVE_VERSION, run: won })).toBeNull();
  });

  it('migrates v1 saves (no boons yet) to the current version', () => {
    const {
      boons: _b,
      relics: _r,
      shards: _s,
      shopBought: _sb,
      maxHpBonus: _m,
      ...v1Run
    } = createRun(42);
    const migrated = migrateRunSave({ version: 1, run: v1Run });
    expect(migrated?.boons).toEqual([]);
    expect(migrated?.relics).toEqual([]);
    expect(migrated?.seed).toBe(42);
  });

  it('migrates v2 saves (no relics or shards yet)', () => {
    const { relics: _r, shards: _s, shopBought: _sb, maxHpBonus: _m, ...v2Run } = createRun(7);
    const migrated = migrateRunSave({
      version: 2,
      run: { ...v2Run, boons: [{ id: 'shatter', rarity: 'rare' }] },
    });
    expect(migrated?.boons).toHaveLength(1);
    expect(migrated?.shards).toBe(0);
    expect(migrated?.shopBought).toEqual([]);
  });

  it('migrates v3 saves (no evolutions or ultimate meter yet)', () => {
    const { evolutions: _e, ultCharge: _u, ...v3Run } = createRun(9);
    const migrated = migrateRunSave({ version: 3, run: { ...v3Run, shards: 40 } });
    expect(migrated?.shards).toBe(40);
    expect(migrated?.evolutions).toEqual([]);
    expect(migrated?.ultCharge).toBe(0);
  });

  it('migrates v4 saves (no meta progression yet)', () => {
    const {
      meta: _m,
      lockedRelics: _l,
      lastSparks: _ls,
      rerolls: _r,
      rerollSalt: _rs,
      clearedCombat: _cc,
      clearedElite: _ce,
      clearedBoss: _cb,
      reachedBoss: _rb,
      ...v4Run
    } = createRun(12);
    const migrated = migrateRunSave({ version: 4, run: { ...v4Run, roomsCleared: 3 } });
    expect(migrated?.meta.maxHp).toBe(0);
    expect(migrated?.lockedRelics).toEqual([]);
    expect(migrated?.clearedCombat).toBe(3);
    expect(migrated?.reachedBoss).toBe(false);
  });

  it('migrates v5 saves (no spells yet) to the start spells', () => {
    const { spells: _s, cast: _c, ...v5Run } = createRun(14);
    const migrated = migrateRunSave({ version: 5, run: { ...v5Run, shards: 12 } });
    expect(migrated?.shards).toBe(12);
    expect(migrated?.spells).toEqual(startSpellSlots());
  });

  it('migrates v6 saves (no upgrade branches yet)', () => {
    const { cast: _c, ...v6Run } = createRun(15);
    const spells = { active: { id: 'meteor', level: 2 }, aura: null };
    const migrated = migrateRunSave({ version: 6, run: { ...v6Run, spells } });
    expect(migrated?.spells.active).toEqual({ id: 'meteor', level: 2, branches: [] });
    expect(migrated?.spells.aura).toBeNull();
    expect(migrated?.cast).toEqual({ level: 1, branches: [] });
  });

  it('migrates v7 saves unchanged (duel nodes are new)', () => {
    const run = createRun(16);
    const migrated = migrateRunSave({ version: 7, run });
    expect(migrated?.map.nodes.length).toBe(run.map.nodes.length);
  });

  it('migrates v8 saves: a run in progress continues in the Ember Wastes', () => {
    const { worldId: _w, duelsWon: _d, ...rest } = createRun(17);
    const v8Run = { ...rest, biomeId: 'ember_wastes', currentNodeId: 0, visited: [0] };
    const migrated = migrateRunSave({ version: 8, run: v8Run });
    expect(migrated?.worldId).toBe('ember_wastes');
    expect(migrated?.duelsWon).toEqual([]);
    expect(migrated?.currentNodeId).toBe(0);
    expect(migrated && 'biomeId' in migrated).toBe(false);
  });

  it('clears the save', () => {
    const store = memoryStore();
    saveRun(store, createRun(5));
    clearRun(store);
    expect(loadRun(store)).toBeNull();
  });

  it('survives corrupt JSON', () => {
    const store = memoryStore();
    store.setItem('riftbrand.run', '{nope');
    expect(loadRun(store)).toBeNull();
  });
});
