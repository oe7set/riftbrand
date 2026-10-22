import { TUNING } from '../../content/tuning';
import { C } from '../ecs/components';
import { pushOut, pushOutOfObstacles } from '../room';
import type { SimState } from '../sim';
import { TICK_DT_SEC } from '../time';

const MOVE_MASK = C.Transform | C.Velocity;

/** Integrates velocity plus decaying knockback and keeps bodies inside the arena walls. */
export function movementSystem(state: SimState): void {
  const { world, c } = state;
  const masks = world.masks;
  const kbDecay = Math.exp(-TUNING.knockbackDecayPerSec * TICK_DT_SEC);
  for (let eid = 0; eid < world.highWater; eid++) {
    if (((masks[eid] as number) & MOVE_MASK) !== MOVE_MASK) continue;
    const kbX = c.kbX[eid] as number;
    const kbY = c.kbY[eid] as number;
    let x = (c.posX[eid] as number) + ((c.velX[eid] as number) + kbX) * TICK_DT_SEC;
    let y = (c.posY[eid] as number) + ((c.velY[eid] as number) + kbY) * TICK_DT_SEC;
    c.kbX[eid] = Math.abs(kbX) < 1 ? 0 : kbX * kbDecay;
    c.kbY[eid] = Math.abs(kbY) < 1 ? 0 : kbY * kbDecay;
    const r = c.radius[eid] as number;
    // Projectiles pass into obstacles and are destroyed by the projectile system instead.
    if (
      (state.room.rectCount > 0 || state.room.circleCount > 0) &&
      ((masks[eid] as number) & C.Projectile) === 0
    ) {
      pushOutOfObstacles(state.room, x, y, r);
      x = pushOut.x;
      y = pushOut.y;
    }
    if (x < r) x = r;
    else if (x > state.arenaWidthPx - r) x = state.arenaWidthPx - r;
    if (y < r) y = r;
    else if (y > state.arenaHeightPx - r) y = state.arenaHeightPx - r;
    c.posX[eid] = x;
    c.posY[eid] = y;
  }
}
