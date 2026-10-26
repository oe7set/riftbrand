import type { BiomeDef, RoomType } from '../../content/schema';
import { nextFloat, nextInt, type Rng } from '../rng/rng';
import type { MapNode, RunMap } from './map';

/** Net shape for worlds played as a room net without their own settings (debug). */
export const DEFAULT_NET: NonNullable<BiomeDef['net']> = {
  roomsMin: 11,
  roomsMax: 14,
  puzzles: 2,
  loops: 2,
  eliteChance: 0.25,
  shop: true,
};

/** Door directions in a room net: north, east, south, west. */
export const Dir = { N: 0, E: 1, S: 2, W: 3 } as const;
export type DirId = (typeof Dir)[keyof typeof Dir];

export const DIR_DX: readonly number[] = [0, 1, 0, -1];
export const DIR_DY: readonly number[] = [-1, 0, 1, 0];

export function opposite(d: number): number {
  return (d + 2) % 4;
}

function link(a: MapNode, b: MapNode, d: number): void {
  (a.doors as number[])[d] = b.id;
  (b.doors as number[])[opposite(d)] = a.id;
  if (!a.next.includes(b.id)) a.next.push(b.id);
  if (!b.next.includes(a.id)) b.next.push(a.id);
}

function degree(n: MapNode): number {
  let k = 0;
  for (const d of n.doors ?? []) if (d >= 0) k++;
  return k;
}

/** Breadth-first distance from the start and the tree parent of every room. */
function distances(nodes: MapNode[], start: number): { dist: number[]; parent: number[] } {
  const dist = nodes.map(() => -1);
  const parent = nodes.map(() => -1);
  dist[start] = 0;
  const queue = [start];
  for (let q = 0; q < queue.length; q++) {
    const id = queue[q] as number;
    for (const next of nodes[id]?.doors ?? []) {
      if (next < 0 || (dist[next] as number) >= 0) continue;
      dist[next] = (dist[id] as number) + 1;
      parent[next] = id;
      queue.push(next);
    }
  }
  return { dist, parent };
}

/**
 * A room net (ROADMAP M6.0b): small rooms on a grid with doors in four directions, like a
 * little dungeon. Grown as a random tree from the start room, then a few loops for shortcuts.
 * - The boss sits in the farthest dead end; its guardian (a duel) in the room before it.
 * - The door into the guardian's room is locked; puzzle rooms (dead ends) hand out the keys.
 * - Treasure, rest and a shop fill other rooms; the rest are fights that grow harder with
 *   distance (`layer` is the distance from the start).
 */
export function generateNet(rng: Rng, biome: BiomeDef): RunMap {
  const cfg = biome.net;
  if (!cfg) throw new Error(`biome ${biome.id} has no net layout`);
  const target = nextInt(rng, cfg.roomsMin, cfg.roomsMax + 1);
  const nodes: MapNode[] = [];
  const cells = new Map<string, number>();
  const add = (gx: number, gy: number): MapNode => {
    const node: MapNode = {
      id: nodes.length,
      layer: 0,
      x: 0,
      type: 'combat',
      next: [],
      gx,
      gy,
      doors: [-1, -1, -1, -1],
      locked: 0,
    };
    nodes.push(node);
    cells.set(`${gx},${gy}`, node.id);
    return node;
  };
  add(0, 0);
  // Grow: prefer rooms with few doors, so the net branches instead of forming a blob.
  // Two rooms are kept back for the boss wing.
  for (let tries = 0; nodes.length < target - 2 && tries < target * 50; tries++) {
    const from = nodes[nextInt(rng, 0, nodes.length)] as MapNode;
    if (degree(from) >= 3 && nextFloat(rng) < 0.7) continue;
    const d = nextInt(rng, 0, 4);
    const gx = (from.gx as number) + (DIR_DX[d] as number);
    const gy = (from.gy as number) + (DIR_DY[d] as number);
    if (cells.has(`${gx},${gy}`)) continue;
    link(from, add(gx, gy), d);
  }

  const start = 0;
  let { dist, parent } = distances(nodes, start);
  // The boss wing is appended beyond the farthest room: a guardian room with exactly two
  // doors, then the boss as a dead end. So one locked door really closes the whole wing.
  const isFree = (gx: number, gy: number) => !cells.has(`${gx},${gy}`);
  const byDistance = [...nodes].sort(
    (a, b) => (dist[b.id] as number) - (dist[a.id] as number) || a.id - b.id,
  );
  let guardian: MapNode | null = null;
  let boss: MapNode | null = null;
  for (const anchor of byDistance) {
    if (anchor.id === start && nodes.length > 1) continue;
    const ax = anchor.gx as number;
    const ay = anchor.gy as number;
    let placed = false;
    for (let k = 0; k < 4 && !placed; k++) {
      const d1 = (nextInt(rng, 0, 4) + k) % 4;
      const gx = ax + (DIR_DX[d1] as number);
      const gy = ay + (DIR_DY[d1] as number);
      if (!isFree(gx, gy)) continue;
      for (let j = 0; j < 4; j++) {
        const d2 = (d1 + j) % 4;
        if (d2 === opposite(d1)) continue;
        const bx = gx + (DIR_DX[d2] as number);
        const by = gy + (DIR_DY[d2] as number);
        // Loops skip the wing later, so the guardian keeps exactly two doors.
        if (!isFree(bx, by) || (bx === ax && by === ay)) continue;
        guardian = add(gx, gy);
        link(anchor, guardian, d1);
        boss = add(bx, by);
        link(guardian, boss, d2);
        placed = true;
        break;
      }
    }
    if (placed) break;
  }
  if (!guardian || !boss) throw new Error('room net: no space for the boss wing');
  boss.type = 'boss';
  guardian.type = 'duel';
  const wing = new Set([boss.id, guardian.id]);
  ({ dist, parent } = distances(nodes, start));

  // Loops for shortcuts, never touching the boss wing or dead ends that hold something.
  for (let i = 0; i < cfg.loops; i++) {
    const candidates: Array<[MapNode, MapNode, number]> = [];
    for (const a of nodes) {
      if (wing.has(a.id)) continue;
      for (let d = 0; d < 4; d++) {
        if ((a.doors?.[d] ?? -1) >= 0) continue;
        const id = cells.get(
          `${(a.gx as number) + (DIR_DX[d] as number)},${(a.gy as number) + (DIR_DY[d] as number)}`,
        );
        const b = id === undefined ? undefined : nodes[id];
        if (!b || wing.has(b.id) || b.id < a.id) continue;
        candidates.push([a, b, d]);
      }
    }
    const pick = candidates[nextInt(rng, 0, candidates.length)];
    if (pick) link(pick[0], pick[1], pick[2]);
  }
  ({ dist, parent } = distances(nodes, start));

  // Lock the way into the boss wing (both sides of the door).
  const before = nodes[parent[guardian.id] as number];
  if (before) {
    const d = (before.doors as number[]).indexOf(guardian.id);
    before.locked = (before.locked ?? 0) | (1 << d);
    guardian.locked = (guardian.locked ?? 0) | (1 << opposite(d));
  }

  // Dead ends outside the wing hold puzzles (keys) and treasure; at least one puzzle always.
  const free = nodes
    .filter((n) => n.id !== start && !wing.has(n.id) && degree(n) === 1)
    .sort((a, b) => a.id - b.id);
  const puzzles = Math.max(1, Math.min(cfg.puzzles, free.length));
  for (let i = 0; i < puzzles && free.length > 0; i++) {
    const n = free.splice(nextInt(rng, 0, free.length), 1)[0] as MapNode;
    n.type = 'puzzle';
  }
  if (!nodes.some((n) => n.type === 'puzzle')) {
    // No free dead end: put the key puzzle in any ordinary room off the start.
    const any = nodes.find((n) => n.id !== start && !wing.has(n.id));
    if (any) any.type = 'puzzle';
  }
  const treasure = free.splice(nextInt(rng, 0, free.length), 1)[0];
  if (treasure) treasure.type = 'treasure';

  const ordinary = (): MapNode[] =>
    nodes.filter((n) => n.id !== start && n.type === 'combat' && !wing.has(n.id));
  const maxDist = Math.max(...nodes.map((n) => dist[n.id] as number));
  const mid = ordinary().sort(
    (a, b) =>
      Math.abs((dist[a.id] as number) - maxDist / 2) -
        Math.abs((dist[b.id] as number) - maxDist / 2) || a.id - b.id,
  )[0];
  if (mid) mid.type = 'rest';
  const shop = ordinary()[nextInt(rng, 0, ordinary().length)];
  if (shop && cfg.shop) shop.type = 'shop';
  for (const n of ordinary()) {
    if ((dist[n.id] as number) >= 3 && nextFloat(rng) < cfg.eliteChance) n.type = 'elite';
  }
  const startNode = nodes[start] as MapNode;
  startNode.type = 'start';

  for (const n of nodes) n.layer = Math.max(0, (dist[n.id] as number) - 1);
  const layers: number[][] = [];
  for (const n of nodes) {
    const l = dist[n.id] as number;
    while (layers.length <= l) layers.push([]);
    (layers[l] as number[]).push(n.id);
  }
  return { nodes, layers, layout: 'net' };
}

/** The neighbour behind a door, or -1. */
export function neighbour(node: MapNode, d: number): number {
  return node.doors?.[d] ?? -1;
}

/** True if the door from `node` in direction `d` needs a key. */
export function doorLocked(node: MapNode, d: number): boolean {
  return ((node.locked ?? 0) & (1 << d)) !== 0;
}

/** Room types with a fight in a net (rooms are cleared once and stay cleared). */
export function isFightType(type: RoomType): boolean {
  return type === 'combat' || type === 'elite' || type === 'duel' || type === 'boss';
}
