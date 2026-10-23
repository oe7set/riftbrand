import { RIG_TUNING } from '../../../content/rigs';
import type { RigDef } from '../../../content/schema';

/** Per part in the pose buffer: x, y (rig units), rotation (radians), uniform scale. */
export const POSE_STRIDE = 4;

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

/** Precomputed lookups so posing needs no searches or allocations per frame. */
export interface RigLayout {
  readonly rig: RigDef;
  /** Parent part index, -1 for roots. */
  readonly parent: Int8Array;
  /** Index of the weapon part, -1 without a weapon. */
  readonly weapon: number;
  /** Part indices sorted by `z` (back to front). */
  readonly drawOrder: readonly number[];
}

export function layoutRig(rig: RigDef): RigLayout {
  const parent = new Int8Array(rig.parts.length);
  rig.parts.forEach((part, i) => {
    parent[i] = part.parent === undefined ? -1 : rig.parts.findIndex((p) => p.id === part.parent);
  });
  const drawOrder = rig.parts
    .map((_, i) => i)
    .sort((a, b) => {
      const za = rig.parts[a]?.z ?? 0;
      const zb = rig.parts[b]?.z ?? 0;
      return za - zb || a - b;
    });
  const weapon = rig.weapon ? rig.parts.findIndex((p) => p.id === rig.weapon?.part) : -1;
  return { rig, parent, weapon, drawOrder };
}

/** What the view reads from the sim for one entity; reused across entities and frames. */
export interface RigInput {
  timeSec: number;
  /** Accumulated walk cycles (distance / stride). */
  walkCycles: number;
  /** 0 = standing, 1 = full speed. */
  move: number;
  /** Attack windup and strike blends (0..1). */
  windup: number;
  strike: number;
  /** Spell or rift shot pose (0..1). */
  cast: number;
  /** Aim direction in rig space, degrees (0 = forward, -90 = up). */
  aimDeg: number;
  /** Combo step being swung, -1 when not attacking. */
  swingStep: number;
  /** 0..1 windup, 1..2 strike, 2..3 recovery. */
  swingPhase: number;
  /** Progress of the special whirl (0..1), -1 when not whirling. */
  whirl: number;
  /** Recoil from a hit, -1..1 (positive leans back). */
  twitch: number;
  /** Extra forward lean as a multiple of the rig's lean (dash). */
  lean: number;
}

export function createRigInput(): RigInput {
  return {
    timeSec: 0,
    walkCycles: 0,
    move: 0,
    windup: 0,
    strike: 0,
    cast: 0,
    aimDeg: 0,
    swingStep: -1,
    swingPhase: 0,
    whirl: -1,
    twitch: 0,
    lean: 0,
  };
}

export function resetRigInput(input: RigInput): RigInput {
  input.walkCycles = 0;
  input.move = 0;
  input.windup = 0;
  input.strike = 0;
  input.cast = 0;
  input.aimDeg = 0;
  input.swingStep = -1;
  input.swingPhase = 0;
  input.whirl = -1;
  input.twitch = 0;
  input.lean = 0;
  return input;
}

export function createPose(rig: RigDef): Float32Array {
  return new Float32Array(rig.parts.length * POSE_STRIDE);
}

function easeOut(t: number): number {
  const k = 1 - Math.min(1, Math.max(0, t));
  return 1 - k * k;
}

/** World direction (degrees, rig space) the weapon arm points to, or NaN when it just hangs. */
function weaponDirDeg(layout: RigLayout, input: RigInput): number {
  const weapon = layout.rig.weapon;
  if (!weapon) return Number.NaN;
  // Straight down is 90°; the arm hangs a little forward of that.
  const restDir = 90 + weapon.restDeg;
  if (input.whirl >= 0) return input.aimDeg + 360 * weapon.specialTurns * easeOut(input.whirl);
  if (input.swingStep < 0) return Number.NaN;
  const swing = weapon.swings[input.swingStep % weapon.swings.length];
  if (!swing) return Number.NaN;
  const windupDir = input.aimDeg + swing.windupDeg;
  const strikeDir = input.aimDeg + swing.strikeDeg;
  const p = input.swingPhase;
  if (p < 1) return restDir + (windupDir - restDir) * easeOut(p);
  if (p < 2) return windupDir + (strikeDir - windupDir) * easeOut(p - 1);
  return strikeDir + (restDir - strikeDir) * Math.min(1, p - 2);
}

/** Forward push of the weapon in a thrust (rig units). */
function weaponReach(layout: RigLayout, input: RigInput): number {
  const weapon = layout.rig.weapon;
  if (!weapon || input.swingStep < 0) return 0;
  const reach = weapon.swings[input.swingStep % weapon.swings.length]?.reach ?? 0;
  const p = input.swingPhase;
  return p >= 1 && p < 3 ? reach * Math.sin(((p - 1) / 2) * Math.PI) : 0;
}

/**
 * Poses a rig into `out` (world transforms in rig space, see POSE_STRIDE). Pure and
 * allocation-free: hot path for every rigged entity each frame (CLAUDE.md performance rules).
 */
export function poseRig(layout: RigLayout, input: RigInput, out: Float32Array): void {
  const rig = layout.rig;
  const move = input.move;
  const walk = input.walkCycles;
  const breathe = Math.sin((TAU * input.timeSec) / RIG_TUNING.breathSec) * (1 - move);
  const bob = rig.bobUnits * Math.abs(Math.sin(TAU * walk)) * move;
  const rootLeanDeg = rig.leanDeg * (move + input.lean) - RIG_TUNING.twitchDeg * input.twitch;
  const weaponDir = weaponDirDeg(layout, input);
  const reach = weaponReach(layout, input);
  const parts = rig.parts;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;
    const m = part.motion;
    const swing = Math.sin(TAU * (walk + m.walkPhase));
    let rot =
      part.rotationDeg +
      m.walkSwingDeg * swing * move +
      m.windupDeg * input.windup +
      m.strikeDeg * input.strike +
      m.castDeg * input.cast +
      m.lagDeg * move +
      m.flutterDeg * Math.sin(TAU * 2 * walk + i) * move;
    let lx = part.x + m.windupX * input.windup + m.strikeX * input.strike;
    let ly =
      part.y +
      m.windupY * input.windup +
      m.strikeY * input.strike -
      m.walkLift * Math.max(0, -Math.cos(TAU * (walk + m.walkPhase))) * move;
    const p = layout.parent[i] as number;
    const o = i * POSE_STRIDE;
    let px = 0;
    let py = 0;
    let pr = 0;
    if (p < 0) {
      rot += rootLeanDeg;
      ly -= bob;
    } else {
      const po = p * POSE_STRIDE;
      px = out[po] as number;
      py = out[po + 1] as number;
      pr = out[po + 2] as number;
    }
    let wr = pr + rot * DEG;
    if (i === layout.weapon && !Number.isNaN(weaponDir)) {
      // The arm's local +y points along the weapon direction, whatever the torso does.
      wr = (weaponDir - 90) * DEG;
      const dirRad = weaponDir * DEG;
      // Push along the aim, expressed in the parent's space.
      const fx = Math.cos(dirRad) * reach;
      const fy = Math.sin(dirRad) * reach;
      const c = Math.cos(-pr);
      const s = Math.sin(-pr);
      lx += c * fx - s * fy;
      ly += s * fx + c * fy;
    }
    const c = Math.cos(pr);
    const s = Math.sin(pr);
    out[o] = px + c * lx - s * ly;
    out[o + 1] = py + s * lx + c * ly;
    out[o + 2] = wr;
    out[o + 3] = 1 + m.breath * breathe;
  }
}
