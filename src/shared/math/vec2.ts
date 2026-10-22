export interface Vec2 {
  x: number;
  y: number;
}

export function vec2(x = 0, y = 0): Vec2 {
  return { x, y };
}

export function setVec2(out: Vec2, x: number, y: number): Vec2 {
  out.x = x;
  out.y = y;
  return out;
}

export function lengthOf(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

/** Writes the unit vector of (x, y) into `out`; zero-length input yields (0, 0). */
export function normalizeInto(out: Vec2, x: number, y: number): Vec2 {
  const len = lengthOf(x, y);
  if (len === 0) return setVec2(out, 0, 0);
  return setVec2(out, x / len, y / len);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
