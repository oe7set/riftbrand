import { BEING_IDS } from '../../content/boons/beings';
import { ENEMIES } from '../../content/enemies';
import { EVOLUTIONS } from '../../content/evolutions';
import { ROOMS } from '../../content/rooms';
import type { Rarity, RoomTemplateDef } from '../../content/schema';
import { START_SPELLS } from '../../content/spells';
import { TUNING } from '../../content/tuning';
import { FIRST_WORLD_ID, worldBiome } from '../../content/worlds';
import type { OwnedBoon, OwnedRelic } from '../effects/build';
import { enemyTypeFromCode } from '../enemy-code';
import { emptyRunMeta, type RunMeta } from '../meta/profile';
import { createRng, hashString, nextInt } from '../rng/rng';
import { clearBonusShards, heal, nodeReward, rollRoomMaterials, runStats } from './economy';
import { buildEncounter, type Encounter } from './encounter';
import { generateMap, type MapNode, type RunMap } from './map';
import { addBoon, type BoonOffer, rewardRarityBonus, rollBoonOffer } from './rewards';
import type { UpgradeState } from './upgrades';

export type RunStatus = 'map' | 'room' | 'won' | 'lost';

/** A spell in one of the two slots (ROADMAP M3.2); level and branches grow in the run (M3.4). */
export interface OwnedSpell extends UpgradeState {
  id: string;
}

export interface SpellSlots {
  active: OwnedSpell | null;
  aura: OwnedSpell | null;
}

export function startSpellSlots(): SpellSlots {
  return {
    active: { id: START_SPELLS.active, level: 1, branches: [] },
    aura: { id: START_SPELLS.aura, level: 1, branches: [] },
  };
}

/**
 * Everything that persists between rooms. Plain JSON so it can be saved at every map node
 * (TECH_DESIGN §11). Room contents are re-derived from the seed, never stored.
 */
export interface RunState {
  seed: number;
  /** The world this run leads through (ROADMAP M5.2); its boss ends the run. */
  worldId: string;
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
  /** Ember Tree bonuses, snapshotted at the start of the run (GDD §8.2). */
  meta: RunMeta;
  /** Relics not yet unlocked at Nix; never offered in this run. */
  lockedRelics: string[];
  /** Last Spark charges and boon rerolls left in this run. */
  lastSparks: number;
  rerolls: number;
  /** Increments with each reroll so the rerolled offer is reproducible after a reload. */
  rerollSalt: number;
  /** Cleared rooms by kind, for the meta payout. */
  clearedCombat: number;
  clearedElite: number;
  clearedBoss: number;
  reachedBoss: boolean;
  /** Equipped spells (ROADMAP M3.2). */
  spells: SpellSlots;
  /** Rift shot upgrades (ROADMAP M3.4). */
  cast: UpgradeState;
  /** Mini-bosses (duel champions, by enemy id) beaten in this run, for the world map. */
  duelsWon: string[];
  /** Materials found so far (ROADMAP M5.3); they go to the stash even if the run is lost. */
  materials: Record<string, number>;
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
  /** Ember Tree bonuses applied inside the room. */
  bonusAllDamage: number;
  bonusStaminaRegen: number;
  staminaBonus: number;
  lastSparks: number;
  lastSparkHeal: number;
  spells: SpellSlots;
  cast: UpgradeState;
}

export function createRun(
  seed: number,
  meta: RunMeta = emptyRunMeta(),
  lockedRelics: readonly string[] = [],
  spells: SpellSlots = startSpellSlots(),
  worldId: string = FIRST_WORLD_ID,
): RunState {
  const s = seed >>> 0;
  const map = generateMap(createRng(hashString(`${s}:map`)), worldBiome(worldId));
  return {
    seed: s,
    worldId,
    map,
    currentNodeId: -1,
    visited: [],
    status: 'map',
    hp: TUNING.playerMaxHp + meta.maxHp,
    maxHp: TUNING.playerMaxHp + meta.maxHp,
    kills: 0,
    roomsCleared: 0,
    playTimeSec: 0,
    boons: [],
    relics: [],
    shards: meta.startShards,
    shopBought: [],
    maxHpBonus: 0,
    evolutions: [],
    ultCharge: 0,
    meta: { ...meta },
    lockedRelics: [...lockedRelics],
    lastSparks: meta.lastSparks,
    rerolls: meta.rerolls,
    rerollSalt: 0,
    clearedCombat: 0,
    clearedElite: 0,
    clearedBoss: 0,
    reachedBoss: false,
    spells: {
      active: spells.active ? { ...spells.active, branches: [...spells.active.branches] } : null,
      aura: spells.aura ? { ...spells.aura, branches: [...spells.aura.branches] } : null,
    },
    cast: { level: 1, branches: [] },
    duelsWon: [],
    materials: {},
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
  run.rerollSalt = 0;
  run.status = 'room';
  if (node.type === 'boss') run.reachedBoss = true;
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
    encounter: buildEncounter(rng, worldBiome(run.worldId), node.type, node.layer),
    playerHp: run.hp,
    playerMaxHp: run.maxHp,
    boons: run.boons,
    relics: run.relics,
    shards: run.shards,
    evolutions: run.evolutions,
    ultCharge: run.ultCharge,
    bonusAllDamage: run.meta.allDamage,
    bonusStaminaRegen: run.meta.staminaRegen,
    staminaBonus: run.meta.staminaBonus,
    lastSparks: run.lastSparks,
    lastSparkHeal: run.meta.lastSparkHeal,
    spells: run.spells,
    cast: run.cast,
  };
}

export interface RoomResult {
  hp: number;
  kills: number;
  timeSec: number;
  /** Absolute shard count at the end of the room (the room starts with the run's shards). */
  shards: number;
  ultCharge: number;
  lastSparks: number;
}

export function completeRoom(run: RunState, result: RoomResult): void {
  run.hp = result.hp;
  run.kills += result.kills;
  run.playTimeSec += result.timeSec;
  run.ultCharge = result.ultCharge;
  run.lastSparks = result.lastSparks;
  run.roomsCleared++;
  const node = run.map.nodes[run.currentNodeId];
  // Duels pay out like elite rooms (Glut and Rissstaub, ROADMAP M3.5).
  if (node?.type === 'elite' || node?.type === 'duel') run.clearedElite++;
  else if (node?.type === 'boss') run.clearedBoss++;
  else run.clearedCombat++;
  if (node?.type === 'duel') recordDuel(run, node);
  if (node) {
    const rng = createRng(roomSeed(run, node.id) ^ 0x6a7e);
    for (const [id, n] of Object.entries(rollRoomMaterials(rng, run.worldId, node.type))) {
      run.materials[id] = (run.materials[id] ?? 0) + n;
    }
  }
  // Glutheilung (Ember Tree): a little health after every fight.
  if (run.meta.roomHeal > 0) heal(run, run.meta.roomHeal);
  const bonus = node ? clearBonusShards(node.type) : 0;
  run.shards = result.shards + Math.round(bonus * (1 + runStats(run).shardGain));
  run.status = node?.type === 'boss' ? 'won' : 'map';
}

/** Books the duel's champion (the line-up's first enemy) as a beaten mini-boss. */
function recordDuel(run: RunState, node: MapNode): void {
  const encounter = roomSetupFor(run, node).encounter;
  if (encounter.kind !== 'waves') return;
  const code = encounter.waves[0]?.[0];
  if (code === undefined) return;
  const champion = ENEMIES[enemyTypeFromCode(code)]?.id;
  if (champion && !run.duelsWon.includes(champion)) run.duelsWon.push(champion);
}

/** Altar, shop and event nodes have no fight; leaving them completes the node. */
export function completeNonCombat(run: RunState): void {
  run.roomsCleared++;
  run.status = 'map';
}

/** Rest node: heal a fraction of max HP (or evolve the weapon instead, see restEvolve). */
export function rest(run: RunState): number {
  const healed = Math.round(heal(run, run.maxHp * worldBiome(run.worldId).restHealFraction));
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
  const offer = rollBoonOffer(run.seed, node.id, being, run.boons, bonus, run.rerollSalt);
  if (offer.options.length > 0) return offer;
  // This being has nothing left to give: another one steps in, or there is no reward.
  for (const other of BEING_IDS) {
    if (other === being) continue;
    const fallback = rollBoonOffer(run.seed, node.id, other, run.boons, bonus, run.rerollSalt);
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

/** Second Choice (Ember Tree): spends a reroll; the next `offerFor` rolls a fresh offer. */
export function rerollOffer(run: RunState): boolean {
  if (run.rerolls <= 0) return false;
  run.rerolls--;
  run.rerollSalt++;
  return true;
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
