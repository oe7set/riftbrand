import { EMBER_WASTES } from '../../content/biomes/ember-wastes';
import { ROOMS } from '../../content/rooms';
import type { RoomTemplateDef } from '../../content/schema';
import { TUNING } from '../../content/tuning';
import { createRng, hashString, nextInt } from '../rng/rng';
import { buildEncounter, type Encounter } from './encounter';
import { generateMap, type MapNode, type RunMap } from './map';

export type RunStatus = 'map' | 'room' | 'won' | 'lost';

/**
 * Everything that persists between rooms. Plain JSON so it can be saved at every map node
 * (TECH_DESIGN §11). Room contents are re-derived from the seed, never stored.
 */
export interface RunState {
  seed: number;
  biomeId: string;
  map: RunMap;
  /** Node the player is in or just finished; -1 before the first room. */
  currentNodeId: number;
  visited: number[];
  status: RunStatus;
  hp: number;
  maxHp: number;
  kills: number;
  roomsCleared: number;
  /** Accumulated play time, for the result screen. */
  playTimeSec: number;
}

export interface RoomSetup {
  template: RoomTemplateDef;
  encounter: Encounter;
  playerHp: number;
  playerMaxHp: number;
}

export function createRun(seed: number): RunState {
  const s = seed >>> 0;
  const map = generateMap(createRng(hashString(`${s}:map`)), EMBER_WASTES);
  return {
    seed: s,
    biomeId: EMBER_WASTES.id,
    map,
    currentNodeId: -1,
    visited: [],
    status: 'map',
    hp: TUNING.playerMaxHp,
    maxHp: TUNING.playerMaxHp,
    kills: 0,
    roomsCleared: 0,
    playTimeSec: 0,
  };
}

/** Nodes the player may pick next: the start layer, or the successors of the current node. */
export function availableNodes(run: RunState): MapNode[] {
  if (run.status !== 'map') return [];
  if (run.currentNodeId < 0)
    return (run.map.layers[0] ?? []).map((id) => run.map.nodes[id] as MapNode);
  const current = run.map.nodes[run.currentNodeId];
  return (current?.next ?? []).map((id) => run.map.nodes[id] as MapNode);
}

export function enterNode(run: RunState, nodeId: number): MapNode {
  const node = availableNodes(run).find((n) => n.id === nodeId);
  if (!node) throw new Error(`node ${nodeId} is not reachable`);
  run.currentNodeId = node.id;
  run.visited.push(node.id);
  run.status = 'room';
  return node;
}

/** Deterministic per-room seed: same run seed + same node = same room. */
export function roomSeed(run: RunState, nodeId: number): number {
  return hashString(`${run.seed}:room:${nodeId}`);
}

export function roomSetupFor(run: RunState, node: MapNode): RoomSetup {
  const rng = createRng(roomSeed(run, node.id) ^ 0x5eed);
  const candidates = ROOMS.filter((r) => r.types.includes(node.type));
  const template = candidates[nextInt(rng, 0, candidates.length)] ?? (ROOMS[0] as RoomTemplateDef);
  return {
    template,
    encounter: buildEncounter(rng, EMBER_WASTES, node.type, node.layer),
    playerHp: run.hp,
    playerMaxHp: run.maxHp,
  };
}

export interface RoomResult {
  hp: number;
  kills: number;
  timeSec: number;
}

export function completeRoom(run: RunState, result: RoomResult): void {
  run.hp = result.hp;
  run.kills += result.kills;
  run.playTimeSec += result.timeSec;
  run.roomsCleared++;
  const node = run.map.nodes[run.currentNodeId];
  run.status = node?.type === 'boss' ? 'won' : 'map';
}

/** Rest node: heal a fraction of max HP (the weapon-upgrade alternative comes with M2.3). */
export function rest(run: RunState): number {
  const healed = Math.min(
    run.maxHp - run.hp,
    Math.round(run.maxHp * EMBER_WASTES.restHealFraction),
  );
  run.hp += healed;
  run.roomsCleared++;
  run.status = 'map';
  return healed;
}

export function failRun(run: RunState, result: RoomResult): void {
  run.kills += result.kills;
  run.playTimeSec += result.timeSec;
  run.hp = 0;
  run.status = 'lost';
}
