import { boonById, boonValue } from '../../content/boons';
import { relicById, relicValue } from '../../content/relics';
import type {
  EffectAction,
  EffectDef,
  EffectTrigger,
  Rarity,
  StatId,
  StatusId,
} from '../../content/schema';

/** A boon the player owns, as stored in the run. */
export interface OwnedBoon {
  id: string;
  rarity: Rarity;
}

/** A relic the player owns; duplicates stack instead of adding entries. */
export interface OwnedRelic {
  id: string;
  stacks: number;
}

/** Effect action with all value references resolved to numbers for the owned rarity. */
export type ResolvedAction =
  | { type: 'applyStatus'; status: StatusId; stacks: number }
  | {
      type: 'nova';
      at: 'player' | 'target';
      radiusPx: number;
      damage: number;
      status: StatusId | null;
      stacks: number;
      freeze: boolean;
    }
  | { type: 'heal'; amount: number }
  | { type: 'refundStamina'; amount: number };

export interface CompiledEffect {
  /** Boon or relic id, for debugging and UI. */
  sourceId: string;
  trigger: EffectTrigger;
  source: 'attack' | 'special' | 'any';
  chance: number;
  minBurnStacks: number;
  requireFrozen: boolean;
  action: ResolvedAction;
}

export type Stats = Record<StatId, number>;

/**
 * The player's build compiled for fast lookup during combat: summed stat bonuses plus
 * trigger lists. Rebuilt only when boons change, never per tick.
 */
export interface CompiledBuild {
  stats: Stats;
  onHit: CompiledEffect[];
  onKill: CompiledEffect[];
  onDash: CompiledEffect[];
  onPerfectDash: CompiledEffect[];
  onDamaged: CompiledEffect[];
  onRoomClear: CompiledEffect[];
}

export function emptyStats(): Stats {
  return {
    attackDamage: 0,
    specialDamage: 0,
    damageVsBurning: 0,
    damageVsFrozen: 0,
    damageVsChilledPerStack: 0,
    burnDamage: 0,
    freezeDuration: 0,
    allDamage: 0,
    critChance: 0,
    critDamage: 0,
    moveSpeed: 0,
    staminaRegen: 0,
    maxHp: 0,
    healing: 0,
    shardGain: 0,
  };
}

type Resolve = (ref: number | string | undefined, fallback?: number) => number;

function addEffects(
  build: CompiledBuild,
  sourceId: string,
  effects: readonly EffectDef[],
  v: Resolve,
): void {
  for (const e of effects) {
    if (e.kind === 'stat') {
      build.stats[e.stat] += v(e.add);
      continue;
    }
    const a: EffectAction = e.action;
    let action: ResolvedAction;
    if (a.type === 'applyStatus')
      action = { type: 'applyStatus', status: a.status, stacks: v(a.stacks) };
    else if (a.type === 'nova') {
      action = {
        type: 'nova',
        at: a.at,
        radiusPx: v(a.radiusPx),
        damage: v(a.damage),
        status: a.status ?? null,
        stacks: v(a.stacks),
        freeze: a.freeze === true,
      };
    } else if (a.type === 'heal') action = { type: 'heal', amount: v(a.amount) };
    else action = { type: 'refundStamina', amount: v(a.amount) };
    build[e.trigger].push({
      sourceId,
      trigger: e.trigger,
      source: e.source ?? 'any',
      chance: v(e.chance, 1),
      minBurnStacks: v(e.condition?.targetBurnStacksAtLeast),
      requireFrozen: e.condition?.targetFrozen === true,
      action,
    });
  }
}

export function compileBuild(
  boons: readonly OwnedBoon[],
  relics: readonly OwnedRelic[] = [],
): CompiledBuild {
  const build: CompiledBuild = {
    stats: emptyStats(),
    onHit: [],
    onKill: [],
    onDash: [],
    onPerfectDash: [],
    onDamaged: [],
    onRoomClear: [],
  };
  for (const owned of boons) {
    const def = boonById(owned.id);
    if (!def) continue;
    addEffects(build, def.id, def.effects, (ref, fallback = 0) =>
      ref === undefined
        ? fallback
        : typeof ref === 'number'
          ? ref
          : boonValue(def, ref, owned.rarity),
    );
  }
  for (const owned of relics) {
    const def = relicById(owned.id);
    if (!def || owned.stacks <= 0) continue;
    addEffects(build, def.id, def.effects, (ref, fallback = 0) =>
      ref === undefined
        ? fallback
        : typeof ref === 'number'
          ? ref
          : relicValue(def, ref, owned.stacks),
    );
  }
  return build;
}

/** Healing multiplier from the build; curses can reduce it but never below 10 %. */
export function healingFactor(stats: Stats): number {
  return Math.max(0.1, 1 + stats.healing);
}
