import { type ArtStyleDef, mixColor } from '../../../content/art/style';
import { type RigDef, type RigShapeDef, restingRigMotion } from '../../../content/schema';

/** Eye dots up to this size (rig units) become big friendly eyes in styles with `eyes`. */
const EYE_DOT_MAX_UNITS = 0.13;
const EYE_SCALE = 1.9;
const PUPIL_SHARE = 0.55;

/**
 * A rig recoloured for an art style (ROADMAP M4.5): explicit colours for some rigs, the rest
 * blended towards the style's tone, glowing eye dots turned into eyes. Pure; baked once.
 */
export function styleRig(rig: RigDef, style: ArtStyleDef): RigDef {
  const s = style.rigs;
  const colors = s.overrides[rig.id] ?? {
    body: mixColor(rig.colors.body, s.mixColor, s.mixAmount),
    accent: mixColor(rig.colors.accent, s.mixColor, s.mixAmount),
    core: mixColor(rig.colors.core, s.mixColor, s.mixAmount),
  };
  return {
    ...rig,
    colors,
    glowAlpha: rig.glowAlpha * s.glow,
    parts: s.eyes ? withEyes(rig.parts, s.outlineColor) : rig.parts,
  };
}

/**
 * Eye dots on the head become a separate `eyes` part right after it, centred on the eye so a
 * blink (uniform shrink) closes it in place.
 */
function withEyes(parts: RigDef['parts'], ink: number): RigDef['parts'] {
  const out: RigDef['parts'] = [];
  for (const part of parts) {
    if (part.id !== 'head') {
      out.push(part);
      continue;
    }
    const dots = part.shapes.filter(isEyeDot);
    const rest = part.shapes.filter((shape) => !isEyeDot(shape));
    const first = dots[0];
    if (!first || rest.length === 0) {
      out.push(part);
      continue;
    }
    out.push({ ...part, shapes: rest });
    const cx = first.x;
    const cy = first.y;
    out.push({
      id: 'eyes',
      parent: part.id,
      x: cx,
      y: cy,
      rotationDeg: 0,
      z: part.z,
      motion: { ...restingRigMotion(), blink: 1 },
      shapes: dots.flatMap((dot) => toEyes({ ...dot, x: dot.x - cx, y: dot.y - cy }, ink)),
    });
  }
  return out;
}

function isEyeDot(shape: RigShapeDef): shape is Extract<RigShapeDef, { kind: 'ellipse' }> {
  return (
    shape.kind === 'ellipse' &&
    shape.glow &&
    shape.fill === 'core' &&
    Math.max(shape.rx, shape.ry) <= EYE_DOT_MAX_UNITS
  );
}

/** A glowing eye dot becomes a white eye with a dark pupil looking forward. */
function toEyes(shape: RigShapeDef, ink: number): RigShapeDef[] {
  if (!isEyeDot(shape)) return [shape];
  const r = Math.max(shape.rx, shape.ry) * EYE_SCALE;
  const white: RigShapeDef = {
    kind: 'ellipse',
    x: shape.x,
    y: shape.y,
    rx: r * 0.85,
    ry: r,
    fill: 0xffffff,
    fillAlpha: 1,
    stroke: ink,
    strokeWidth: 0.03,
    glow: false,
  };
  const pupil: RigShapeDef = {
    kind: 'ellipse',
    x: shape.x + r * 0.25,
    y: shape.y + r * 0.05,
    rx: r * PUPIL_SHARE * 0.8,
    ry: r * PUPIL_SHARE,
    fill: ink,
    fillAlpha: 1,
    strokeWidth: 0,
    glow: false,
  };
  const shine: RigShapeDef = {
    kind: 'ellipse',
    x: shape.x + r * 0.4,
    y: shape.y - r * 0.2,
    rx: r * 0.18,
    ry: r * 0.18,
    fill: 0xffffff,
    fillAlpha: 1,
    strokeWidth: 0,
    glow: false,
  };
  return [white, pupil, shine];
}
