import { describe, expect, it } from 'vitest';
import { appendRunLog, loadRunLog, RUN_LOG_LIMIT, type RunLogEntry } from './run-log';
import type { KeyValueStore } from './settings';

function memoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
  };
}

const entry = (seed: number): RunLogEntry => ({
  date: '2026-10-23T10:00:00Z',
  version: 'test',
  seed,
  result: 'lost',
  roomsCleared: 2,
  kills: 10,
  timeSec: 90,
  killedBy: 'slag',
  dominant: null,
  boons: [],
  relics: [],
  evolutions: [],
  tree: {},
  rooms: [],
  damageBySource: { slag: 30 },
});

describe('run log', () => {
  it('keeps only the most recent runs', () => {
    const store = memoryStore();
    for (let i = 0; i < RUN_LOG_LIMIT + 5; i++) appendRunLog(store, entry(i));
    const log = loadRunLog(store);
    expect(log).toHaveLength(RUN_LOG_LIMIT);
    expect(log[0]?.seed).toBe(5);
    expect(log.at(-1)?.seed).toBe(RUN_LOG_LIMIT + 4);
  });

  it('survives garbage', () => {
    const store = memoryStore();
    store.setItem('riftbrand.runlog', '{nope');
    expect(loadRunLog(store)).toEqual([]);
  });
});
