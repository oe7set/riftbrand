import { ENEMIES } from '../../content/enemies';
import { STATUS_COUNT, Status, type StatusIndex, statusDef } from '../../content/statuses';
import { TUNING } from '../../content/tuning';
import { damageEnemyDot, releaseToken } from '../combat/damage';
import { AiState, C, stacksOf, statusSlot } from '../ecs/components';
import { Ev, pushEvent, STATUS_CODES, StatusFlag } from '../events';
import type { SimState } from '../sim';
import { secondsToTicks } from '../time';
import { fireOnBurnApplied, fireOnFreeze } from './runtime';

function resistOf(state: SimState, eid: number): number {
  return ENEMIES[state.c.enemyType[eid] as number]?.statusResist ?? 0;
}

/**
 * Adds stacks of a status (capped) and refreshes its duration. Chill at its threshold freezes
 * the enemy instead (GDD §2.4: Vaelis); a frozen enemy takes no new chill.
 */
export function applyStatus(
  state: SimState,
  eid: number,
  status: StatusIndex,
  stacks: number,
): void {
  const c = state.c;
  if (stacks <= 0) return;
  const def = statusDef(status);
  if (def.freezeAtStacks > 0 && (c.frozenTicks[eid] as number) > 0) return;
  const slot = statusSlot(eid, status);
  const before = c.statusStacks[slot] as number;
  const now = Math.min(def.maxStacks, before + stacks);
  c.statusStacks[slot] = now;
  c.statusTicks[slot] = secondsToTicks(def.durationSec);
  if (before === 0) c.statusTimer[slot] = secondsToTicks(def.tickSec);
  if (def.freezeAtStacks > 0 && now >= def.freezeAtStacks) {
    freeze(state, eid);
    return;
  }
  const e = pushEvent(state.events, Ev.StatusApplied, c.posX[eid] as number, c.posY[eid] as number);
  if (e) {
    e.eid = eid;
    e.value = STATUS_CODES[status] as number;
    e.amount = now;
    e.flags =
      (before === 0 ? StatusFlag.First : 0) |
      (now === def.maxStacks && before < def.maxStacks ? StatusFlag.Full : 0);
  }
  if (status === Status.Burn) fireOnBurnApplied(state, eid);
}

export function applyBurn(state: SimState, eid: number, stacks: number): void {
  applyStatus(state, eid, Status.Burn, stacks);
}

export function applyChill(state: SimState, eid: number, stacks: number): void {
  applyStatus(state, eid, Status.Chill, stacks);
}

/** Freezes an enemy: it stops acting and its current attack is cancelled. */
export function freeze(state: SimState, eid: number): void {
  const c = state.c;
  const slot = statusSlot(eid, Status.Chill);
  c.statusStacks[slot] = 0;
  c.statusTicks[slot] = 0;
  c.frozenTicks[eid] = secondsToTicks(
    TUNING.freezeDurationSec * (1 + state.build.stats.freezeDuration) * (1 - resistOf(state, eid)),
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
  fireOnFreeze(state, eid);
}

/** Movement multiplier from slowing statuses (frozen enemies don't move at all). */
export function chillSpeedFactor(state: SimState, eid: number): number {
  const c = state.c;
  if ((c.frozenTicks[eid] as number) > 0) return 0;
  let slow = 0;
  for (let s = 0; s < STATUS_COUNT; s++) {
    slow += statusDef(s).slowPerStack * stacksOf(c, eid, s);
  }
  return Math.max(0.2, 1 - slow);
}

/**
 * Windup progress per tick (1 = normal): blinded enemies wind up slower, giving the player
 * more time to react. Status resistance (bosses) weakens the effect.
 */
export function windupRate(state: SimState, eid: number): number {
  const c = state.c;
  let mult = 1;
  for (let s = 0; s < STATUS_COUNT; s++) {
    const def = statusDef(s);
    if (def.windupMultiplier > 1 && stacksOf(c, eid, s) > 0) {
      mult = Math.max(mult, def.windupMultiplier);
    }
  }
  if (mult === 1) return 1;
  return 1 / (1 + (mult - 1) * (1 - resistOf(state, eid)));
}

/** Aim error of enemy volleys in degrees (blind), weakened by status resistance. */
export function aimErrorDeg(state: SimState, eid: number): number {
  const c = state.c;
  let deg = 0;
  for (let s = 0; s < STATUS_COUNT; s++) {
    const def = statusDef(s);
    if (def.aimErrorDeg > 0 && stacksOf(c, eid, s) > 0) deg = Math.max(deg, def.aimErrorDeg);
  }
  return deg * (1 - resistOf(state, eid));
}

function damageMultiplierFor(state: SimState, status: number): number {
  return status === Status.Burn ? 1 + state.build.stats.burnDamage : 1;
}

/** Ticks damage over time and status durations. */
export function statusSystem(state: SimState): void {
  const { world, c } = state;
  const masks = world.masks;
  for (let eid = 0; eid < world.highWater; eid++) {
    if (((masks[eid] as number) & C.Enemy) === 0) continue;
    if ((c.frozenTicks[eid] as number) > 0) c.frozenTicks[eid] = (c.frozenTicks[eid] as number) - 1;
    for (let s = 0; s < STATUS_COUNT; s++) {
      const slot = statusSlot(eid, s);
      const stacks = c.statusStacks[slot] as number;
      if (stacks === 0) continue;
      const def = statusDef(s);
      c.statusTicks[slot] = (c.statusTicks[slot] as number) - 1;
      if (def.damagePerStackPerSec > 0) {
        c.statusTimer[slot] = (c.statusTimer[slot] as number) - 1;
        if ((c.statusTimer[slot] as number) <= 0) {
          c.statusTimer[slot] = secondsToTicks(def.tickSec);
          damageEnemyDot(
            state,
            eid,
            stacks *
              def.damagePerStackPerSec *
              def.tickSec *
              damageMultiplierFor(state, s) *
              (1 - resistOf(state, eid)),
          );
          // The tick may have killed the enemy; its slot was cleared then.
          if (((masks[eid] as number) & C.Enemy) === 0) break;
        }
      }
      if ((c.statusTicks[slot] as number) <= 0) {
        c.statusStacks[slot] = 0;
        const e = pushEvent(
          state.events,
          Ev.StatusExpired,
          c.posX[eid] as number,
          c.posY[eid] as number,
        );
        if (e) {
          e.eid = eid;
          e.value = STATUS_CODES[s] as number;
        }
      }
    }
  }
}
