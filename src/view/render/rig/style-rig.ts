import { type ArtStyleDef, mixColor } from '../../../content/art/styles';
import type { RigDef, RigShapeDef } from '../../../content/schema';

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
    parts: rig.parts.map((part) => {
      if (!s.eyes || part.id !== 'head') return part;
      return { ...part, shapes: part.shapes.flatMap((shape) => toEyes(shape, s.outlineColor)) };
    }),
  };
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
