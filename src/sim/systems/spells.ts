import type { SpellDef } from '../../content/schema';
import { SPELLS } from '../../content/spells';
import { areaBurst, type BurstSpec } from '../effects/runtime';
import { Ev, pushEvent } from '../events';
import { PlayerAction } from '../player-state';
import type { SimState } from '../sim';
import { secondsToTicks } from '../time';

/** Cooldown reduction never goes beyond this, so spells stay a decision, not a spam button. */
export const MAX_COOLDOWN_REDUCTION = 0.5;

const spellSpec: BurstSpec = {
  radiusPx: 0,
  damage: 0,
  status: null,
  stacks: 0,
  freeze: false,
  knockback: 0,
  source: 'spell',
};

export function activeSpellDef(state: SimState): SpellDef | undefined {
  return SPELLS[state.player.activeSpell];
}

export function auraSpellDef(state: SimState): SpellDef | undefined {
  return SPELLS[state.player.auraSpell];
}

/** Cooldown of the active spell in ticks, after cooldown reduction. */
export function spellCooldownTicks(state: SimState, def: SpellDef): number {
  const cdr = Math.min(MAX_COOLDOWN_REDUCTION, Math.max(0, state.build.stats.cooldownReduction));
  return Math.max(1, secondsToTicks(def.cooldownSec * (1 - cdr)));
}

export function auraRadiusPx(state: SimState, def: SpellDef): number {
  return def.effect.radiusPx * (1 + state.build.stats.auraRadius);
}

function burst(state: SimState, def: SpellDef, x: number, y: number, radiusPx: number): number {
  const fx = def.effect;
  spellSpec.radiusPx = radiusPx;
  spellSpec.damage = fx.damage;
  spellSpec.status = fx.status ?? null;
  spellSpec.stacks = fx.stacks;
  spellSpec.freeze = fx.freeze;
  spellSpec.knockback = fx.knockback;
  spellSpec.source = def.kind === 'aura' ? 'aura' : 'spell';
  return areaBurst(state, x, y, spellSpec);
}

/**
 * Releases the active spell at the end of its windup (player-actions calls this). The player's
 * current direction (aim-assisted when the cast started) picks the target point.
 */
export function releaseActiveSpell(state: SimState): void {
  const def = activeSpellDef(state);
  if (!def) return;
  const p = state.player;
  const c = state.c;
  const eid = state.playerEid;
  const fx = def.effect;
  const px = c.posX[eid] as number;
  const py = c.posY[eid] as number;
  const x = fx.at === 'target' ? px + p.dirX * fx.rangePx : px;
  const y = fx.at === 'target' ? py + p.dirY * fx.rangePx : py;
  const e = pushEvent(state.events, Ev.SpellCast, x, y);
  if (e) {
    e.value = p.activeSpell;
    e.amount = fx.radiusPx;
    e.dirX = p.dirX;
    e.dirY = p.dirY;
  }
  burst(state, def, x, y, fx.radiusPx);
}

/** Starts the cooldown when the cast begins, so cancelling the windup can't refund it. */
export function startSpellCooldown(state: SimState): void {
  const def = activeSpellDef(state);
  if (!def) return;
  const ticks = spellCooldownTicks(state, def);
  state.player.spellCooldownTicks = ticks;
  state.player.spellCooldownTotal = ticks;
}

/** Spell cooldown and aura pulses (ROADMAP M3.2). Runs after the player's actions. */
export function spellSystem(state: SimState): void {
  const p = state.player;
  const eid = state.playerEid;
  if (eid < 0 || state.gameOver || p.action === PlayerAction.Dead) return;
  const c = state.c;
  if (p.spellCooldownTicks > 0) {
    p.spellCooldownTicks--;
    if (p.spellCooldownTicks === 0 && p.activeSpell >= 0) {
      const e = pushEvent(
        state.events,
        Ev.SpellReady,
        c.posX[eid] as number,
        c.posY[eid] as number,
      );
      if (e) e.value = p.activeSpell;
    }
  }
  const aura = auraSpellDef(state);
  if (!aura) return;
  if (p.auraTimerTicks > 0) {
    p.auraTimerTicks--;
    return;
  }
  p.auraTimerTicks = Math.max(1, secondsToTicks(aura.pulseSec)) - 1;
  const x = c.posX[eid] as number;
  const y = c.posY[eid] as number;
  const radius = auraRadiusPx(state, aura);
  const hits = burst(state, aura, x, y, radius);
  const e = pushEvent(state.events, Ev.AuraPulse, x, y);
  if (e) {
    e.value = p.auraSpell;
    e.amount = radius;
    e.flags = hits;
  }
}
