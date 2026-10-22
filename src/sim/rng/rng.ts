/**
 * Seeded PRNG (sfc32). State is four uint32 words so it can be serialized into run saves
 * and hashed for determinism checks.
 */
export interface Rng {
  readonly state: Uint32Array;
}

/** cyrb53-style string hash folded to uint32; used to derive seeds from names and dates. */
export function hashString(input: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 ^ h2) >>> 0;
}

function splitmix32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    return (z ^ (z >>> 16)) >>> 0;
  };
}

export function createRng(seed: number): Rng {
  const next = splitmix32(seed);
  const state = new Uint32Array([next(), next(), next(), next()]);
  const rng = { state };
  // Discard early outputs; sfc32 needs a few rounds to decorrelate from the seed.
  for (let i = 0; i < 12; i++) nextU32(rng);
  return rng;
}

export function nextU32(rng: Rng): number {
  const s = rng.state;
  const a = s[0] as number;
  const b = s[1] as number;
  const c = s[2] as number;
  const d = s[3] as number;
  const t = (((a + b) >>> 0) + d) >>> 0;
  s[3] = (d + 1) >>> 0;
  s[0] = b ^ (b >>> 9);
  s[1] = (c + (c << 3)) >>> 0;
  s[2] = ((c << 21) | (c >>> 11)) >>> 0;
  s[2] = ((s[2] as number) + t) >>> 0;
  return t;
}

/** Uniform float in [0, 1). */
export function nextFloat(rng: Rng): number {
  return nextU32(rng) / 4294967296;
}

/** Uniform float in [min, max). */
export function nextRange(rng: Rng, min: number, max: number): number {
  return min + (max - min) * nextFloat(rng);
}

/** Uniform integer in [min, maxExclusive). */
export function nextInt(rng: Rng, min: number, maxExclusive: number): number {
  return min + Math.floor(nextFloat(rng) * (maxExclusive - min));
}

export function nextBool(rng: Rng, chance = 0.5): boolean {
  return nextFloat(rng) < chance;
}

export function cloneRng(rng: Rng): Rng {
  return { state: new Uint32Array(rng.state) };
}

/**
 * Independent streams per domain, so that e.g. a combat change does not reshuffle map generation.
 * `vfx` is for cosmetic randomness inside the sim and must never influence gameplay.
 */
export const RNG_STREAMS = ['map', 'loot', 'spawn', 'combat', 'ai', 'vfx'] as const;
export type RngStreamName = (typeof RNG_STREAMS)[number];
export type RngStreams = Record<RngStreamName, Rng>;

export function createRngStreams(runSeed: number): RngStreams {
  const streams = {} as RngStreams;
  for (const name of RNG_STREAMS) {
    streams[name] = createRng(hashString(`${runSeed >>> 0}:${name}`));
  }
  return streams;
}

/** Seed shared by every player on the same UTC day. */
export function dailySeed(utcYear: number, utcMonth1: number, utcDay: number): number {
  const mm = String(utcMonth1).padStart(2, '0');
  const dd = String(utcDay).padStart(2, '0');
  return hashString(`riftbrand-daily-${utcYear}-${mm}-${dd}`);
}
