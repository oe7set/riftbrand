import { TUNING } from '../../content/tuning';
import type { InputFrame } from '../../shared/input-frame';
import { C } from '../ecs/components';
import { hasComponents } from '../ecs/world';
import type { SimState } from '../sim';
import { TICK_DT_SEC } from '../time';

const MOVE_EPSILON = 1e-3;

/** Approaches `target` by at most `maxDelta`. */
function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(current + maxDelta, target);
  return Math.max(current - maxDelta, target);
}

export function playerControlSystem(state: SimState, input: InputFrame): void {
  const eid = state.playerEid;
  if (eid < 0 || !hasComponents(state.world, eid, C.PlayerControl | C.Velocity)) return;
  const c = state.c;

  const len = Math.sqrt(input.moveX * input.moveX + input.moveY * input.moveY);
  const moving = len > MOVE_EPSILON;
  const dirX = moving ? input.moveX / len : 0;
  const dirY = moving ? input.moveY / len : 0;
  // Analog sticks may report slightly more than 1 on diagonals.
  const magnitude = Math.min(len, 1);
  const speed = TUNING.playerSpeedPxPerSec;
  const targetX = dirX * magnitude * speed;
  const targetY = dirY * magnitude * speed;

  const rampSec = moving ? TUNING.playerAccelSec : TUNING.playerDecelSec;
  if (rampSec <= 0) {
    c.velX[eid] = targetX;
    c.velY[eid] = targetY;
  } else {
    // Per-axis ramp keeps diagonal and straight acceleration equally snappy.
    const maxDelta = (speed * TICK_DT_SEC) / rampSec;
    c.velX[eid] = approach(c.velX[eid] as number, targetX, maxDelta);
    c.velY[eid] = approach(c.velY[eid] as number, targetY, maxDelta);
  }

  // Facing follows explicit aim first, then movement; it stays put when idle.
  if (input.hasAim) {
    c.facingX[eid] = input.aimX;
    c.facingY[eid] = input.aimY;
  } else if (moving) {
    c.facingX[eid] = dirX;
    c.facingY[eid] = dirY;
  }
}
