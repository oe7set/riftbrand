import { describe, expect, it } from 'vitest';
import { createInputFrame } from '../src/shared/input-frame';
import { hashSim } from '../src/sim/hash';
import { createRng, nextFloat, nextU32 } from '../src/sim/rng/rng';
import { createSim, spawnDrifters, stepSim } from '../src/sim/sim';

/** Plays a scripted run: pseudo-random but reproducible inputs plus a crowd of drifters. */
function playScripted(seed: number, ticks: number): number {
  const sim = createSim(seed);
  spawnDrifters(sim, 200);
  const inputRng = createRng(777);
  const input = createInputFrame();
  for (let t = 0; t < ticks; t++) {
    if (t % 20 === 0) {
      input.moveX = nextFloat(inputRng) * 2 - 1;
      input.moveY = nextFloat(inputRng) * 2 - 1;
      input.hasAim = nextFloat(inputRng) < 0.5;
      const angle = nextFloat(inputRng) * Math.PI * 2;
      input.aimX = Math.cos(angle);
      input.aimY = Math.sin(angle);
      input.pressed = nextU32(inputRng) & 0b111111;
    } else {
      input.pressed = 0;
    }
    if (t === 600) sim.freezeTicks = 5;
    stepSim(sim, input);
  }
  return hashSim(sim);
}

describe('determinism', () => {
  it('produces identical state for identical seed and inputs', () => {
    expect(playScripted(1234, 3600)).toBe(playScripted(1234, 3600));
  });

  it('diverges for a different seed', () => {
    expect(playScripted(1234, 600)).not.toBe(playScripted(4321, 600));
  });
});
