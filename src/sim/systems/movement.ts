import { C } from '../ecs/components';
import type { SimState } from '../sim';
import { TICK_DT_SEC } from '../time';

const MOVE_MASK = C.Transform | C.Velocity;

/** Integrates velocity and keeps colliders inside the arena walls. */
export function movementSystem(state: SimState): void {
  const { world, c } = state;
  const masks = world.masks;
  for (let eid = 0; eid < world.highWater; eid++) {
    if (((masks[eid] as number) & MOVE_MASK) !== MOVE_MASK) continue;
    let x = (c.posX[eid] as number) + (c.velX[eid] as number) * TICK_DT_SEC;
    let y = (c.posY[eid] as number) + (c.velY[eid] as number) * TICK_DT_SEC;
    const r = c.radius[eid] as number;
    if (x < r) x = r;
    else if (x > state.arenaWidthPx - r) x = state.arenaWidthPx - r;
    if (y < r) y = r;
    else if (y > state.arenaHeightPx - r) y = state.arenaHeightPx - r;
    c.posX[eid] = x;
    c.posY[eid] = y;
  }
}
