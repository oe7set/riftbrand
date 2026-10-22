import { TUNING } from '../../content/tuning';
import { queryRect } from '../collision/spatial-hash';
import { damageEnemy, type PlayerHitSpec } from '../combat/damage';
import { C } from '../ecs/components';
import { Ev, pushEvent, StatusCode } from '../events';
import { nextFloat } from '../rng/rng';
import type { SimState } from '../sim';
import type { CompiledEffect } from './build';
import { applyBurn, applyChill, freeze } from './status';

/** Effects that trigger effects stop at this depth (TECH_DESIGN §6.5). */
export const MAX_EFFECT_DEPTH = 3;

const novaSpec: PlayerHitSpec = {
  damage: 0,
  knockback: 0,
  poiseDamage: 0,
  hitstop: 'none',
  dirX: 0,
  dirY: 0,
  crit: false,
  swingId: 0,
  source: 'effect',
};

/** Context of the triggering event, captured before the target may have died. */
interface TriggerContext {
  target: number;
  x: number;
  y: number;
  burnStacks: number;
  frozen: boolean;
}

const ctxPool: TriggerContext[] = [];
for (let i = 0; i <= MAX_EFFECT_DEPTH; i++)
  ctxPool.push({ target: -1, x: 0, y: 0, burnStacks: 0, frozen: false });

function isEnemy(state: SimState, eid: number): boolean {
  return eid >= 0 && ((state.world.masks[eid] as number) & C.Enemy) !== 0;
}

function applyStatusTo(
  state: SimState,
  eid: number,
  status: 'burn' | 'chill' | null,
  stacks: number,
): void {
  if (status === 'burn') applyBurn(state, eid, stacks);
  else if (status === 'chill') applyChill(state, eid, stacks);
}

function nova(state: SimState, eff: CompiledEffect, ctx: TriggerContext): void {
  const a = eff.action;
  if (a.type !== 'nova') return;
  const c = state.c;
  const cx = a.at === 'player' ? (c.posX[state.playerEid] as number) : ctx.x;
  const cy = a.at === 'player' ? (c.posY[state.playerEid] as number) : ctx.y;
  const e = pushEvent(state.events, Ev.Nova, cx, cy);
  if (e) {
    e.amount = a.radiusPx;
    e.value = a.freeze
      ? StatusCode.Freeze
      : a.status === 'burn'
        ? StatusCode.Burn
        : a.status === 'chill'
          ? StatusCode.Chill
          : StatusCode.None;
  }
  // Nested effects get their own query buffer so outer loops are not clobbered.
  const buffer = state.effectQueryBuffers[state.effectDepth] as Int32Array;
  const r = a.radiusPx;
  const n = queryRect(state.spatial, cx - r - 40, cy - r - 40, cx + r + 40, cy + r + 40, buffer);
  const swingId = ++state.swingCounter;
  for (let i = 0; i < n; i++) {
    const t = buffer[i] as number;
    if (!isEnemy(state, t)) continue;
    const dx = (c.posX[t] as number) - cx;
    const dy = (c.posY[t] as number) - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > r + (c.radius[t] as number)) continue;
    if (a.freeze) freeze(state, t);
    else applyStatusTo(state, t, a.status, a.stacks);
    if (a.damage > 0 && isEnemy(state, t)) {
      novaSpec.damage = a.damage;
      novaSpec.dirX = dist > 0 ? dx / dist : 0;
      novaSpec.dirY = dist > 0 ? dy / dist : -1;
      novaSpec.knockback = 120;
      novaSpec.swingId = swingId;
      damageEnemy(state, t, novaSpec);
    }
  }
}

function run(state: SimState, eff: CompiledEffect, ctx: TriggerContext): void {
  if (ctx.burnStacks < eff.minBurnStacks) return;
  if (eff.requireFrozen && !ctx.frozen) return;
  if (eff.chance < 1 && nextFloat(state.rng.combat) >= eff.chance) return;
  if (state.effectsThisTick >= TUNING.effectBudgetPerTick) return;
  state.effectsThisTick++;
  const a = eff.action;
  const c = state.c;
  switch (a.type) {
    case 'applyStatus':
      if (isEnemy(state, ctx.target)) applyStatusTo(state, ctx.target, a.status, a.stacks);
      break;
    case 'nova':
      nova(state, eff, ctx);
      break;
    case 'heal': {
      const p = state.playerEid;
      const before = c.hp[p] as number;
      c.hp[p] = Math.min(c.maxHp[p] as number, before + a.amount);
      const healed = (c.hp[p] as number) - before;
      if (healed > 0) {
        const e = pushEvent(state.events, Ev.Heal, c.posX[p] as number, c.posY[p] as number);
        if (e) e.amount = healed;
      }
      break;
    }
    case 'refundStamina':
      state.player.stamina = Math.min(TUNING.staminaMax, state.player.stamina + a.amount);
      break;
  }
}

function fire(
  state: SimState,
  effects: readonly CompiledEffect[],
  ctx: TriggerContext,
  source?: 'attack' | 'special',
): void {
  if (effects.length === 0 || state.effectDepth >= MAX_EFFECT_DEPTH) return;
  state.effectDepth++;
  for (let i = 0; i < effects.length; i++) {
    const eff = effects[i] as CompiledEffect;
    if (source !== undefined && eff.source !== 'any' && eff.source !== source) continue;
    run(state, eff, ctx);
  }
  state.effectDepth--;
}

function context(
  state: SimState,
  target: number,
  x: number,
  y: number,
  burn: number,
  frozen: boolean,
): TriggerContext {
  const ctx = ctxPool[state.effectDepth] as TriggerContext;
  ctx.target = target;
  ctx.x = x;
  ctx.y = y;
  ctx.burnStacks = burn;
  ctx.frozen = frozen;
  return ctx;
}

export function fireOnHit(state: SimState, target: number, source: 'attack' | 'special'): void {
  const c = state.c;
  fire(
    state,
    state.build.onHit,
    context(
      state,
      target,
      c.posX[target] as number,
      c.posY[target] as number,
      c.burnStacks[target] as number,
      (c.frozenTicks[target] as number) > 0,
    ),
    source,
  );
}

export function fireOnKill(
  state: SimState,
  x: number,
  y: number,
  burnStacks: number,
  frozen: boolean,
): void {
  fire(state, state.build.onKill, context(state, -1, x, y, burnStacks, frozen));
}

function firePlayer(state: SimState, effects: readonly CompiledEffect[]): void {
  const c = state.c;
  const p = state.playerEid;
  fire(state, effects, context(state, -1, c.posX[p] as number, c.posY[p] as number, 0, false));
}

export function fireOnDash(state: SimState): void {
  firePlayer(state, state.build.onDash);
}

export function fireOnPerfectDash(state: SimState): void {
  firePlayer(state, state.build.onPerfectDash);
}

export function fireOnDamaged(state: SimState): void {
  firePlayer(state, state.build.onDamaged);
}
