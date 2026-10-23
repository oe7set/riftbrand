import { rarityIndex } from '../../content/boons';
import { ENEMIES } from '../../content/enemies';
import { relicById } from '../../content/relics';
import { createInputFrame } from '../../shared/input-frame';
import { DEALT_SOURCES } from '../combat/dealt';
import { dominantBeing } from '../effects/build';
import { emptyRunMeta, type RunMeta } from '../meta/profile';
import {
  addRelic,
  applyOutcomes,
  applyUpgrade,
  equipRunSpell,
  eventFor,
  eventOptionAvailable,
  heal,
  nodeReward,
  rollRelicOffer,
  rollSpellOffer,
  rollUpgradeOffer,
  runStats,
  shopStock,
} from '../run/economy';
import type { MapNode } from '../run/map';
import {
  availableEvolutions,
  availableNodes,
  completeNonCombat,
  completeRoom,
  createRun,
  enterNode,
  evolve,
  failRun,
  offerFor,
  pickBoon,
  type RoomResult,
  type RunState,
  rest,
  roomSeed,
  roomSetupFor,
} from '../run/run-state';
import { createSim, type SimState, stepSim } from '../sim';
import { TICK_RATE_HZ } from '../time';
import { type BotStrategy, botInput, createBotMemory } from './bot';

/** Rooms that take longer than this count as a loss (the bot got stuck or can't win). */
const MAX_ROOM_SEC = 240;

export interface RoomReport {
  type: MapNode['type'];
  layer: number;
  timeSec: number;
  damageTaken: number;
  cleared: boolean;
}

/** One simulated run; also the shape of the in-game run log entries. */
export interface RunReport {
  seed: number;
  strategy: BotStrategy;
  result: 'won' | 'lost' | 'timeout';
  roomsCleared: number;
  kills: number;
  timeSec: number;
  killedBy: string | null;
  dominant: string | null;
  boons: string[];
  relics: string[];
  evolutions: string[];
  /** Spells equipped at the end of the run. */
  spells: string[];
  rooms: RoomReport[];
  /** Damage taken per enemy id over the whole run. */
  damageBySource: Record<string, number>;
  /** Damage dealt per player source (attack, special, cast, spell, aura, status …). */
  damageDealt: Record<string, number>;
}

function addDamage(report: RunReport, sim: SimState): number {
  let total = 0;
  for (let i = 0; i < sim.damageBySource.length; i++) {
    const amount = sim.damageBySource[i] as number;
    if (amount <= 0) continue;
    total += amount;
    const id = ENEMIES[i]?.id ?? 'unknown';
    report.damageBySource[id] = (report.damageBySource[id] ?? 0) + amount;
  }
  return total;
}

function addDealt(report: RunReport, sim: SimState): void {
  for (let i = 0; i < DEALT_SOURCES.length; i++) {
    const amount = sim.damageDealt[i] as number;
    if (amount <= 0) continue;
    const id = DEALT_SOURCES[i] as string;
    report.damageDealt[id] = (report.damageDealt[id] ?? 0) + amount;
  }
}

function pickNode(run: RunState): MapNode | undefined {
  const options = availableNodes(run);
  // A balanced route: heal when low, otherwise prefer fights for rewards.
  const low = run.hp < run.maxHp * 0.45;
  const score = (n: MapNode) =>
    n.type === 'rest' ? (low ? 5 : 1) : n.type === 'elite' ? (low ? 0 : 3) : 2;
  let best = options[0];
  for (const n of options) if (best && score(n) > score(best)) best = n;
  return best;
}

/** Bot reward choices: highest rarity boon, first relic, sensible shop and event picks. */
function takeBoon(run: RunState, node: MapNode): void {
  const offer = offerFor(run, node);
  if (!offer) return;
  let best = offer.options[0];
  for (const o of offer.options) {
    if (best && rarityIndex(o.rarity) > rarityIndex(best.rarity)) best = o;
  }
  if (best) pickBoon(run, best);
}

function grantReward(run: RunState, node: MapNode): void {
  const reward = nodeReward(run.seed, node);
  if (reward?.kind === 'boon') takeBoon(run, node);
  else if (reward?.kind === 'relic') {
    const id = rollRelicOffer(run.seed, node.id, reward.rarityBonus, run.lockedRelics)[0];
    if (id) addRelic(run, id);
  } else if (reward?.kind === 'upgrade') {
    const option = rollUpgradeOffer(run, node.id)[0];
    if (option) applyUpgrade(run, option);
  } else if (reward?.kind === 'spell') {
    // Simple preference: the first offered spell (the offer is already random per seed).
    const id = rollSpellOffer(run, node.id)[0];
    if (id) equipRunSpell(run, id);
  } else if (reward?.kind === 'shards') {
    run.shards += Math.round(reward.amount * (1 + runStats(run).shardGain));
  }
}

function visitShop(run: RunState, node: MapNode): void {
  const stock = shopStock(run, node);
  for (let i = 0; i < stock.length; i++) {
    const item = stock[i];
    if (!item || run.shards < item.price) continue;
    // Bots never take curses on purpose; healing only when hurt.
    if (item.kind === 'relic' && relicById(item.id)?.rarity === 'curse') continue;
    if (item.kind === 'heal' && run.hp > run.maxHp * 0.6) continue;
    // Spells only come from fight rewards for the bot; shop shards go to power and healing.
    if (item.kind === 'spell') continue;
    run.shards -= item.price;
    run.shopBought.push(i);
    if (item.kind === 'relic') addRelic(run, item.id);
    else if (item.kind === 'boon') pickBoon(run, item.option);
    else if (item.kind === 'heal') heal(run, run.maxHp * item.fraction);
  }
  completeNonCombat(run);
}

function playRoom(
  run: RunState,
  node: MapNode,
  strategy: BotStrategy,
  report: RunReport,
): 'cleared' | 'died' | 'timeout' {
  const sim = createSim(roomSeed(run, node.id), roomSetupFor(run, node));
  const input = createInputFrame();
  const memory = createBotMemory();
  const maxTicks = MAX_ROOM_SEC * TICK_RATE_HZ;
  let outcome: 'cleared' | 'died' | 'timeout' = 'timeout';
  for (let t = 0; t < maxTicks; t++) {
    botInput(sim, strategy, memory, input);
    stepSim(sim, input);
    // Nobody reads events headless; keep the ring buffer from filling up.
    sim.events.count = 0;
    if (sim.gameOver) {
      outcome = 'died';
      break;
    }
    if (sim.room.exitReached) {
      outcome = 'cleared';
      break;
    }
  }
  const result: RoomResult = {
    hp: sim.c.hp[sim.playerEid] ?? 0,
    kills: sim.player.kills,
    timeSec: sim.room.elapsedTicks / TICK_RATE_HZ,
    shards: sim.shards,
    ultCharge: sim.player.ultCharge,
    lastSparks: sim.lastSparks,
  };
  report.rooms.push({
    type: node.type,
    layer: node.layer,
    timeSec: result.timeSec,
    damageTaken: addDamage(report, sim),
    cleared: outcome === 'cleared',
  });
  addDealt(report, sim);
  if (outcome === 'cleared') {
    completeRoom(run, result);
    if (run.status !== 'won') grantReward(run, node);
  } else {
    failRun(run, result);
    if (outcome === 'died') report.killedBy = ENEMIES[sim.killedBy]?.id ?? null;
  }
  return outcome;
}

/**
 * Plays a whole run headless with a bot (TECH_DESIGN §13). Deterministic: same seed, strategy
 * and meta give the same report.
 */
export function autoplayRun(
  seed: number,
  strategy: BotStrategy = 'balanced',
  meta: RunMeta = emptyRunMeta(),
  lockedRelics: readonly string[] = [],
): RunReport {
  const run = createRun(seed, meta, lockedRelics);
  const report: RunReport = {
    seed: run.seed,
    strategy,
    result: 'lost',
    roomsCleared: 0,
    kills: 0,
    timeSec: 0,
    killedBy: null,
    dominant: null,
    boons: [],
    relics: [],
    evolutions: [],
    spells: [],
    rooms: [],
    damageBySource: {},
    damageDealt: {},
  };
  while (run.status === 'map') {
    const node = pickNode(run);
    if (!node) break;
    enterNode(run, node.id);
    if (node.type === 'rest') {
      const evo = availableEvolutions(run)[0];
      if (evo && run.hp > run.maxHp * 0.6) {
        evolve(run, evo);
        completeNonCombat(run);
      } else rest(run);
    } else if (node.type === 'altar') {
      const evo = availableEvolutions(run)[0];
      if (evo) evolve(run, evo);
      takeBoon(run, node);
      completeNonCombat(run);
    } else if (node.type === 'shop') visitShop(run, node);
    else if (node.type === 'event') {
      const event = eventFor(run.seed, node.id);
      const option = event?.options.find((o) => eventOptionAvailable(run, o));
      if (event && option) applyOutcomes(run, node.id, option.id, option.outcomes);
      completeNonCombat(run);
    } else {
      const outcome = playRoom(run, node, strategy, report);
      if (outcome === 'timeout') report.result = 'timeout';
    }
  }
  if (run.status === 'won') report.result = 'won';
  report.roomsCleared = run.roomsCleared;
  report.kills = run.kills;
  report.timeSec = Math.round(run.playTimeSec);
  report.dominant = dominantBeing(run.boons);
  report.boons = run.boons.map((b) => b.id);
  report.relics = run.relics.map((r) => r.id);
  report.evolutions = [...run.evolutions];
  report.spells = [run.spells.active?.id, run.spells.aura?.id].filter(
    (id): id is string => id !== undefined,
  );
  return report;
}
