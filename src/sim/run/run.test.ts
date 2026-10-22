import { describe, expect, it } from 'vitest';
import { EMBER_WASTES } from '../../content/biomes/ember-wastes';
import { ENEMIES } from '../../content/enemies';
import { createRng } from '../rng/rng';
import { buildEncounter } from './encounter';
import { generateMap } from './map';
import {
  availableNodes,
  completeRoom,
  createRun,
  enterNode,
  rest,
  roomSetupFor,
} from './run-state';

const SEEDS = Array.from({ length: 200 }, (_, i) => i * 7919 + 1);

describe('map generation', () => {
  it.each([1, 42, 1337])('is deterministic (seed %i)', (seed) => {
    expect(generateMap(createRng(seed), EMBER_WASTES)).toEqual(
      generateMap(createRng(seed), EMBER_WASTES),
    );
  });

  it('follows the layout rules for many seeds', () => {
    for (const seed of SEEDS) {
      const map = generateMap(createRng(seed), EMBER_WASTES);
      const last = EMBER_WASTES.layers - 1;
      expect(map.layers).toHaveLength(EMBER_WASTES.layers);
      expect(map.layers[last]).toHaveLength(1);
      expect(map.nodes[map.layers[last]?.[0] ?? -1]?.type).toBe('boss');
      for (const id of map.layers[last - 1] ?? []) expect(map.nodes[id]?.type).toBe('rest');
      for (const id of map.layers[0] ?? []) expect(map.nodes[id]?.type).toBe('combat');
      expect(map.nodes.some((n) => n.type === 'horde')).toBe(true);
      for (const n of map.nodes) {
        if (n.type === 'elite') expect(n.layer).toBeGreaterThanOrEqual(EMBER_WASTES.eliteMinLayer);
        if (n.layer < last) expect(n.next.length).toBeGreaterThan(0);
      }
    }
  });

  it('makes every node reachable and paths never cross', () => {
    for (const seed of SEEDS) {
      const map = generateMap(createRng(seed), EMBER_WASTES);
      const incoming = new Map<number, number>();
      for (const n of map.nodes)
        for (const t of n.next) incoming.set(t, (incoming.get(t) ?? 0) + 1);
      for (const n of map.nodes)
        if (n.layer > 0) expect(incoming.get(n.id) ?? 0).toBeGreaterThan(0);
      for (let layer = 0; layer < map.layers.length - 1; layer++) {
        const ids = map.layers[layer] ?? [];
        const next = map.layers[layer + 1] ?? [];
        // Edge (i → a) and (j → b) with i < j must have a ≤ b.
        for (let i = 0; i < ids.length; i++) {
          for (let j = i + 1; j < ids.length; j++) {
            const maxI = Math.max(
              ...(map.nodes[ids[i] ?? 0]?.next ?? []).map((t) => next.indexOf(t)),
            );
            const minJ = Math.min(
              ...(map.nodes[ids[j] ?? 0]?.next ?? []).map((t) => next.indexOf(t)),
            );
            expect(maxI).toBeLessThanOrEqual(minJ);
          }
        }
      }
    }
  });
});

describe('encounters', () => {
  it('grows with the layer and only uses unlocked enemies', () => {
    const rng = createRng(3);
    const early = buildEncounter(rng, EMBER_WASTES, 'combat', 0);
    const late = buildEncounter(rng, EMBER_WASTES, 'combat', 6);
    if (early.kind !== 'waves' || late.kind !== 'waves') throw new Error('expected waves');
    const cost = (w: number[][]) =>
      w.flat().reduce((sum, t) => sum + (ENEMIES[t]?.waveCost ?? 0), 0);
    expect(cost(late.waves)).toBeGreaterThan(cost(early.waves));
    for (const t of early.waves.flat()) expect(ENEMIES[t]?.minWave).toBe(1);
  });

  it('puts a brute into elite rooms', () => {
    const e = buildEncounter(createRng(9), EMBER_WASTES, 'elite', 3);
    if (e.kind !== 'waves') throw new Error('expected waves');
    expect(e.waves[0]?.some((t) => ENEMIES[t]?.id === 'brute')).toBe(true);
  });
});

describe('run state', () => {
  it('walks from the start layer to the boss', () => {
    const run = createRun(77);
    expect(availableNodes(run).length).toBe(run.map.layers[0]?.length);
    while (run.status === 'map') {
      const next = availableNodes(run)[0];
      if (!next) throw new Error('dead end');
      enterNode(run, next.id);
      if (next.type === 'rest') {
        rest(run);
      } else {
        expect(roomSetupFor(run, next).template.types).toContain(next.type);
        completeRoom(run, { hp: run.hp, kills: 3, timeSec: 30 });
      }
    }
    expect(run.status).toBe('won');
    expect(run.roomsCleared).toBe(EMBER_WASTES.layers);
  });

  it('rejects unreachable nodes', () => {
    const run = createRun(1);
    const boss = run.map.layers[run.map.layers.length - 1]?.[0] ?? -1;
    expect(() => enterNode(run, boss)).toThrow();
  });

  it('rest heals a fraction of max HP without overhealing', () => {
    const run = createRun(1);
    run.hp = 90;
    rest(run);
    expect(run.hp).toBe(100);
    run.hp = 10;
    rest(run);
    expect(run.hp).toBe(10 + Math.round(100 * EMBER_WASTES.restHealFraction));
  });

  it('derives the same room for the same seed and node', () => {
    const a = createRun(5);
    const b = createRun(5);
    const node = availableNodes(a)[0];
    if (!node) throw new Error('no node');
    expect(roomSetupFor(a, node)).toEqual(roomSetupFor(b, node));
  });
});
