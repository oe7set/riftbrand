import { BEING_IDS } from '../../content/boons/beings';
import { ENEMIES } from '../../content/enemies';
import { EVOLUTIONS } from '../../content/evolutions';
import { PUZZLES } from '../../content/puzzles';
import { ROOMS } from '../../content/rooms';
import type { PuzzleDef, Rarity, RoomTemplateDef } from '../../content/schema';
import { START_SPELLS } from '../../content/spells';
import { STATUSES } from '../../content/statuses';
import { TUNING } from '../../content/tuning';
import { FIRST_WORLD_ID, worldBiome } from '../../content/worlds';
import type { OwnedArmor, OwnedBoon, OwnedRelic } from '../effects/build';
import { enemyTypeFromCode } from '../enemy-code';
import { emptyRunMeta, type RunMeta } from '../meta/profile';
import { createRng, hashString, nextInt } from '../rng/rng';
import type { DoorSetup } from '../room';
import {
  applyMaxHp,
  clearBonusShards,
  heal,
  nodeReward,
  rollRoomMaterials,
  runStats,
} from './economy';
import { buildEncounter, type Encounter } from './encounter';
import { generateMap, type MapNode, type RunMap } from './map';
import { DEFAULT_NET, doorLocked, generateNet, isFightType, opposite } from './net';
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
  /** Room nets only (ROADMAP M6.0b). */
  net?: NetProgress;
  /** What quests count from this run (ROADMAP M5.6). */
  tally: RunTally;
}

export interface RunTally {
  /** Kills by status id (burn, chill, poison, blind). */
  statusKills: Record<string, number>;
  /** Rooms cleared without taking damage. */
  flawlessRooms: number;
  /** Quest items found in event rooms. */
  items: string[];
}

/** Where the player is in a room net, and what they carry. */
export interface NetProgress {
  /** Keys from solved puzzles, not yet used on a locked door. */
  keys: number;
  /** Door (Dir) the player came in by; -1 in the start room. */
  entryDir: number;
  /** Rooms whose fight is won or whose visit is done; they stay calm when entered again. */
  cleared: number[];
}

export function emptyTally(): RunTally {
  return { statusKills: {}, flawlessRooms: 0, items: [] };
}

export interface RoomSetup {
  template: RoomTemplateDef;
  encounter: Encounter;
  /** Puzzle pieces for puzzle nodes (ROADMAP M6.0). */
  puzzle?: PuzzleDef;
  /** Room nets (ROADMAP M6.0b): doors, the one the player came in by, keys carried. */
  doors?: DoorSetup[];
  entryDir?: number;
  keys?: number;
  /** Nothing to fight here (start, treasure, revisits): doors open at once. */
  calm?: boolean;
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
  /** Armour equipped before the run (ROADMAP M5.4). */
  armor: OwnedArmor[];
}

export function createRun(
  seed: number,
  meta: RunMeta = emptyRunMeta(),
  lockedRelics: readonly string[] = [],
  spells: SpellSlots = startSpellSlots(),
  worldId: string = FIRST_WORLD_ID,
  /** Debug: play the world as a room net even if its biome has none (ROADMAP M6.0b). */
  forceNet = false,
): RunState {
  const s = seed >>> 0;
  const biome = worldBiome(worldId);
  const netBiome = biome.net ? biome : forceNet ? { ...biome, net: DEFAULT_NET } : null;
  const mapRng = createRng(hashString(`${s}:map`));
  const map = netBiome ? generateNet(mapRng, netBiome) : generateMap(mapRng, biome);
  const run: RunState = {
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
    meta: { ...meta, armor: meta.armor.map((a) => ({ ...a })) },
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
    tally: emptyTally(),
  };
  if (map.layout === 'net') {
    // A net run starts inside its entrance, not on a map.
    run.net = { keys: 0, entryDir: -1, cleared: [0] };
    run.currentNodeId = 0;
    run.visited = [0];
    run.status = 'room';
  }
  // Armour can raise max HP; the run starts at full health either way.
  applyMaxHp(run);
  run.hp = run.maxHp;
  return run;
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

/**
 * The puzzle for a puzzle node: the run's puzzle nodes walk through the world's puzzles from a
 * seeded start, so one run never repeats a puzzle while there are fresh ones.
 */
export function puzzleFor(run: RunState, node: MapNode): PuzzleDef | undefined {
  const pool = PUZZLES.filter((p) => p.worlds.length === 0 || p.worlds.includes(run.worldId));
  if (pool.length === 0) return undefined;
  const puzzleNodes = run.map.nodes.filter((n) => n.type === 'puzzle');
  const k = Math.max(
    0,
    puzzleNodes.findIndex((n) => n.id === node.id),
  );
  const first = nextInt(createRng(hashString(`${run.seed}:puzzles`)), 0, pool.length);
  return pool[(first + k) % pool.length];
}

/** A puzzle's room geometry in template form. */
export function puzzleTemplate(p: PuzzleDef): RoomTemplateDef {
  return {
    id: p.id,
    widthPx: p.widthPx,
    heightPx: p.heightPx,
    types: ['puzzle'],
    obstacles: p.obstacles,
    playerStart: p.playerStart,
    exit: p.exit,
    spawnPoints: [],
  };
}

/** Door positions on the edges of a room: north, east, south, west. */
function doorSpot(template: RoomTemplateDef, d: number): { x: number; y: number } {
  const inset = 46;
  const w = template.widthPx;
  const h = template.heightPx;
  if (d === 0) return { x: w / 2, y: inset };
  if (d === 1) return { x: w - inset, y: h / 2 };
  if (d === 2) return { x: w / 2, y: h - inset };
  return { x: inset, y: h / 2 };
}

/** Rotates a square puzzle by quarter turns clockwise, so its entrance faces any door. */
export function rotatePuzzle(p: PuzzleDef, turns: number): PuzzleDef {
  const q = ((turns % 4) + 4) % 4;
  if (q === 0) return p;
  const size = p.widthPx;
  const point = <T extends { x: number; y: number }>(o: T): T => {
    let { x, y } = o;
    for (let i = 0; i < q; i++) [x, y] = [size - y, x];
    return { ...o, x, y };
  };
  const rect = <T extends { x: number; y: number; w: number; h: number }>(o: T): T => {
    let { x, y, w, h } = o;
    for (let i = 0; i < q; i++) [x, y, w, h] = [size - y - h, x, h, w];
    return { ...o, x, y, w, h };
  };
  return {
    ...p,
    obstacles: p.obstacles.map((o) => (o.kind === 'rect' ? rect(o) : point(o))),
    playerStart: point(p.playerStart),
    exit: point(p.exit),
    elements: p.elements.map((e) =>
      e.kind === 'gate' || e.kind === 'chasm' ? rect(e) : point(e),
    ) as PuzzleDef['elements'],
  };
}

/** The room behind a net node: doors, the entrance, and whether anything is left to fight. */
function netRoomSetup(run: RunState, node: MapNode): RoomSetup {
  const net = run.net as NetProgress;
  const rng = createRng(roomSeed(run, node.id) ^ 0x5eed);
  const cleared = net.cleared.includes(node.id);
  let puzzle = node.type === 'puzzle' ? puzzleFor(run, node) : undefined;
  if (puzzle) {
    // Puzzles are dead ends: turn the layout so its entrance (south) faces the only door.
    const door = (node.doors ?? []).findIndex((n) => n >= 0);
    puzzle = rotatePuzzle(puzzle, door >= 0 ? door - 2 : 0);
  }
  const fight = isFightType(node.type);
  const candidates = ROOMS.filter((r) => r.types.includes(fight ? node.type : 'combat'));
  const template = puzzle
    ? puzzleTemplate(puzzle)
    : (candidates[nextInt(rng, 0, candidates.length)] ?? (ROOMS[0] as RoomTemplateDef));
  const doors = (node.doors ?? []).flatMap((n, d) =>
    n < 0 ? [] : [{ dir: d, ...doorSpot(template, d), locked: doorLocked(node, d) }],
  );
  const encounter =
    cleared || !fight
      ? ({ kind: 'none' } as const)
      : buildEncounter(rng, worldBiome(run.worldId), node.type, node.layer);
  return {
    ...baseSetup(run),
    template,
    encounter,
    ...(puzzle && !cleared ? { puzzle } : {}),
    doors,
    entryDir: net.entryDir,
    keys: net.keys,
    calm: cleared || (!fight && node.type !== 'puzzle'),
  };
}

/** Everything a room takes over from the run, whatever the room. */
function baseSetup(run: RunState): Omit<RoomSetup, 'template' | 'encounter'> {
  return {
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
    armor: run.meta.armor,
  };
}

export function roomSetupFor(run: RunState, node: MapNode): RoomSetup {
  if (run.net) return netRoomSetup(run, node);
  const rng = createRng(roomSeed(run, node.id) ^ 0x5eed);
  const puzzle = node.type === 'puzzle' ? puzzleFor(run, node) : undefined;
  const candidates = ROOMS.filter((r) => r.types.includes(node.type));
  const template = puzzle
    ? puzzleTemplate(puzzle)
    : (candidates[nextInt(rng, 0, candidates.length)] ?? (ROOMS[0] as RoomTemplateDef));
  return {
    template,
    ...(puzzle ? { puzzle } : {}),
    encounter: buildEncounter(rng, worldBiome(run.worldId), node.type, node.layer),
    ...baseSetup(run),
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
  /** Kills per status index in this room (quests). */
  statusKills?: ArrayLike<number>;
  /** No damage taken in this room. */
  flawless?: boolean;
}

export function completeRoom(run: RunState, result: RoomResult): void {
  run.hp = result.hp;
  run.kills += result.kills;
  run.playTimeSec += result.timeSec;
  run.ultCharge = result.ultCharge;
  run.lastSparks = result.lastSparks;
  run.roomsCleared++;
  if (result.flawless) run.tally.flawlessRooms++;
  if (result.statusKills) {
    for (let i = 0; i < result.statusKills.length; i++) {
      const n = result.statusKills[i] ?? 0;
      const status = STATUSES[i]?.id;
      if (n > 0 && status) run.tally.statusKills[status] = (run.tally.statusKills[status] ?? 0) + n;
    }
  }
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
  if (run.net && node) {
    markNetCleared(run, node.id);
    // ROADMAP M6.0b: a solved puzzle hands out the key to the boss wing.
    if (node.type === 'puzzle') run.net.keys++;
  }
}

function markNetCleared(run: RunState, nodeId: number): void {
  if (run.net && !run.net.cleared.includes(nodeId)) run.net.cleared.push(nodeId);
}

/**
 * Leaving a net room without a new clear (walking through a cleared room, or leaving a puzzle
 * unsolved): health, time and shards carry over, nothing else is booked.
 */
export function leaveRoom(run: RunState, result: RoomResult): void {
  run.hp = result.hp;
  run.kills += result.kills;
  run.playTimeSec += result.timeSec;
  run.shards = result.shards;
  run.ultCharge = result.ultCharge;
  run.lastSparks = result.lastSparks;
  run.status = 'map';
}

/** The rooms reachable through the doors of the current net room. */
export function netNeighbours(run: RunState): MapNode[] {
  const node = run.map.nodes[run.currentNodeId];
  return (node?.doors ?? []).flatMap((id) => (id >= 0 ? [run.map.nodes[id] as MapNode] : []));
}

/** Uses keys on doors the sim opened (`dirs` are doors of the current room). */
export function unlockNetDoors(run: RunState, dirs: readonly number[]): void {
  const node = run.map.nodes[run.currentNodeId];
  if (!run.net || !node) return;
  for (const d of dirs) {
    const other = run.map.nodes[node.doors?.[d] ?? -1];
    if (((node.locked ?? 0) & (1 << d)) === 0) continue;
    node.locked = (node.locked ?? 0) & ~(1 << d);
    if (other) other.locked = (other.locked ?? 0) & ~(1 << opposite(d));
    run.net.keys = Math.max(0, run.net.keys - 1);
  }
}

/** Steps through the door `d` of the current net room into its neighbour. */
export function enterNetRoom(run: RunState, d: number): MapNode {
  const node = run.map.nodes[run.currentNodeId];
  const next = run.map.nodes[node?.doors?.[d] ?? -1];
  if (!run.net || !next) throw new Error(`no door ${d} here`);
  run.currentNodeId = next.id;
  if (!run.visited.includes(next.id)) run.visited.push(next.id);
  run.net.entryDir = opposite(d);
  run.rerollSalt = 0;
  run.status = 'room';
  if (next.type === 'boss') run.reachedBoss = true;
  return next;
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
  markNetCleared(run, run.currentNodeId);
}

/** Rest node: heal a fraction of max HP (or evolve the weapon instead, see restEvolve). */
export function rest(run: RunState): number {
  const healed = Math.round(heal(run, run.maxHp * worldBiome(run.worldId).restHealFraction));
  run.roomsCleared++;
  run.status = 'map';
  markNetCleared(run, run.currentNodeId);
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
