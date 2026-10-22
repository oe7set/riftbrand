import { describe, expect, it } from 'vitest';
import { vec2 } from '../../shared/math/vec2';
import { applyRadialDeadzone, digitalToVector } from './stick';

describe('stick helpers', () => {
  it('zeroes input inside the deadzone', () => {
    expect(applyRadialDeadzone(vec2(), 0.05, 0.05, 0.2)).toEqual({ x: 0, y: 0 });
  });

  it('rescales so the edge of the deadzone maps to 0 and full tilt to 1', () => {
    const out = applyRadialDeadzone(vec2(), 1, 0, 0.2);
    expect(out.x).toBeCloseTo(1);
    const mid = applyRadialDeadzone(vec2(), 0.6, 0, 0.2);
    expect(mid.x).toBeCloseTo(0.5);
  });

  it('clamps overshooting diagonals to length 1', () => {
    const out = applyRadialDeadzone(vec2(), 1, 1, 0.1);
    expect(Math.hypot(out.x, out.y)).toBeCloseTo(1);
  });

  it('normalizes digital diagonals', () => {
    const out = digitalToVector(vec2(), false, true, true, false);
    expect(Math.hypot(out.x, out.y)).toBeCloseTo(1);
    expect(out.x).toBeGreaterThan(0);
    expect(out.y).toBeLessThan(0);
    expect(digitalToVector(vec2(), true, true, false, false)).toEqual({ x: 0, y: 0 });
  });
});
