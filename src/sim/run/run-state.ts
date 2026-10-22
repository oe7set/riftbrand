import { EMBER_WASTES } from '../../content/biomes/ember-wastes';
import { BEING_IDS } from '../../content/boons/beings';
import { EVOLUTIONS } from '../../content/evolutions';
import { ROOMS } from '../../content/rooms';
import type { Rarity, RoomTemplateDef } from '../../content/schema';
import { TUNING } from '../../content/tuning';
import type { OwnedBoon, OwnedRelic } from '../effects/build';
import { createRng, hashString, nextInt } from '../rng/rng';
import { clearBonusShards, heal, nodeReward, runStats } from './economy';
import { buildEncounter, type Encounter } from './encounter';
import { generateMap, type MapNode, type RunMap } from './map';
import { addBoon, type BoonOffer, rewardRarityBonus, rollBoonOffer } from './rewards';

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
  boons: OwnedBoon[];
  relics: OwnedRelic[];
  /** Run currency (GDD §7.3); lost when the run ends. */
  shards: number;
  /** Shop item indices bought at the current node, so a reload can't restock it. */
  shopBought: number[];
  /** Permanent max HP gained outside relics (events); relic bonuses are recomputed. */
  maxHpBonus: number;
  /** Weapon evolutions taken (GDD §4.9). */
  evolutions: string[];
  /** Ultimate meter 0..1, carried from room to room. */
  ultCharge: number;
}

export interface RoomSetup {
  template: RoomTemplateDef;
  encounter: Encounter;
  playerHp: number;
  playerMaxHp: number;
  boons: OwnedBoon[];
  relics: OwnedRelic[];
  shards: number;
  evolutions: string[];
  ultCharge: number;
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
    boons: [],
    relics: [],
    shards: 0,
    shopBought: [],
    maxHpBonus: 0,
    evolutions: [],
    ultCharge: 0,
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
  run.shopBought = [];
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
    boons: run.boons,
    relics: run.relics,
    shards: run.shards,
    evolutions: run.evolutions,
    ultCharge: run.ultCharge,
  };
}

export interface RoomResult {
  hp: number;
  kills: number;
  timeSec: number;
  /** Absolute shard count at the end of the room (the room starts with the run's shards). */
  shards: number;
  ultCharge: number;
}

export function completeRoom(run: RunState, result: RoomResult): void {
  run.hp = result.hp;
  run.kills += result.kills;
  run.playTimeSec += result.timeSec;
  run.ultCharge = result.ultCharge;
  run.roomsCleared++;
  const node = run.map.nodes[run.currentNodeId];
  const bonus = node ? clearBonusShards(node.type) : 0;
  run.shards = result.shards + Math.round(bonus * (1 + runStats(run).shardGain));
  run.status = node?.type === 'boss' ? 'won' : 'map';
}

/** Altar, shop and event nodes have no fight; leaving them completes the node. */
export function completeNonCombat(run: RunState): void {
  run.roomsCleared++;
  run.status = 'map';
}

/** Rest node: heal a fraction of max HP (or evolve the weapon instead, see restEvolve). */
export function rest(run: RunState): number {
  const healed = Math.round(heal(run, run.maxHp * EMBER_WASTES.restHealFraction));
  run.roomsCleared++;
  run.status = 'map';
  return healed;
}

/** The boon offer a node grants, or null if its reward is not a boon. */
export function offerFor(run: RunState, node: MapNode): BoonOffer | null {
  const reward = nodeReward(run.seed, node);
  if (reward?.kind !== 'boon') return null;
  const bonus = rewardRarityBonus(node.type) ?? 0;
  const being = reward.being;
  const offer = rollBoonOffer(run.seed, node.id, being, run.boons, bonus);
  if (offer.options.length > 0) return offer;
  // This being has nothing left to give: another one steps in, or there is no reward.
  for (const other of BEING_IDS) {
    if (other === being) continue;
    const fallback = rollBoonOffer(run.seed, node.id, other, run.boons, bonus);
    if (fallback.options.length > 0) return fallback;
  }
  return null;
}

/** Evolutions whose combination the run owns and that were not taken yet (GDD §4.9). */
export function availableEvolutions(run: RunState): string[] {
  const boons = new Set(run.boons.map((b) => b.id));
  const relics = new Set(run.relics.map((r) => r.id));
  return EVOLUTIONS.filter(
    (e) =>
      !run.evolutions.includes(e.id) &&
      e.requires.boons.every((id) => boons.has(id)) &&
      e.requires.relics.every((id) => relics.has(id)),
  ).map((e) => e.id);
}

export function evolve(run: RunState, id: string): void {
  if (!run.evolutions.includes(id)) run.evolutions.push(id);
}

/** Rest alternative to healing: take an available evolution instead. */
export function restEvolve(run: RunState, id: string): void {
  evolve(run, id);
  run.roomsCleared++;
  run.status = 'map';
}

export function pickBoon(run: RunState, pick: { id: string; rarity: Rarity }): void {
  run.boons = addBoon(run.boons, pick);
}

export function failRun(run: RunState, result: RoomResult): void {
  run.kills += result.kills;
  run.playTimeSec += result.timeSec;
  run.hp = 0;
  run.status = 'lost';
}
