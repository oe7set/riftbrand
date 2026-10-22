import { setVec2, type Vec2 } from '../../shared/math/vec2';

/**
 * Radial deadzone with rescaling: values inside `deadzone` become 0 and the remaining range is
 * stretched back to 0..1 so the stick never "jumps" at the deadzone edge.
 */
export function applyRadialDeadzone(out: Vec2, x: number, y: number, deadzone: number): Vec2 {
  const len = Math.sqrt(x * x + y * y);
  if (len <= deadzone || len === 0) return setVec2(out, 0, 0);
  const scaled = Math.min(1, (len - deadzone) / (1 - deadzone));
  return setVec2(out, (x / len) * scaled, (y / len) * scaled);
}

/** Converts digital directions to a vector of length 0 or 1 (diagonals normalized). */
export function digitalToVector(
  out: Vec2,
  left: boolean,
  right: boolean,
  up: boolean,
  down: boolean,
): Vec2 {
  const x = (right ? 1 : 0) - (left ? 1 : 0);
  const y = (down ? 1 : 0) - (up ? 1 : 0);
  if (x !== 0 && y !== 0) return setVec2(out, x * Math.SQRT1_2, y * Math.SQRT1_2);
  return setVec2(out, x, y);
}
