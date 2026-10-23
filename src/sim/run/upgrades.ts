import { RIFT_SHOT, RIFT_SHOT_UPGRADES } from '../../content/abilities';
import type { SpellDef, UpgradeBranch, UpgradeTree } from '../../content/schema';
import { SPELLS, spellIndex } from '../../content/spells';
import { TUNING } from '../../content/tuning';

/** Spells and the rift shot grow from level 1 to 5 within a run (ROADMAP M3.4). */
export const MAX_UPGRADE_LEVEL = 5;

/** Levels at which the player picks one of two branches. */
export function branchTier(level: number): 'tier3' | 'tier5' | null {
  return level === 3 ? 'tier3' : level === 5 ? 'tier5' : null;
}

/** Level plus the branch picked at level 3 and at level 5 (0 = first option, 1 = second). */
export interface UpgradeState {
  level: number;
  branches: number[];
}

export function branchesUpTo(tree: UpgradeTree, state: UpgradeState): UpgradeBranch[] {
  const out: UpgradeBranch[] = [];
  if (state.level >= 3) {
    const b = tree.tier3[state.branches[0] === 1 ? 1 : 0];
    out.push(b);
  }
  if (state.level >= 5) {
    const b = tree.tier5[state.branches[1] === 1 ? 1 : 0];
    out.push(b);
  }
  return out;
}

/** All upgrade effects folded together: per-level gains plus the chosen branches. */
export interface FoldedMods {
  count: number;
  radiusMult: number;
  damageMult: number;
  stacksAdd: number;
  cooldownMult: number;
  pulseMult: number;
  durationMult: number;
  knockbackMult: number;
  pierce: boolean;
}

export function foldMods(tree: UpgradeTree, state: UpgradeState): FoldedMods {
  const steps = Math.max(0, Math.min(MAX_UPGRADE_LEVEL, state.level) - 1);
  const m: FoldedMods = {
    count: 0,
    radiusMult: 1 + TUNING.upgradeLevelRadius * steps,
    damageMult: 1 + TUNING.upgradeLevelDamage * steps,
    stacksAdd: 0,
    cooldownMult: Math.max(0.5, 1 - TUNING.upgradeLevelCooldown * steps),
    pulseMult: Math.max(0.5, 1 - TUNING.upgradeLevelCooldown * steps),
    durationMult: 1,
    knockbackMult: 1,
    pierce: false,
  };
  for (const b of branchesUpTo(tree, state)) {
    const mods = b.mods;
    m.count += mods.count ?? 0;
    m.radiusMult *= mods.radiusMult ?? 1;
    m.damageMult *= mods.damageMult ?? 1;
    m.stacksAdd += mods.stacksAdd ?? 0;
    m.cooldownMult *= mods.cooldownMult ?? 1;
    m.pulseMult *= mods.pulseMult ?? 1;
    m.durationMult *= mods.durationMult ?? 1;
    m.knockbackMult *= mods.knockbackMult ?? 1;
    m.pierce = m.pierce || mods.pierce === true;
  }
  return m;
}

/**
 * A spell with its upgrades applied, computed once when the room starts, so the sim reads plain
 * numbers every tick.
 */
export interface ResolvedSpell {
  index: number;
  def: SpellDef;
  level: number;
  damage: number;
  /** Area radius; half the width for beams. */
  radiusPx: number;
  stacks: number;
  knockback: number;
  cooldownSec: number;
  pulseSec: number;
  durationSec: number;
  /** Extra impacts (echo, shower, more clouds, more beams, more shots dissolved). */
  extra: number;
}

export function resolveSpell(id: string, state: UpgradeState): ResolvedSpell | null {
  const index = spellIndex(id);
  const def = SPELLS[index];
  if (!def) return null;
  const m = foldMods(def.upgrades, state);
  const fx = def.effect;
  const base =
    fx.type === 'ward'
      ? { damage: 0, radius: fx.radiusPx, stacks: 0, knockback: 0 }
      : {
          damage: fx.damage,
          radius: fx.type === 'beam' ? fx.widthPx / 2 : fx.radiusPx,
          stacks: fx.stacks,
          knockback: fx.knockback,
        };
  return {
    index,
    def,
    level: state.level,
    damage: base.damage * m.damageMult,
    radiusPx: base.radius * m.radiusMult,
    stacks: base.stacks > 0 ? base.stacks + m.stacksAdd : 0,
    knockback: base.knockback * m.knockbackMult,
    cooldownSec: def.cooldownSec * m.cooldownMult,
    pulseSec: def.pulseSec * m.pulseMult,
    durationSec: fx.type === 'zone' ? fx.durationSec * m.durationMult : 0,
    extra: m.count,
  };
}

/** The rift shot with its upgrades applied. */
export interface ResolvedCast {
  level: number;
  damage: number;
  radiusPx: number;
  knockback: number;
  rechargeSec: number;
  /** Shots per cast (fanned out). */
  shots: number;
  pierce: boolean;
}

export function resolveCast(state: UpgradeState): ResolvedCast {
  const m = foldMods(RIFT_SHOT_UPGRADES, state);
  return {
    level: state.level,
    damage: RIFT_SHOT.damage * m.damageMult,
    radiusPx: RIFT_SHOT.radiusPx * m.radiusMult,
    knockback: RIFT_SHOT.knockback * m.knockbackMult,
    rechargeSec: RIFT_SHOT.rechargeSec * m.cooldownMult,
    shots: 1 + m.count,
    pierce: m.pierce,
  };
}

// ── Upgrade rewards (Runenfragment, Glutsplitter) ────────────────────────────

export type UpgradeTarget = 'active' | 'aura' | 'cast';

/** Boons stop growing here; their value gains shrink per level anyway (TUNING.boonLevelSteps). */
export const MAX_BOON_LEVEL = 3;

/** One card of an upgrade offer. Branch levels come as two cards, one per branch. */
export type UpgradeOption =
  | { kind: 'level'; target: UpgradeTarget; level: number; branch: number | null }
  | { kind: 'boon'; boonId: string; level: number };
