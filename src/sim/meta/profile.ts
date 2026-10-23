import { EMBER_TREE, treeNodeById } from '../../content/meta/ember-tree';
import { META_REWARDS } from '../../content/meta/rewards';
import { RELICS, relicById } from '../../content/relics';
import type { BeingId } from '../../content/schema';
import { dominantBeing } from '../effects/build';
import type { RunState } from '../run/run-state';

/** How the last run ended; drives hub dialogue (GDD §2.6) and the result screen. */
export interface LastRun {
  result: 'won' | 'lost';
  roomsCleared: number;
  kills: number;
  timeSec: number;
  /** Enemy id that dealt the final blow, if any. */
  killedBy: string | null;
  dominant: BeingId | null;
  reachedBoss: boolean;
  ember: number;
  dust: number;
}

/**
 * Meta progression that survives every run (GDD §8). Plain JSON, stored separately from the
 * run and the settings (TECH_DESIGN §11).
 */
export interface Profile {
  ember: number;
  dust: number;
  /** Ember Tree ranks by node id. */
  tree: Record<string, number>;
  /** Relics bought into the pool at Nix. */
  relicsUnlocked: string[];
  runs: number;
  wins: number;
  bestRooms: number;
  seenDialogue: string[];
  flags: string[];
  lastRun: LastRun | null;
}

export function createProfile(): Profile {
  return {
    ember: 0,
    dust: 0,
    tree: {},
    relicsUnlocked: [],
    runs: 0,
    wins: 0,
    bestRooms: 0,
    seenDialogue: [],
    flags: [],
    lastRun: null,
  };
}

export function treeRank(profile: Profile, id: string): number {
  return profile.tree[id] ?? 0;
}

export type BuyCheck = 'ok' | 'maxed' | 'locked' | 'ember' | 'dust' | 'unknown';

/** Whether the next rank of a node can be bought right now, and if not, why. */
export function canBuyRank(profile: Profile, id: string): BuyCheck {
  const node = treeNodeById(id);
  if (!node) return 'unknown';
  const rank = treeRank(profile, id);
  const cost = node.ranks[rank];
  if (!cost) return 'maxed';
  if (node.requires && treeRank(profile, node.requires) < 1) return 'locked';
  if (profile.ember < cost.ember) return 'ember';
  if (profile.dust < cost.dust) return 'dust';
  return 'ok';
}

export function buyRank(profile: Profile, id: string): boolean {
  if (canBuyRank(profile, id) !== 'ok') return false;
  const node = treeNodeById(id);
  const cost = node?.ranks[treeRank(profile, id)];
  if (!cost) return false;
  profile.ember -= cost.ember;
  profile.dust -= cost.dust;
  profile.tree[id] = treeRank(profile, id) + 1;
  return true;
}

/** Free respec (GDD §8.2): every rank is refunded in full. */
export function respec(profile: Profile): void {
  for (const node of EMBER_TREE) {
    const rank = treeRank(profile, node.id);
    for (let r = 0; r < rank; r++) {
      profile.ember += node.ranks[r]?.ember ?? 0;
      profile.dust += node.ranks[r]?.dust ?? 0;
    }
  }
  profile.tree = {};
}

/** Relics that are not in the pool yet (they need an unlock at Nix). */
export function lockedRelics(profile: Profile): string[] {
  return RELICS.filter(
    (r) => r.unlockCost !== undefined && !profile.relicsUnlocked.includes(r.id),
  ).map((r) => r.id);
}

export function unlockRelic(profile: Profile, id: string): boolean {
  const cost = relicById(id)?.unlockCost;
  if (cost === undefined || profile.relicsUnlocked.includes(id) || profile.dust < cost)
    return false;
  profile.dust -= cost;
  profile.relicsUnlocked.push(id);
  return true;
}

/** Permanent bonuses a run starts with, snapshotted so later purchases don't change it. */
export interface RunMeta {
  maxHp: number;
  allDamage: number;
  staminaRegen: number;
  roomHeal: number;
  startShards: number;
  lastSparks: number;
  /** Fraction of max HP restored by the last spark (0 = survive with 1 HP). */
  lastSparkHeal: number;
  rerolls: number;
  staminaBonus: number;
}

export function emptyRunMeta(): RunMeta {
  return {
    maxHp: 0,
    allDamage: 0,
    staminaRegen: 0,
    roomHeal: 0,
    startShards: 0,
    lastSparks: 0,
    lastSparkHeal: 0,
    rerolls: 0,
    staminaBonus: 0,
  };
}

export function runMetaFor(profile: Profile): RunMeta {
  const meta = emptyRunMeta();
  for (const node of EMBER_TREE) {
    const rank = Math.min(treeRank(profile, node.id), node.ranks.length);
    if (rank === 0) continue;
    const e = node.effect;
    switch (e.kind) {
      case 'stat':
        if (e.stat === 'maxHp') meta.maxHp += e.perRank * rank;
        else if (e.stat === 'allDamage') meta.allDamage += e.perRank * rank;
        else if (e.stat === 'staminaRegen') meta.staminaRegen += e.perRank * rank;
        break;
      case 'startShards':
        meta.startShards += e.perRank * rank;
        break;
      case 'roomHeal':
        meta.roomHeal += e.perRank * rank;
        break;
      case 'lastSpark':
        meta.lastSparks = 1;
        meta.lastSparkHeal = e.healPerRank[rank - 1] ?? 0;
        break;
      case 'boonReroll':
        meta.rerolls += e.perRank * rank;
        break;
      case 'staminaSegment':
        meta.staminaBonus += e.perRank * rank;
        break;
    }
  }
  return meta;
}

/** Ember the player still needs for the cheapest next rank, for the "almost there" bar. */
export function nextGoal(profile: Profile): { nodeId: string; ember: number } | null {
  let best: { nodeId: string; ember: number } | null = null;
  for (const node of EMBER_TREE) {
    const cost = node.ranks[treeRank(profile, node.id)];
    if (!cost || (node.requires && treeRank(profile, node.requires) < 1)) continue;
    if (!best || cost.ember < best.ember) best = { nodeId: node.id, ember: cost.ember };
  }
  return best;
}

/** What a run pays out: per cleared room by type, per kills, plus a win bonus (GDD §8.1). */
export function runEarnings(
  rooms: { combat: number; elite: number; boss: number },
  kills: number,
  won: boolean,
): { ember: number; dust: number } {
  const r = META_REWARDS;
  return {
    ember:
      rooms.combat * r.emberPerRoom +
      rooms.elite * r.emberPerElite +
      rooms.boss * r.emberPerBoss +
      Math.floor(kills / r.killsPerEmber) +
      (won ? r.emberWinBonus : 0),
    dust: rooms.elite * r.dustPerElite + rooms.boss * r.dustPerBoss,
  };
}

/** Books a finished run into the profile. */
export function recordRun(profile: Profile, last: LastRun): void {
  profile.runs++;
  if (last.result === 'won') profile.wins++;
  profile.bestRooms = Math.max(profile.bestRooms, last.roomsCleared);
  profile.ember += last.ember;
  profile.dust += last.dust;
  profile.lastRun = last;
}

/**
 * Ends a run for the meta layer: pays out Glut and Rissstaub (also on death, GDD §8.1) and
 * records how it ended for dialogue and the result screen.
 */
export function settleRun(
  profile: Profile,
  run: RunState,
  result: 'won' | 'lost',
  killedBy: string | null,
): LastRun {
  const earned = runEarnings(
    { combat: run.clearedCombat, elite: run.clearedElite, boss: run.clearedBoss },
    run.kills,
    result === 'won',
  );
  const last: LastRun = {
    result,
    roomsCleared: run.roomsCleared,
    kills: run.kills,
    timeSec: Math.round(run.playTimeSec),
    killedBy: result === 'won' ? null : killedBy,
    dominant: dominantBeing(run.boons),
    reachedBoss: run.reachedBoss,
    ember: earned.ember,
    dust: earned.dust,
  };
  recordRun(profile, last);
  return last;
}
