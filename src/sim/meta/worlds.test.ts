import { describe, expect, it } from 'vitest';
import type { WorldDef } from '../../content/schema';
import { WORLDS, worldById } from '../../content/worlds';
import { availableNodes, completeRoom, createRun, enterNode } from '../run/run-state';
import { createProfile } from './profile';
import {
  defaultWorld,
  isWorldPlayable,
  isWorldUnlocked,
  recordWorldRun,
  worldProgress,
} from './worlds';

const world = (id: string) => worldById(id) as WorldDef;

describe('world unlocks (ROADMAP M5.2)', () => {
  it('a fresh profile has only the first world open', () => {
    const p = createProfile();
    const open = WORLDS.filter((w) => isWorldUnlocked(p, w)).map((w) => w.id);
    expect(open).toEqual(['ember_wastes']);
    expect(isWorldPlayable(p, world('ember_wastes'))).toBe(true);
  });

  it('a lost run records progress but opens nothing', () => {
    const p = createProfile();
    const run = createRun(3);
    run.playTimeSec = 300;
    expect(recordWorldRun(p, run, 'lost')).toEqual([]);
    expect(worldProgress(p, 'ember_wastes')).toEqual({
      runs: 1,
      bossKills: 0,
      bestTimeSec: null,
      duelsWon: [],
    });
  });

  it('the first boss kill opens the next world, once', () => {
    const p = createProfile();
    const run = createRun(4);
    run.playTimeSec = 600.4;
    expect(recordWorldRun(p, run, 'won')).toEqual(['glass_sea']);
    expect(isWorldUnlocked(p, world('glass_sea'))).toBe(true);
    // Not built yet: on the map, but not enterable.
    expect(isWorldPlayable(p, world('glass_sea'))).toBe(false);
    expect(isWorldUnlocked(p, world('storm_citadel'))).toBe(false);
    run.playTimeSec = 480;
    expect(recordWorldRun(p, run, 'won')).toEqual([]);
    expect(worldProgress(p, 'ember_wastes').bestTimeSec).toBe(480);
    run.playTimeSec = 700;
    recordWorldRun(p, run, 'won');
    expect(worldProgress(p, 'ember_wastes')).toMatchObject({
      runs: 3,
      bossKills: 3,
      bestTimeSec: 480,
    });
  });

  it('mini-bosses accumulate without duplicates', () => {
    const p = createProfile();
    const run = createRun(5);
    run.duelsWon = ['ember_duelist'];
    recordWorldRun(p, run, 'lost');
    run.duelsWon = ['ember_duelist', 'twin_spark'];
    recordWorldRun(p, run, 'lost');
    expect(worldProgress(p, 'ember_wastes').duelsWon).toEqual(['ember_duelist', 'twin_spark']);
  });

  it('the default world falls back when the choice is not playable', () => {
    const p = createProfile();
    expect(defaultWorld(p, 'glass_sea').id).toBe('ember_wastes');
    expect(defaultWorld(p, 'nope').id).toBe('ember_wastes');
    expect(defaultWorld(p, null).id).toBe('ember_wastes');
  });

  it('every unlock points at an earlier world', () => {
    WORLDS.forEach((w, i) => {
      if (w.unlock.kind !== 'boss') return;
      const target = w.unlock.world;
      expect(WORLDS.findIndex((o) => o.id === target)).toBeLessThan(i);
    });
  });
});

describe('room clears', () => {
  it('an elite counts once, as elite (no extra combat payout)', () => {
    for (let seed = 1; seed < 80; seed++) {
      const run = createRun(seed);
      const first = availableNodes(run)[0];
      if (!first) continue;
      enterNode(run, first.id);
      const node = run.map.nodes[first.id];
      if (!node) continue;
      node.type = 'elite';
      completeRoom(run, {
        hp: run.hp,
        kills: 0,
        timeSec: 1,
        shards: 0,
        ultCharge: 0,
        lastSparks: 0,
      });
      expect(run.clearedElite).toBe(1);
      expect(run.clearedCombat).toBe(0);
      return;
    }
  });

  it('materials drop deterministically, and always from the boss', () => {
    const a = createRun(31);
    const b = createRun(31);
    for (const run of [a, b]) {
      const first = availableNodes(run)[0];
      if (!first) throw new Error('no start node');
      enterNode(run, first.id);
      const node = run.map.nodes[first.id];
      if (node) node.type = 'boss';
      completeRoom(run, {
        hp: run.hp,
        kills: 0,
        timeSec: 1,
        shards: 0,
        ultCharge: 0,
        lastSparks: 0,
      });
    }
    expect(a.materials).toEqual(b.materials);
    const total = Object.values(a.materials).reduce((s, n) => s + n, 0);
    expect(total).toBeGreaterThanOrEqual(3);
    for (const id of Object.keys(a.materials)) expect(['slag_iron', 'ember_core']).toContain(id);
  });
});

describe('duels in the run', () => {
  it('clearing a duel books its champion', () => {
    for (let seed = 1; seed < 60; seed++) {
      const run = createRun(seed);
      const duel = run.map.nodes.find((n) => n.type === 'duel');
      if (!duel) continue;
      // Walk straight to the duel's layer through any path that reaches it.
      run.currentNodeId = -1;
      run.status = 'map';
      const path: number[] = [];
      const find = (id: number): boolean => {
        if (id === duel.id) return true;
        for (const next of run.map.nodes[id]?.next ?? []) {
          if (find(next)) {
            path.unshift(next);
            return true;
          }
        }
        return false;
      };
      const start = (run.map.layers[0] ?? []).find((id) => find(id) || id === duel.id);
      if (start === undefined) continue;
      for (const id of [start, ...path]) {
        expect(availableNodes(run).some((n) => n.id === id)).toBe(true);
        enterNode(run, id);
        completeRoom(run, {
          hp: run.hp,
          kills: 0,
          timeSec: 1,
          shards: 0,
          ultCharge: 0,
          lastSparks: 0,
        });
      }
      expect(run.duelsWon.length).toBe(1);
      expect(['ember_duelist', 'twin_spark']).toContain(run.duelsWon[0]);
      return;
    }
    throw new Error('no seed produced a duel');
  });
});
