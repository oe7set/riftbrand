import { describe, expect, it } from 'vitest';
import { crackPoints, scatterRandom } from './scatter';
import { METEOR_FALL_PX, meteorHeadOffset } from './spell-visuals';

describe('view decoration helpers (ROADMAP M4.4)', () => {
  it('scatter random is seeded: the same room always looks the same', () => {
    const a = scatterRandom(42);
    const b = scatterRandom(42);
    const c = scatterRandom(43);
    const seqA = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(seqA);
    expect([c(), c(), c()]).not.toEqual(seqA);
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('cracks start at their origin and step evenly', () => {
    const pts = crackPoints(scatterRandom(7), 100, 50, 60, 10);
    expect(pts.slice(0, 2)).toEqual([100, 50]);
    for (let i = 2; i + 1 < pts.length; i += 2) {
      const d = Math.hypot(
        (pts[i] as number) - (pts[i - 2] as number),
        (pts[i + 1] as number) - (pts[i - 1] as number),
      );
      expect(d).toBeCloseTo(10);
    }
  });

  it('the meteor falls from above onto its mark', () => {
    const out = { x: 0, y: 0 };
    meteorHeadOffset(0, out);
    expect(out.y).toBeCloseTo(-METEOR_FALL_PX);
    meteorHeadOffset(1, out);
    expect(out.x).toBeCloseTo(0);
    expect(out.y).toBeCloseTo(0);
  });
});
