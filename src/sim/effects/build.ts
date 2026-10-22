import { boonById, boonValue } from '../../content/boons';
import type { EffectAction, EffectTrigger, Rarity, StatId, StatusId } from '../../content/schema';

/** A boon the player owns, as stored in the run. */
export interface OwnedBoon {
  id: string;
  rarity: Rarity;
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
  boonId: string;
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
  };
}

export function compileBuild(boons: readonly OwnedBoon[]): CompiledBuild {
  const build: CompiledBuild = {
    stats: emptyStats(),
    onHit: [],
    onKill: [],
    onDash: [],
    onPerfectDash: [],
    onDamaged: [],
  };
  for (const owned of boons) {
    const def = boonById(owned.id);
    if (!def) continue;
    const v = (ref: number | string | undefined, fallback = 0): number =>
      ref === undefined
        ? fallback
        : typeof ref === 'number'
          ? ref
          : boonValue(def, ref, owned.rarity);
    for (const e of def.effects) {
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
        boonId: def.id,
        trigger: e.trigger,
        source: e.source ?? 'any',
        chance: v(e.chance, 1),
        minBurnStacks: v(e.condition?.targetBurnStacksAtLeast),
        requireFrozen: e.condition?.targetFrozen === true,
        action,
      });
    }
  }
  return build;
}
