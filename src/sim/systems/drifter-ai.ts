import { TUNING } from '../../content/tuning';
import { C } from '../ecs/components';
import { nextFloat, nextRange } from '../rng/rng';
import type { SimState } from '../sim';
import { secondsToTicks } from '../time';

/** Stress-test dummies: pick a random heading every so often. */
export function drifterAiSystem(state: SimState): void {
  const { world, c } = state;
  const rng = state.rng.ai;
  const masks = world.masks;
  for (let eid = 0; eid < world.highWater; eid++) {
    if (((masks[eid] as number) & C.Drifter) === 0) continue;
    const remaining = (c.wanderTicks[eid] as number) - 1;
    if (remaining > 0) {
      c.wanderTicks[eid] = remaining;
      continue;
    }
    const angle = nextFloat(rng) * Math.PI * 2;
    const speed = TUNING.drifterSpeedPxPerSec;
    c.velX[eid] = Math.cos(angle) * speed;
    c.velY[eid] = Math.sin(angle) * speed;
    c.wanderTicks[eid] = Math.max(
      1,
      secondsToTicks(nextRange(rng, TUNING.drifterWanderMinSec, TUNING.drifterWanderMaxSec)),
    );
  }
}
