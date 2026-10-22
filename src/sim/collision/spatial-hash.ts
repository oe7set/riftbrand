/**
 * Uniform-grid broadphase rebuilt every tick. Cells hash into a fixed-size bucket table with
 * per-bucket linked lists, so memory is bounded and nothing is allocated per tick.
 * Bucket collisions only add candidates; callers always do an exact distance check.
 */
export interface SpatialHash {
  readonly cellSizePx: number;
  readonly bucketMask: number;
  readonly heads: Int32Array;
  readonly next: Int32Array;
  /** Per-entity query stamp to deduplicate entities seen through colliding buckets. */
  readonly seen: Uint32Array;
  stamp: number;
}

export function createSpatialHash(
  entityCapacity: number,
  cellSizePx: number,
  bucketCount = 4096,
): SpatialHash {
  if ((bucketCount & (bucketCount - 1)) !== 0) throw new Error('bucketCount must be a power of 2');
  const hash: SpatialHash = {
    cellSizePx,
    bucketMask: bucketCount - 1,
    heads: new Int32Array(bucketCount),
    next: new Int32Array(entityCapacity),
    seen: new Uint32Array(entityCapacity),
    stamp: 0,
  };
  clearSpatialHash(hash);
  return hash;
}

export function clearSpatialHash(hash: SpatialHash): void {
  hash.heads.fill(-1);
}

function bucketOf(hash: SpatialHash, cellX: number, cellY: number): number {
  return (Math.imul(cellX, 73856093) ^ Math.imul(cellY, 19349663)) & hash.bucketMask;
}

export function insertPoint(hash: SpatialHash, eid: number, x: number, y: number): void {
  const bucket = bucketOf(hash, Math.floor(x / hash.cellSizePx), Math.floor(y / hash.cellSizePx));
  hash.next[eid] = hash.heads[bucket] as number;
  hash.heads[bucket] = eid;
}

/**
 * Writes ids of entities whose inserted point lies in cells overlapping the rect into `out`.
 * Returns the count (capped at out.length). Order is deterministic for a given insertion order.
 */
export function queryRect(
  hash: SpatialHash,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  out: Int32Array,
): number {
  hash.stamp = (hash.stamp + 1) >>> 0;
  if (hash.stamp === 0) {
    hash.seen.fill(0);
    hash.stamp = 1;
  }
  const cs = hash.cellSizePx;
  const x0 = Math.floor(minX / cs);
  const y0 = Math.floor(minY / cs);
  const x1 = Math.floor(maxX / cs);
  const y1 = Math.floor(maxY / cs);
  let count = 0;
  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      let eid = hash.heads[bucketOf(hash, cx, cy)] as number;
      while (eid !== -1) {
        if (hash.seen[eid] !== hash.stamp) {
          hash.seen[eid] = hash.stamp;
          if (count < out.length) out[count++] = eid;
        }
        eid = hash.next[eid] as number;
      }
    }
  }
  return count;
}
