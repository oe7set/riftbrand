import { TUNING } from '../../content/tuning';
import { damageEnemyDot, releaseToken } from '../combat/damage';
import { AiState, C } from '../ecs/components';
import { Ev, pushEvent, StatusCode } from '../events';
import type { SimState } from '../sim';
import { secondsToTicks } from '../time';

/** Adds burn stacks and refreshes the duration (GDD: Ignara stacks damage over time). */
export function applyBurn(state: SimState, eid: number, stacks: number): void {
  const c = state.c;
  if (stacks <= 0) return;
  const before = c.burnStacks[eid] as number;
  const now = Math.min(TUNING.burnMaxStacks, before + stacks);
  c.burnStacks[eid] = now;
  c.burnTicks[eid] = secondsToTicks(TUNING.burnDurationSec);
  if (before === 0) c.burnTickTimer[eid] = secondsToTicks(TUNING.burnTickSec);
  const e = pushEvent(state.events, Ev.StatusApplied, c.posX[eid] as number, c.posY[eid] as number);
  if (e) {
    e.eid = eid;
    e.value = StatusCode.Burn;
    e.amount = now;
  }
}

/** Adds chill; at max stacks the enemy freezes solid and chill resets (GDD: Vaelis). */
export function applyChill(state: SimState, eid: number, stacks: number): void {
  const c = state.c;
  if (stacks <= 0 || (c.frozenTicks[eid] as number) > 0) return;
  const now = Math.min(TUNING.chillMaxStacks, (c.chillStacks[eid] as number) + stacks);
  c.chillStacks[eid] = now;
  c.chillTicks[eid] = secondsToTicks(TUNING.chillDurationSec);
  if (now >= TUNING.chillMaxStacks) {
    freeze(state, eid);
    return;
  }
  const e = pushEvent(state.events, Ev.StatusApplied, c.posX[eid] as number, c.posY[eid] as number);
  if (e) {
    e.eid = eid;
    e.value = StatusCode.Chill;
    e.amount = now;
  }
}

/** Freezes an enemy: it stops acting and its current attack is cancelled. */
export function freeze(state: SimState, eid: number): void {
  const c = state.c;
  c.chillStacks[eid] = 0;
  c.chillTicks[eid] = 0;
  c.frozenTicks[eid] = secondsToTicks(
    TUNING.freezeDurationSec * (1 + state.build.stats.freezeDuration),
  );
  if (c.aiState[eid] === AiState.Windup || c.aiState[eid] === AiState.Active) {
    releaseToken(state, eid);
    c.aiState[eid] = AiState.Position;
    c.aiTicks[eid] = 0;
  }
  c.velX[eid] = 0;
  c.velY[eid] = 0;
  const e = pushEvent(state.events, Ev.Frozen, c.posX[eid] as number, c.posY[eid] as number);
  if (e) e.eid = eid;
}

/** Movement multiplier from chill (frozen enemies don't move at all). */
export function chillSpeedFactor(state: SimState, eid: number): number {
  const c = state.c;
  if ((c.frozenTicks[eid] as number) > 0) return 0;
  return Math.max(0.2, 1 - TUNING.chillSlowPerStack * (c.chillStacks[eid] as number));
}

/** Ticks burn damage and status durations. */
export function statusSystem(state: SimState): void {
  const { world, c } = state;
  const masks = world.masks;
  const burnMult = 1 + state.build.stats.burnDamage;
  for (let eid = 0; eid < world.highWater; eid++) {
    if (((masks[eid] as number) & C.Enemy) === 0) continue;
    if ((c.frozenTicks[eid] as number) > 0) c.frozenTicks[eid] = (c.frozenTicks[eid] as number) - 1;
    if ((c.chillTicks[eid] as number) > 0) {
      c.chillTicks[eid] = (c.chillTicks[eid] as number) - 1;
      if (c.chillTicks[eid] === 0) c.chillStacks[eid] = 0;
    }
    const stacks = c.burnStacks[eid] as number;
    if (stacks === 0) continue;
    c.burnTicks[eid] = (c.burnTicks[eid] as number) - 1;
    c.burnTickTimer[eid] = (c.burnTickTimer[eid] as number) - 1;
    if ((c.burnTickTimer[eid] as number) <= 0) {
      c.burnTickTimer[eid] = secondsToTicks(TUNING.burnTickSec);
      damageEnemyDot(
        state,
        eid,
        stacks * TUNING.burnDamagePerStackPerSec * TUNING.burnTickSec * burnMult,
      );
    }
    // The enemy may have died from the tick; its slot was cleared then.
    if (((masks[eid] as number) & C.Enemy) !== 0 && (c.burnTicks[eid] as number) <= 0) {
      c.burnStacks[eid] = 0;
    }
  }
}
