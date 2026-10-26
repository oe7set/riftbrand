import { describe, expect, it } from 'vitest';
import { EMBER_WASTES } from '../../content/biomes/ember-wastes';
import type { BiomeDef } from '../../content/schema';
import { createRng } from '../rng/rng';
import type { MapNode, RunMap } from './map';
import { DIR_DX, DIR_DY, doorLocked, generateNet, opposite } from './net';

const NET_BIOME: BiomeDef = {
  ...EMBER_WASTES,
  net: { roomsMin: 10, roomsMax: 14, puzzles: 2, loops: 2, eliteChance: 0.3, shop: true },
};

/** Rooms reachable from the start without opening a locked door. */
function reachableWithoutKeys(map: RunMap): Set<number> {
  const seen = new Set([0]);
  const queue = [0];
  for (let q = 0; q < queue.length; q++) {
    const node = map.nodes[queue[q] as number] as MapNode;
    node.doors?.forEach((next, d) => {
      if (next < 0 || seen.has(next) || doorLocked(node, d)) return;
      seen.add(next);
      queue.push(next);
    });
  }
  return seen;
}

describe('room net (ROADMAP M6.0b)', () => {
  it('builds a connected grid with matching doors on both sides', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const map = generateNet(createRng(seed), NET_BIOME);
      const cells = new Set<string>();
      for (const n of map.nodes) {
        const key = `${n.gx},${n.gy}`;
        expect(cells.has(key), `seed ${seed}: one room per cell`).toBe(false);
        cells.add(key);
        n.doors?.forEach((other, d) => {
          if (other < 0) return;
          const b = map.nodes[other] as MapNode;
          expect(b.doors?.[opposite(d)], `seed ${seed}: door back`).toBe(n.id);
          expect((b.gx as number) - (n.gx as number)).toBe(DIR_DX[d]);
          expect((b.gy as number) - (n.gy as number)).toBe(DIR_DY[d]);
          expect(doorLocked(n, d)).toBe(doorLocked(b, opposite(d)));
        });
      }
      const all = new Set<number>();
      const queue = [0];
      all.add(0);
      for (let q = 0; q < queue.length; q++) {
        for (const next of map.nodes[queue[q] as number]?.doors ?? []) {
          if (next >= 0 && !all.has(next)) {
            all.add(next);
            queue.push(next);
          }
        }
      }
      expect(all.size, `seed ${seed}: connected`).toBe(map.nodes.length);
      expect(map.nodes.length).toBeGreaterThanOrEqual(10);
      expect(map.nodes.length).toBeLessThanOrEqual(14);
    }
  });

  it('hides the boss behind a locked guardian door, with a key puzzle before it', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const map = generateNet(createRng(seed), NET_BIOME);
      const types = map.nodes.map((n) => n.type);
      expect(types[0]).toBe('start');
      expect(types.filter((t) => t === 'boss')).toHaveLength(1);
      const open = reachableWithoutKeys(map);
      const boss = map.nodes.find((n) => n.type === 'boss') as MapNode;
      expect(open.has(boss.id), `seed ${seed}: boss needs a key`).toBe(false);
      const puzzles = map.nodes.filter((n) => n.type === 'puzzle');
      expect(puzzles.length).toBeGreaterThanOrEqual(1);
      expect(
        puzzles.some((p) => open.has(p.id)),
        `seed ${seed}: a key is reachable`,
      ).toBe(true);
      // Exactly one locked door (counted from both sides).
      const lockedSides = map.nodes.reduce(
        (sum, n) => sum + (n.doors ?? []).filter((_, d) => doorLocked(n, d)).length,
        0,
      );
      expect(lockedSides).toBe(2);
    }
  });

  it('is deterministic per seed', () => {
    expect(generateNet(createRng(9), NET_BIOME)).toEqual(generateNet(createRng(9), NET_BIOME));
  });
});

describe('room net runs (ROADMAP M6.0b)', () => {
  it('starts inside the entrance with doors to every neighbour', async () => {
    const { createRun, roomSetupFor } = await import('./run-state');
    const run = createRun(5, undefined, [], undefined, undefined, true);
    expect(run.status).toBe('room');
    expect(run.currentNodeId).toBe(0);
    const node = run.map.nodes[0] as MapNode;
    const setup = roomSetupFor(run, node);
    expect(setup.calm).toBe(true);
    expect(setup.encounter.kind).toBe('none');
    expect(setup.doors?.map((d) => d.dir).sort()).toEqual(
      (node.doors ?? []).flatMap((n, d) => (n >= 0 ? [d] : [])).sort(),
    );
  });

  it('keeps door spots and the spawn inside each room clear of obstacles', async () => {
    const { ROOMS } = await import('../../content/rooms');
    const { createRoomState, loadObstacles, overlapsObstacle } = await import('../room');
    for (const t of ROOMS) {
      const room = createRoomState();
      loadObstacles(room, t.obstacles);
      const spots = [
        [t.widthPx / 2, 46, 0, 1],
        [t.widthPx - 46, t.heightPx / 2, -1, 0],
        [t.widthPx / 2, t.heightPx - 46, 0, -1],
        [46, t.heightPx / 2, 1, 0],
      ] as const;
      for (const [x, y, fx, fy] of spots) {
        expect(overlapsObstacle(room, x, y, 30), `${t.id} door ${x},${y}`).toBe(false);
        expect(overlapsObstacle(room, x + fx * 120, y + fy * 120, 20), `${t.id} spawn`).toBe(false);
      }
    }
  });
});

describe('Glass Sea (ROADMAP M6.1)', () => {
  it('is played as a room net with its own guardian and the Mirror Queen', async () => {
    const { createRun, roomSetupFor } = await import('./run-state');
    const { ENEMIES } = await import('../../content/enemies');
    const { enemyTypeFromCode } = await import('../enemy-code');
    for (let seed = 1; seed <= 10; seed++) {
      const run = createRun(seed, undefined, [], undefined, 'glass_sea');
      expect(run.map.layout).toBe('net');
      const first = (node: MapNode) => {
        const e = roomSetupFor(run, node).encounter;
        return e.kind === 'waves' ? ENEMIES[enemyTypeFromCode(e.waves[0]?.[0] ?? 0)]?.id : null;
      };
      const boss = run.map.nodes.find((n) => n.type === 'boss') as MapNode;
      const duel = run.map.nodes.find((n) => n.type === 'duel') as MapNode;
      expect(first(boss)).toBe('mirror_queen');
      expect(['glass_fencer', 'ice_whale']).toContain(first(duel));
    }
  });
});
