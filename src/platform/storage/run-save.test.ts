import { describe, expect, it } from 'vitest';
import { availableNodes, createRun, enterNode } from '../../sim/run/run-state';
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
