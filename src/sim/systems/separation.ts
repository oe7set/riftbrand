import { TUNING } from '../../content/tuning';
import { clearSpatialHash, insertPoint, queryRect } from '../collision/spatial-hash';
import { C } from '../ecs/components';
import { pushOut, pushOutOfObstacles } from '../room';
import type { SimState } from '../sim';

const BODY_MASK = C.Transform | C.Collider;

/** Inserts every body (not projectiles) into the broadphase. Returns the largest radius. */
export function rebuildSpatialHash(state: SimState): number {
  const { world, c, spatial } = state;
  const masks = world.masks;
  clearSpatialHash(spatial);
  let maxRadius = 0;
  for (let eid = 0; eid < world.highWater; eid++) {
    const mask = masks[eid] as number;
    if ((mask & BODY_MASK) !== BODY_MASK || (mask & C.Projectile) !== 0) continue;
    insertPoint(spatial, eid, c.posX[eid] as number, c.posY[eid] as number);
    const r = c.radius[eid] as number;
    if (r > maxRadius) maxRadius = r;
  }
  return maxRadius;
}

/**
 * Soft body separation so crowds spread out instead of stacking. Crowd members are pushed away
 * from every body, including the player, but never push the player (no contact damage or shoving).
 */
export function separationSystem(state: SimState): void {
  const { world, c, spatial, queryBuffer } = state;
  const masks = world.masks;
  const maxRadius = rebuildSpatialHash(state);
  const strength = TUNING.separationStrength;
  if (strength <= 0) return;
  const crowdMask = BODY_MASK | C.Crowd;
  for (let a = 0; a < world.highWater; a++) {
    if (((masks[a] as number) & crowdMask) !== crowdMask) continue;
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
    let nx = ax + pushX * strength;
    let ny = ay + pushY * strength;
    // Crowd pushes must not shove bodies into walls.
    if (state.room.rectCount > 0 || state.room.circleCount > 0) {
      pushOutOfObstacles(state.room, nx, ny, ar);
      nx = pushOut.x;
      ny = pushOut.y;
    }
    c.posX[a] = Math.max(ar, Math.min(state.arenaWidthPx - ar, nx));
    c.posY[a] = Math.max(ar, Math.min(state.arenaHeightPx - ar, ny));
  }
}
