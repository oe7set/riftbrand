import { TUNING } from '../../content/tuning';
import { clearSpatialHash, insertPoint, queryRect } from '../collision/spatial-hash';
import { C } from '../ecs/components';
import type { SimState } from '../sim';

const BODY_MASK = C.Transform | C.Collider;

/**
 * Soft body separation so crowds spread out instead of stacking. Uses the broadphase, which
 * later also serves hitbox/hurtbox checks.
 */
export function separationSystem(state: SimState): void {
  const { world, c, spatial, queryBuffer } = state;
  const masks = world.masks;
  clearSpatialHash(spatial);
  let maxRadius = 0;
  for (let eid = 0; eid < world.highWater; eid++) {
    if (((masks[eid] as number) & BODY_MASK) !== BODY_MASK) continue;
    insertPoint(spatial, eid, c.posX[eid] as number, c.posY[eid] as number);
    const r = c.radius[eid] as number;
    if (r > maxRadius) maxRadius = r;
  }

  const strength = TUNING.separationStrength;
  if (strength <= 0) return;
  for (let a = 0; a < world.highWater; a++) {
    // Only crowd members push; the player is never shoved by dummies.
    if (((masks[a] as number) & (BODY_MASK | C.Drifter)) !== (BODY_MASK | C.Drifter)) continue;
    const ax = c.posX[a] as number;
    const ay = c.posY[a] as number;
    const ar = c.radius[a] as number;
    const reach = ar + maxRadius;
    const n = queryRect(spatial, ax - reach, ay - reach, ax + reach, ay + reach, queryBuffer);
    let pushX = 0;
    let pushY = 0;
    for (let i = 0; i < n; i++) {
      const b = queryBuffer[i] as number;
      if (b === a) continue;
      const dx = ax - (c.posX[b] as number);
      const dy = ay - (c.posY[b] as number);
      const minDist = ar + (c.radius[b] as number);
      const distSq = dx * dx + dy * dy;
      if (distSq >= minDist * minDist) continue;
      if (distSq === 0) {
        // Deterministic tie-break for perfectly stacked bodies.
        pushX += a < b ? 1 : -1;
        continue;
      }
      const dist = Math.sqrt(distSq);
      const overlap = minDist - dist;
      pushX += (dx / dist) * overlap;
      pushY += (dy / dist) * overlap;
    }
    c.posX[a] = ax + pushX * strength;
    c.posY[a] = ay + pushY * strength;
  }
}
