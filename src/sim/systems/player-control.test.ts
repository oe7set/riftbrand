import { afterEach, describe, expect, it } from 'vitest';
import { resetTuning, TUNING } from '../../content/tuning';
import { createInputFrame } from '../../shared/input-frame';
import { createSim, stepSim } from '../sim';
import { secondsToTicks } from '../time';

afterEach(() => resetTuning());

describe('player control', () => {
  it('reaches full speed within the acceleration time', () => {
    const sim = createSim(1);
    const input = createInputFrame();
    input.moveX = 1;
    for (let i = 0; i < secondsToTicks(TUNING.playerAccelSec); i++) stepSim(sim, input);
    expect(sim.c.velX[sim.playerEid]).toBeCloseTo(TUNING.playerSpeedPxPerSec);
  });

  it('stops instantly by default (no sliding)', () => {
    const sim = createSim(1);
    const input = createInputFrame();
    input.moveX = 1;
    for (let i = 0; i < 30; i++) stepSim(sim, input);
    input.moveX = 0;
    stepSim(sim, input);
    expect(sim.c.velX[sim.playerEid]).toBe(0);
  });

  it('normalizes overshooting stick input', () => {
    const sim = createSim(1);
    const input = createInputFrame();
    input.moveX = 1;
    input.moveY = 1;
    for (let i = 0; i < 30; i++) stepSim(sim, input);
    const e = sim.playerEid;
    expect(Math.hypot(sim.c.velX[e] ?? 0, sim.c.velY[e] ?? 0)).toBeCloseTo(
      TUNING.playerSpeedPxPerSec,
    );
  });

  it('faces the aim direction over the move direction', () => {
    const sim = createSim(1);
    const input = createInputFrame();
    input.moveX = 1;
    input.hasAim = true;
    input.aimX = 0;
    input.aimY = -1;
    stepSim(sim, input);
    expect(sim.c.facingY[sim.playerEid]).toBe(-1);
  });

  it('stays inside the arena', () => {
    const sim = createSim(1);
    const input = createInputFrame();
    input.moveX = -1;
    for (let i = 0; i < 1000; i++) stepSim(sim, input);
    expect(sim.c.posX[sim.playerEid]).toBe(TUNING.playerRadiusPx);
  });

  it('skips gameplay during hitstop', () => {
    const sim = createSim(1);
    const input = createInputFrame();
    input.moveX = 1;
    sim.freezeTicks = 3;
    const x0 = sim.c.posX[sim.playerEid];
    for (let i = 0; i < 3; i++) stepSim(sim, input);
    expect(sim.c.posX[sim.playerEid]).toBe(x0);
    stepSim(sim, input);
    expect(sim.c.posX[sim.playerEid]).toBeGreaterThan(x0 ?? 0);
  });
});
