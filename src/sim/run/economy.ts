import { boonById } from '../../content/boons';
import { BEING_IDS } from '../../content/boons/beings';
import { EVENTS } from '../../content/events';
import { MATERIAL_DROPS, MATERIALS } from '../../content/materials';
import { RELIC_ECONOMY, RELICS, relicById } from '../../content/relics';
import type { BeingId, EventOutcome, Rarity, RelicRarity, RoomType } from '../../content/schema';
import { SPELLS, spellById } from '../../content/spells';
import { TUNING } from '../../content/tuning';
import { compileBuild, healingFactor, type OwnedRelic, type Stats } from '../effects/build';
import { createRng, hashString, nextFloat, nextInt, type Rng } from '../rng/rng';
import type { MapNode } from './map';
import { type BoonOption, rewardBeing, rollBoonOffer } from './rewards';
import type { RunState } from './run-state';
import {
  branchTier,
  MAX_BOON_LEVEL,
  MAX_UPGRADE_LEVEL,
  type UpgradeOption,
  type UpgradeState,
  type UpgradeTarget,
} from './upgrades';

export const MIN_MAX_HP = 20;

export function runStats(run: RunState): Stats {
  return compileBuild(run.boons, run.relics, run.evolutions, run.meta.armor).stats;
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
  | { kind: 'spell' }
  | { kind: 'upgrade' }
  | { kind: 'relic'; rarityBonus: number }
  | { kind: 'shards'; amount: number };

/** What a node grants after its fight (shown on the map). Deterministic per seed and node. */
export function nodeReward(seed: number, node: Pick<MapNode, 'id' | 'type'>): NodeReward | null {
  const rng = createRng(hashString(`${seed}:reward:${node.id}`));
  switch (node.type) {
    case 'combat': {
      const roll = nextFloat(rng);
      if (roll < 0.45) return { kind: 'boon', being: rewardBeing(seed, node.id) };
      if (roll < 0.55) return { kind: 'spell' };
      if (roll < 0.7) return { kind: 'upgrade' };
      if (roll < 0.88) return { kind: 'relic', rarityBonus: 0 };
      return { kind: 'shards', amount: RELIC_ECONOMY.shardsRewardAmount };
    }
    case 'duel':
      // ROADMAP M3.5: a duel always pays out in power for what the player already has.
      return { kind: 'upgrade' };
    case 'elite':
      // GDD §6.2: elites guarantee a rarer relic.
      return { kind: 'relic', rarityBonus: 1 };
    case 'horde':
      // GDD §6.2: hordes improve what the player already has.
      return { kind: 'upgrade' };
    case 'altar':
      return { kind: 'boon', being: rewardBeing(seed, node.id) };
    case 'puzzle':
      // ROADMAP M6.0: a solved puzzle opens a chest with a relic.
      return { kind: 'relic', rarityBonus: 0 };
    default:
      return null;
  }
}

/** Shards granted for clearing a room, before the shard-gain bonus. */
/**
 * Materials a cleared room drops (ROADMAP M5.3), drawn from the world's materials by weight.
 * `rng` comes from the room seed, so a reload drops the same.
 */
export function rollRoomMaterials(
  rng: Rng,
  worldId: string,
  type: RoomType,
): Record<string, number> {
  const d = MATERIAL_DROPS;
  let count = 0;
  if (type === 'combat' || type === 'horde') count = nextFloat(rng) < d.combatChance ? 1 : 0;
  else if (type === 'elite') count = nextInt(rng, d.eliteMin, d.eliteMax + 1);
  else if (type === 'duel') count = nextInt(rng, d.duelMin, d.duelMax + 1);
  else if (type === 'puzzle') count = nextInt(rng, d.puzzleMin, d.puzzleMax + 1);
  else if (type === 'boss') count = nextInt(rng, d.bossMin, d.bossMax + 1);
  const pool = MATERIALS.filter((m) => m.world === worldId);
  const total = pool.reduce((sum, m) => sum + m.weight, 0);
  const found: Record<string, number> = {};
  for (let i = 0; i < count && total > 0; i++) {
    let roll = nextFloat(rng) * total;
    for (const m of pool) {
      roll -= m.weight;
      if (roll < 0) {
        found[m.id] = (found[m.id] ?? 0) + 1;
        break;
      }
    }
  }
  return found;
}

export function clearBonusShards(type: RoomType): number {
  if (type === 'elite' || type === 'duel') return RELIC_ECONOMY.eliteClearShards;
  if (type === 'horde') return RELIC_ECONOMY.hordeClearShards;
  if (type === 'combat' || type === 'puzzle') return RELIC_ECONOMY.combatClearShards;
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

// ── Spells (ROADMAP M3.3) ─────────────────────────────────────────────────

/** Three spells the player doesn't have equipped, deterministic per seed and node. */
export function rollSpellOffer(run: RunState, nodeId: number, count = 3): string[] {
  const rng = createRng(hashString(`${run.seed}:spells:${nodeId}`));
  const owned = new Set([run.spells.active?.id, run.spells.aura?.id]);
  const pool = SPELLS.filter((s) => !owned.has(s.id)).map((s) => s.id);
  const picked: string[] = [];
  while (picked.length < count && pool.length > 0) {
    const [id] = pool.splice(nextInt(rng, 0, pool.length), 1);
    if (id) picked.push(id);
  }
  return picked;
}

/**
 * Puts a spell into the slot of its kind. The replaced spell's level carries over, so trading
 * a spell never throws away upgrades (ROADMAP M3.3).
 */
export function equipRunSpell(run: RunState, id: string): void {
  const def = spellById(id);
  if (!def) return;
  const slot = def.kind === 'active' ? run.spells.active : run.spells.aura;
  const next = { id, level: slot?.level ?? 1, branches: [...(slot?.branches ?? [])] };
  if (def.kind === 'active') run.spells.active = next;
  else run.spells.aura = next;
}

// ── Upgrades (ROADMAP M3.4) ───────────────────────────────────────────────

function upgradeStateOf(run: RunState, target: UpgradeTarget): UpgradeState | null {
  if (target === 'cast') return run.cast;
  return target === 'active' ? run.spells.active : run.spells.aura;
}

/** Every upgrade the player could take now, grouped so both branches of a level stay together. */
function upgradeGroups(run: RunState): UpgradeOption[][] {
  const groups: UpgradeOption[][] = [];
  for (const target of ['active', 'aura', 'cast'] as const) {
    const state = upgradeStateOf(run, target);
    if (!state || state.level >= MAX_UPGRADE_LEVEL) continue;
    const level = state.level + 1;
    groups.push(
      branchTier(level)
        ? [
            { kind: 'level', target, level, branch: 0 },
            { kind: 'level', target, level, branch: 1 },
          ]
        : [{ kind: 'level', target, level, branch: null }],
    );
  }
  for (const b of run.boons) {
    const def = boonById(b.id);
    const level = b.level ?? 1;
    // Duo boons are prizes of their own; they don't grow.
    if (!def || def.partner || level >= MAX_BOON_LEVEL) continue;
    groups.push([{ kind: 'boon', boonId: b.id, level: level + 1 }]);
  }
  return groups;
}

/**
 * Three (or four, when a branch pair is drawn) upgrade cards, deterministic per seed and node.
 * Spell and rift shot upgrades come before boon levels, so the new systems show up early.
 */
export function rollUpgradeOffer(run: RunState, nodeId: number): UpgradeOption[] {
  const rng = createRng(hashString(`${run.seed}:upgrades:${nodeId}`));
  const groups = upgradeGroups(run);
  const abilities = groups.filter((g) => g[0]?.kind === 'level');
  const boons = groups.filter((g) => g[0]?.kind === 'boon');
  const pick = (pool: UpgradeOption[][]) => pool.splice(nextInt(rng, 0, pool.length), 1)[0] ?? [];
  const out: UpgradeOption[] = [];
  while (out.length < 3 && abilities.length > 0) out.push(...pick(abilities));
  while (out.length < 3 && boons.length > 0) out.push(...pick(boons));
  return out;
}

export function applyUpgrade(run: RunState, option: UpgradeOption): void {
  if (option.kind === 'boon') {
    const owned = run.boons.find((b) => b.id === option.boonId);
    if (owned) owned.level = option.level;
    applyMaxHp(run);
    return;
  }
  const state = upgradeStateOf(run, option.target);
  if (!state || option.level !== state.level + 1) return;
  state.level = option.level;
  if (option.branch !== null) state.branches[option.level === 3 ? 0 : 1] = option.branch;
}

// ── Shop ──────────────────────────────────────────────────────────────────

export type ShopItem =
  | { kind: 'relic'; id: string; price: number }
  | { kind: 'boon'; being: BeingId; option: BoonOption; price: number }
  | { kind: 'heal'; fraction: number; price: number }
  | { kind: 'spell'; id: string; price: number };

const BOON_PRICE: Record<Rarity, number> = { common: 55, rare: 75, epic: 100, heroic: 130 };
const HEAL_PRICE = 35;
const SPELL_PRICE = 90;
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
  const spell = rollSpellOffer(run, node.id + 20_000, 1)[0];
  if (spell) items.push({ kind: 'spell', id: spell, price: SPELL_PRICE });
  items.push({ kind: 'heal', fraction: HEAL_FRACTION, price: HEAL_PRICE });
  return items;
}

// ── Events ────────────────────────────────────────────────────────────────

/** Whether an event option can be chosen right now (shard and HP requirements). */
export function eventOptionAvailable(
  run: Pick<RunState, 'shards' | 'hp'>,
  option: { requiresShards?: number; requiresHpAbove?: number },
): boolean {
  if (option.requiresShards !== undefined && run.shards < option.requiresShards) return false;
  return option.requiresHpAbove === undefined || run.hp > option.requiresHpAbove;
}

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
