import { BEING_IDS } from '../../content/boons/beings';
import { EVENTS } from '../../content/events';
import { RELIC_ECONOMY, RELICS, relicById } from '../../content/relics';
import type { BeingId, EventOutcome, Rarity, RelicRarity, RoomType } from '../../content/schema';
import { TUNING } from '../../content/tuning';
import { compileBuild, healingFactor, type OwnedRelic, type Stats } from '../effects/build';
import { createRng, hashString, nextFloat, nextInt, type Rng } from '../rng/rng';
import type { MapNode } from './map';
import { type BoonOption, rewardBeing, rollBoonOffer } from './rewards';
import type { RunState } from './run-state';

export const MIN_MAX_HP = 20;

export function runStats(run: RunState): Stats {
  return compileBuild(run.boons, run.relics, run.evolutions).stats;
}

/** Recomputes max HP from relics; gains also heal, losses only cap current HP. */
export function applyMaxHp(run: RunState): void {
  const target = Math.max(
    MIN_MAX_HP,
    TUNING.playerMaxHp + run.meta.maxHp + run.maxHpBonus + runStats(run).maxHp,
  );
  const delta = target - run.maxHp;
  run.maxHp = target;
  run.hp = delta > 0 ? Math.min(target, run.hp + delta) : Math.min(target, run.hp);
}

export function heal(run: RunState, amount: number): number {
  const before = run.hp;
  run.hp = Math.min(run.maxHp, run.hp + amount * healingFactor(runStats(run)));
  return run.hp - before;
}

export function addRelic(run: RunState, id: string): void {
  const owned = run.relics.find((r) => r.id === id);
  if (owned) owned.stacks++;
  else run.relics.push({ id, stacks: 1 });
  applyMaxHp(run);
}

export function relicStacks(relics: readonly OwnedRelic[], id: string): number {
  return relics.find((r) => r.id === id)?.stacks ?? 0;
}

// ── Node rewards ──────────────────────────────────────────────────────────

export type NodeReward =
  | { kind: 'boon'; being: BeingId }
  | { kind: 'relic'; rarityBonus: number }
  | { kind: 'shards'; amount: number };

/** What a node grants after its fight (shown on the map). Deterministic per seed and node. */
export function nodeReward(seed: number, node: Pick<MapNode, 'id' | 'type'>): NodeReward | null {
  const rng = createRng(hashString(`${seed}:reward:${node.id}`));
  switch (node.type) {
    case 'combat': {
      const roll = nextFloat(rng);
      if (roll < 0.6) return { kind: 'boon', being: rewardBeing(seed, node.id) };
      if (roll < 0.85) return { kind: 'relic', rarityBonus: 0 };
      return { kind: 'shards', amount: RELIC_ECONOMY.shardsRewardAmount };
    }
    case 'elite':
      // GDD §6.2: elites guarantee a rarer relic.
      return { kind: 'relic', rarityBonus: 1 };
    case 'horde':
    case 'altar':
      return { kind: 'boon', being: rewardBeing(seed, node.id) };
    default:
      return null;
  }
}

/** Shards granted for clearing a room, before the shard-gain bonus. */
export function clearBonusShards(type: RoomType): number {
  if (type === 'elite') return RELIC_ECONOMY.eliteClearShards;
  if (type === 'horde') return RELIC_ECONOMY.hordeClearShards;
  if (type === 'combat') return RELIC_ECONOMY.combatClearShards;
  return 0;
}

function rollRelicRarity(rng: Rng, bonus: number): Exclude<RelicRarity, 'curse'> {
  const e = RELIC_ECONOMY;
  const weights: Array<[Exclude<RelicRarity, 'curse'>, number]> = [
    ['common', Math.max(5, e.weightCommon - bonus * 35)],
    ['rare', e.weightRare + bonus * 20],
    ['epic', e.weightEpic + bonus * 15],
  ];
  let total = 0;
  for (const [, w] of weights) total += w;
  let roll = nextFloat(rng) * total;
  for (const [r, w] of weights) {
    roll -= w;
    if (roll < 0) return r;
  }
  return 'common';
}

/** A random relic of a rarity pool, deterministic for the given rng. */
/** `locked` relics are not in the pool yet (Nix unlocks them, GDD §2.3). */
export function rollRelic(
  rng: Rng,
  pool: RelicRarity,
  exclude: ReadonlySet<string> = new Set(),
  locked: readonly string[] = [],
): string | null {
  const inPool = RELICS.filter((r) => r.rarity === pool && !locked.includes(r.id));
  const candidates = inPool.filter((r) => !exclude.has(r.id));
  const any = candidates.length > 0 ? candidates : inPool;
  return any[nextInt(rng, 0, any.length)]?.id ?? null;
}

/**
 * Three relic choices (never curses; GDD §7.2 curses are never forced). Owned relics may be
 * offered again, which stacks them.
 */
export function rollRelicOffer(
  seed: number,
  nodeId: number,
  rarityBonus: number,
  locked: readonly string[] = [],
): string[] {
  const rng = createRng(hashString(`${seed}:relics:${nodeId}`));
  const picked = new Set<string>();
  for (let tries = 0; picked.size < 3 && tries < 30; tries++) {
    const id = rollRelic(rng, rollRelicRarity(rng, rarityBonus), picked, locked);
    if (id) picked.add(id);
  }
  return [...picked];
}

// ── Shop ──────────────────────────────────────────────────────────────────

export type ShopItem =
  | { kind: 'relic'; id: string; price: number }
  | { kind: 'boon'; being: BeingId; option: BoonOption; price: number }
  | { kind: 'heal'; fraction: number; price: number };

const BOON_PRICE: Record<Rarity, number> = { common: 55, rare: 75, epic: 100, heroic: 130 };
const HEAL_PRICE = 35;
const HEAL_FRACTION = 0.3;
/** Curses are cheap: their price is the risk (GDD §7.2). */
const CURSE_DISCOUNT = 0.6;

export function shopStock(run: RunState, node: Pick<MapNode, 'id'>): ShopItem[] {
  const rng = createRng(hashString(`${run.seed}:shop:${node.id}`));
  const items: ShopItem[] = [];
  const chosen = new Set<string>();
  for (let i = 0; i < 2; i++) {
    const id = rollRelic(rng, rollRelicRarity(rng, 0.5), chosen, run.lockedRelics);
    const def = id ? relicById(id) : undefined;
    if (!id || !def) continue;
    chosen.add(id);
    items.push({ kind: 'relic', id, price: def.price });
  }
  const curse = rollRelic(rng, 'curse', undefined, run.lockedRelics);
  const curseDef = curse ? relicById(curse) : undefined;
  if (curse && curseDef)
    items.push({ kind: 'relic', id: curse, price: Math.round(curseDef.price * CURSE_DISCOUNT) });
  const being = BEING_IDS[nextInt(rng, 0, BEING_IDS.length)] as BeingId;
  const offer = rollBoonOffer(run.seed, node.id + 10_000, being, run.boons, 0.5);
  const option = offer.options[0];
  if (option) items.push({ kind: 'boon', being, option, price: BOON_PRICE[option.rarity] });
  items.push({ kind: 'heal', fraction: HEAL_FRACTION, price: HEAL_PRICE });
  return items;
}

// ── Events ────────────────────────────────────────────────────────────────

export function eventFor(seed: number, nodeId: number) {
  const rng = createRng(hashString(`${seed}:event:${nodeId}`));
  return EVENTS[nextInt(rng, 0, EVENTS.length)] ?? EVENTS[0];
}

/** Applied outcome, resolved for display (e.g. which relic was received). */
export type ResolvedOutcome = EventOutcome & { relicId?: string; healed?: number };

export function applyOutcomes(
  run: RunState,
  nodeId: number,
  optionId: string,
  outcomes: readonly EventOutcome[],
): ResolvedOutcome[] {
  const rng = createRng(hashString(`${run.seed}:outcome:${nodeId}:${optionId}`));
  const results: ResolvedOutcome[] = [];
  for (const o of outcomes) {
    switch (o.type) {
      case 'heal':
        results.push({ ...o, healed: Math.round(heal(run, run.maxHp * o.fraction)) });
        break;
      case 'damage':
        run.hp = Math.max(1, run.hp - o.amount);
        results.push(o);
        break;
      case 'shards':
        run.shards = Math.max(0, run.shards + o.amount);
        results.push(o);
        break;
      case 'maxHp':
        run.maxHpBonus += o.amount;
        applyMaxHp(run);
        results.push(o);
        break;
      case 'relic': {
        const id = rollRelic(rng, o.pool, undefined, run.lockedRelics);
        if (id) addRelic(run, id);
        results.push(id ? { ...o, relicId: id } : o);
        break;
      }
    }
  }
  return results;
}
