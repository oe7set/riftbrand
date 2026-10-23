/**
 * Small seeded random for view-only decoration (cracks, rubble): the same room always looks the
 * same, without touching the sim's RNG streams.
 */
export function scatterRandom(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A jagged crack as a flat point list, starting at (x, y). */
export function crackPoints(
  rand: () => number,
  x: number,
  y: number,
  lengthPx: number,
  stepPx: number,
): number[] {
  const points = [x, y];
  let a = rand() * Math.PI * 2;
  let px = x;
  let py = y;
  for (let d = 0; d < lengthPx; d += stepPx) {
    a += (rand() - 0.5) * 1.1;
    px += Math.cos(a) * stepPx;
    py += Math.sin(a) * stepPx;
    points.push(px, py);
  }
  return points;
}
