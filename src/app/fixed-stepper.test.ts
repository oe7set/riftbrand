import { describe, expect, it } from 'vitest';
import { FixedStepper } from './fixed-stepper';

const DT = 1 / 60;

describe('FixedStepper', () => {
  it('runs one tick per 60 Hz frame', () => {
    const s = new FixedStepper(DT);
    let total = 0;
    for (let i = 0; i < 60; i++) total += s.advance(DT);
    expect(total).toBe(60);
  });

  it('runs a tick every other frame at 120 Hz, with interpolation in between', () => {
    const s = new FixedStepper(DT);
    const ticks: number[] = [];
    const alphas: number[] = [];
    for (let i = 0; i < 120; i++) {
      ticks.push(s.advance(1 / 120));
      alphas.push(s.alpha);
    }
    expect(ticks.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(59);
    expect(ticks.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(60);
    expect(Math.max(...ticks)).toBe(1);
    expect(alphas.some((a) => a > 0.4 && a < 0.6)).toBe(true);
  });

  it('caps ticks per frame and drops the backlog', () => {
    const s = new FixedStepper(DT, 5);
    expect(s.advance(1)).toBe(5);
    expect(s.alpha).toBe(0);
    expect(s.advance(DT)).toBe(1);
  });

  it('slows down sim time with timeScale', () => {
    const s = new FixedStepper(DT);
    s.timeScale = 0.5;
    let total = 0;
    for (let i = 0; i < 60; i++) total += s.advance(DT);
    expect(total).toBe(30);
  });

  it('ignores negative frame times', () => {
    const s = new FixedStepper(DT);
    expect(s.advance(-1)).toBe(0);
  });
});
