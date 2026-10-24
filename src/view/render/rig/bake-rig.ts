import { Graphics, Rectangle, type Renderer, type Texture } from 'pixi.js';
import type { RigDef, RigShapeDef } from '../../../content/schema';
import { BAKE_RADIUS_PX } from '../textures';
import {
  createPose,
  createRigInput,
  layoutRig,
  POSE_STRIDE,
  poseRig,
  type RigLayout,
} from './animate';

const BAKE_RESOLUTION = 3;
/** Glow passes: widths (rig units) and alphas, outermost first. */
const GLOW_PASSES: ReadonlyArray<readonly [number, number]> = [
  [0.42, 0.06],
  [0.28, 0.1],
  [0.16, 0.16],
];

export interface BakedPart {
  normal: Texture;
  /** White silhouette for the hit flash. */
  flash: Texture;
  /** Joint position inside the texture (0..1), used as the sprite anchor. */
  anchorX: number;
  anchorY: number;
  /** Texture centre relative to the joint, rig units (particles anchor at the centre). */
  centerX: number;
  centerY: number;
}

export interface BakedRig {
  layout: RigLayout;
  parts: BakedPart[];
  /** Whole figure in its rest pose, white, centred on the entity position (dash afterimages). */
  ghost: Texture;
  /** Half the ghost texture's size in rig units (for scaling particles). */
  ghostExtentUnits: number;
}

type Paint = 'body' | 'accent' | 'core' | number;

function colorOf(rig: RigDef, paint: Paint): number {
  return typeof paint === 'number' ? paint : rig.colors[paint];
}

function trace(g: Graphics, shape: RigShapeDef, u: number): void {
  if (shape.kind === 'ellipse') {
    g.ellipse(shape.x * u, shape.y * u, shape.rx * u, shape.ry * u);
    return;
  }
  const pts = shape.points;
  if (shape.kind === 'poly') {
    g.poly(pts.map((v) => v * u));
    return;
  }
  g.moveTo((pts[0] ?? 0) * u, (pts[1] ?? 0) * u);
  for (let i = 2; i + 1 < pts.length; i += 2) g.lineTo((pts[i] ?? 0) * u, (pts[i + 1] ?? 0) * u);
}

/** Draws a shape in colour (with glow) or as a white silhouette. */
function drawShape(g: Graphics, rig: RigDef, shape: RigShapeDef, u: number, flash: boolean): void {
  const strokeColor = shape.stroke !== undefined ? colorOf(rig, shape.stroke) : null;
  const fillColor = shape.fill !== undefined ? colorOf(rig, shape.fill) : null;
  const line = shape.kind === 'line';
  const width = shape.strokeWidth * u;
  if (flash) {
    trace(g, shape, u);
    if (!line && fillColor !== null) g.fill({ color: 0xffffff });
    if (line || strokeColor !== null) {
      g.stroke({ color: 0xffffff, width: Math.max(width, 0.05 * u), cap: 'round', join: 'round' });
    }
    return;
  }
  const glowColor = strokeColor ?? fillColor;
  if (shape.glow && glowColor !== null) {
    for (const [w, alpha] of GLOW_PASSES) {
      trace(g, shape, u);
      g.stroke({ color: glowColor, width: width + w * u, alpha, cap: 'round', join: 'round' });
    }
  }
  trace(g, shape, u);
  if (!line && fillColor !== null) g.fill({ color: fillColor, alpha: shape.fillAlpha });
  if (strokeColor !== null) g.stroke({ color: strokeColor, width, cap: 'round', join: 'round' });
}

/** Bounding box of a part's shapes in rig units, padded for strokes and glow. */
function boundsOf(shapes: readonly RigShapeDef[]): [number, number, number, number] {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const s of shapes) {
    const pad = s.strokeWidth / 2 + (s.glow ? (GLOW_PASSES[0]?.[0] ?? 0) / 2 : 0) + 0.02;
    if (s.kind === 'ellipse') {
      minX = Math.min(minX, s.x - s.rx - pad);
      maxX = Math.max(maxX, s.x + s.rx + pad);
      minY = Math.min(minY, s.y - s.ry - pad);
      maxY = Math.max(maxY, s.y + s.ry + pad);
      continue;
    }
    for (let i = 0; i + 1 < s.points.length; i += 2) {
      const x = s.points[i] ?? 0;
      const y = s.points[i + 1] ?? 0;
      minX = Math.min(minX, x - pad);
      maxX = Math.max(maxX, x + pad);
      minY = Math.min(minY, y - pad);
      maxY = Math.max(maxY, y + pad);
    }
  }
  return [minX, minY, maxX, maxY];
}

function render(renderer: Renderer, g: Graphics, frame: Rectangle): Texture {
  const texture = renderer.generateTexture({ target: g, frame, resolution: BAKE_RESOLUTION });
  g.destroy();
  return texture;
}

/** Bakes every part once at startup; animation only moves the resulting sprites (ROADMAP M4). */
export function bakeRig(renderer: Renderer, rig: RigDef): BakedRig {
  const u = BAKE_RADIUS_PX;
  const parts = rig.parts.map((part): BakedPart => {
    const [minX, minY, maxX, maxY] = boundsOf(part.shapes);
    const frame = new Rectangle(minX * u, minY * u, (maxX - minX) * u, (maxY - minY) * u);
    const normal = new Graphics();
    const flash = new Graphics();
    for (const shape of part.shapes) {
      drawShape(normal, rig, shape, u, false);
      drawShape(flash, rig, shape, u, true);
    }
    return {
      normal: render(renderer, normal, frame),
      flash: render(renderer, flash, frame),
      anchorX: -minX / (maxX - minX),
      anchorY: -minY / (maxY - minY),
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
    };
  });

  const layout = layoutRig(rig);
  const pose = createPose(rig);
  poseRig(layout, createRigInput(), pose);
  const ghost = new Graphics();
  let extent = 0;
  for (const i of layout.drawOrder) {
    const part = rig.parts[i];
    if (!part) continue;
    const o = i * POSE_STRIDE;
    const x = pose[o] as number;
    const y = pose[o + 1] as number;
    const r = pose[o + 2] as number;
    const c = Math.cos(r);
    const s = Math.sin(r);
    ghost.setTransform(c, s, -s, c, x * u, y * u);
    for (const shape of part.shapes) drawShape(ghost, rig, shape, u, true);
    const [minX, minY, maxX, maxY] = boundsOf(part.shapes);
    extent = Math.max(extent, Math.hypot(x, y) + Math.max(-minX, -minY, maxX, maxY));
  }
  const half = extent * u;
  const ghostTexture = render(renderer, ghost, new Rectangle(-half, -half, half * 2, half * 2));
  return { layout, parts, ghost: ghostTexture, ghostExtentUnits: extent };
}

/** Frees a rig baked at runtime (armour looks); the startup rigs live for the whole session. */
export function destroyBakedRig(baked: BakedRig): void {
  for (const part of baked.parts) {
    part.normal.destroy(true);
    part.flash.destroy(true);
  }
  baked.ghost.destroy(true);
}
