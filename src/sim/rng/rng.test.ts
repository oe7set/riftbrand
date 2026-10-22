import { describe, expect, it } from 'vitest';
import {
  cloneRng,
  createRng,
  createRngStreams,
  dailySeed,
  hashString,
  nextFloat,
  nextInt,
  nextU32,
} from './rng';

function take(seed: number, n: number): number[] {
  const rng = createRng(seed);
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(nextU32(rng));
  return out;
}

describe('rng', () => {
  it('is reproducible for the same seed', () => {
    expect(take(42, 50)).toEqual(take(42, 50));
  });

  it('differs for different seeds', () => {
    expect(take(1, 10)).not.toEqual(take(2, 10));
  });

  it('keeps a stable sequence across versions', () => {
    // Guards against accidental algorithm changes, which would invalidate seeds and saves.
    expect(take(12345, 3)).toMatchInlineSnapshot(`
      [
        2345461488,
        1344865159,
        2974739204,
      ]
    `);
  });

  it('produces floats in [0, 1) and ints in range', () => {
    const rng = createRng(7);
    for (let i = 0; i < 10_000; i++) {
      const f = nextFloat(rng);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = nextInt(rng, -3, 4);
      expect(n).toBeGreaterThanOrEqual(-3);
      expect(n).toBeLessThan(4);
    }
  });

  it('is roughly uniform', () => {
    const rng = createRng(99);
    const buckets = new Array(10).fill(0);
    const samples = 100_000;
    for (let i = 0; i < samples; i++) buckets[Math.floor(nextFloat(rng) * 10)]++;
    for (const count of buckets) {
      expect(Math.abs(count - samples / 10)).toBeLessThan(samples * 0.01);
    }
  });

  it('continues identically after cloning (serializable state)', () => {
    const rng = createRng(5);
    for (let i = 0; i < 17; i++) nextU32(rng);
    const copy = cloneRng(rng);
    expect(nextU32(copy)).toBe(nextU32(rng));
  });

  it('derives independent streams', () => {
    const streams = createRngStreams(1000);
    expect(nextU32(streams.map)).not.toBe(nextU32(streams.combat));
    const again = createRngStreams(1000);
    // Consuming one stream must not affect another.
    nextU32(again.combat);
    nextU32(again.combat);
    const fresh = createRngStreams(1000);
    expect(nextU32(again.map)).toBe(nextU32(fresh.map));
  });

  it('hashes strings and dates deterministically', () => {
    expect(hashString('riftbrand')).toBe(hashString('riftbrand'));
    expect(hashString('a')).not.toBe(hashString('b'));
    expect(dailySeed(2026, 10, 22)).toBe(dailySeed(2026, 10, 22));
    expect(dailySeed(2026, 10, 22)).not.toBe(dailySeed(2026, 10, 23));
  });
});
