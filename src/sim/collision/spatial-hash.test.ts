import { describe, expect, it } from 'vitest';
import { clearSpatialHash, createSpatialHash, insertPoint, queryRect } from './spatial-hash';

describe('spatial hash', () => {
  it('finds points in the queried area', () => {
    const hash = createSpatialHash(16, 64, 16);
    insertPoint(hash, 0, 10, 10);
    insertPoint(hash, 1, 100, 10);
    insertPoint(hash, 2, 1000, 1000);
    const out = new Int32Array(16);
    const n = queryRect(hash, 0, 0, 120, 50, out);
    expect(Array.from(out.subarray(0, n)).sort()).toEqual([0, 1]);
  });

  it('never returns an entity twice, even with bucket collisions', () => {
    // Two buckets force many cells to share a bucket.
    const hash = createSpatialHash(8, 10, 2);
    for (let i = 0; i < 8; i++) insertPoint(hash, i, i * 10, 0);
    const out = new Int32Array(64);
    const n = queryRect(hash, 0, 0, 80, 0, out);
    const ids = Array.from(out.subarray(0, n));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(8);
  });

  it('handles negative coordinates and clearing', () => {
    const hash = createSpatialHash(4, 32, 64);
    insertPoint(hash, 3, -50, -50);
    const out = new Int32Array(4);
    expect(queryRect(hash, -60, -60, -40, -40, out)).toBe(1);
    clearSpatialHash(hash);
    expect(queryRect(hash, -60, -60, -40, -40, out)).toBe(0);
  });
});
