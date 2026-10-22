import { C } from './ecs/components';
import type { SimState } from './sim';

function fnv1a(hash: number, value: number): number {
  return Math.imul(hash ^ value, 16777619) >>> 0;
}

const f64 = new Float64Array(1);
const u32 = new Uint32Array(f64.buffer);

function mixFloat(hash: number, value: number): number {
  f64[0] = value;
  return fnv1a(fnv1a(hash, u32[0] as number), u32[1] as number);
}

/**
 * Fingerprint of all gameplay-relevant state. Two runs with the same seed and inputs must
 * produce the same hash; the determinism test relies on this.
 */
export function hashSim(state: SimState): number {
  const { world, c } = state;
  let h = 2166136261;
  h = fnv1a(h, state.tick);
  h = fnv1a(h, state.freezeTicks);
  for (const stream of Object.values(state.rng)) {
    for (const word of stream.state) h = fnv1a(h, word);
  }
  for (let eid = 0; eid < world.highWater; eid++) {
    const mask = world.masks[eid] as number;
    h = fnv1a(h, mask);
    if ((mask & C.Transform) === 0) continue;
    h = mixFloat(h, c.posX[eid] as number);
    h = mixFloat(h, c.posY[eid] as number);
    h = mixFloat(h, c.velX[eid] as number);
    h = mixFloat(h, c.velY[eid] as number);
    h = mixFloat(h, c.facingX[eid] as number);
    h = mixFloat(h, c.facingY[eid] as number);
  }
  return h;
}
