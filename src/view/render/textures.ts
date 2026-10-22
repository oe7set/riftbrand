import { Graphics, Rectangle, type Renderer, Texture } from 'pixi.js';
import { ENEMIES } from '../../content/enemies';
import { PALETTE } from './palette';

/** Base radius the body textures are drawn at; sprites scale by actualRadius / BAKE_RADIUS_PX. */
export const BAKE_RADIUS_PX = 16;
/** Extra room around the body for the glow halo, as a multiple of the radius. */
const GLOW_EXTENT = 2.2;
const BAKE_RESOLUTION = 3;

export interface BodyTextures {
  normal: Texture;
  /** Solid white silhouette swapped in for the hit flash. */
  flash: Texture;
}

export interface BakedTextures {
  player: BodyTextures;
  drifter: BodyTextures;
  /** Indexed by enemy type. */
  enemies: BodyTextures[];
  enemyShot: Texture;
  /** White particle shapes, tinted per use. */
  dot: Texture;
  spark: Texture;
  ring: Texture;
  disc: Texture;
  /** 1×1 white for bars and rectangles. */
  white: Texture;
  vignette: Texture;
}

function glowHalo(g: Graphics, color: number, radius: number): void {
  // Cheap pre-rendered bloom for the "low" quality tier; the bloom filter adds to it on "high".
  for (let i = 6; i >= 1; i--) {
    g.circle(0, 0, radius * (1 + i * 0.2)).fill({ color, alpha: 0.035 * (7 - i) });
  }
}

function bake(renderer: Renderer, g: Graphics, extentPx = BAKE_RADIUS_PX * GLOW_EXTENT): Texture {
  // Fixed frame centred on the origin so anchor 0.5 is the body centre, regardless of shape.
  const frame = new Rectangle(-extentPx, -extentPx, extentPx * 2, extentPx * 2);
  const texture = renderer.generateTexture({ target: g, frame, resolution: BAKE_RESOLUTION });
  g.destroy();
  return texture;
}

function polygonPoints(sides: number, radius: number, rotationDeg: number): number[] {
  const points: number[] = [];
  const rot = (rotationDeg * Math.PI) / 180;
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2;
    points.push(Math.cos(a) * radius, Math.sin(a) * radius);
  }
  return points;
}

function shape(g: Graphics, sides: number, radius: number, rotationDeg: number): Graphics {
  return sides >= 3 ? g.poly(polygonPoints(sides, radius, rotationDeg)) : g.circle(0, 0, radius);
}

function enemyTextures(
  renderer: Renderer,
  color: number,
  sides: number,
  rot: number,
): BodyTextures {
  const r = BAKE_RADIUS_PX;
  const g = new Graphics();
  glowHalo(g, color, r * 0.9);
  shape(g, sides, r, rot).fill({ color, alpha: 0.22 }).stroke({ color, width: 2.5 });
  shape(g, sides, r * 0.45, rot).fill({ color, alpha: 0.9 });
  // Facing marker so players can read where an enemy is aiming.
  g.circle(r * 0.62, 0, r * 0.14).fill({ color: 0xffffff, alpha: 0.9 });
  const flash = new Graphics();
  shape(flash, sides, r * 1.05, rot).fill({ color: 0xffffff });
  return { normal: bake(renderer, g), flash: bake(renderer, flash) };
}

function radialTexture(size: number, stops: Array<[number, string]>): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [offset, color] of stops) grad.addColorStop(offset, color);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  return Texture.from(canvas);
}

/** Procedural vector art (GDD §12.1), rendered once into textures at startup. */
export function bakeTextures(renderer: Renderer): BakedTextures {
  const r = BAKE_RADIUS_PX;

  const player = new Graphics();
  glowHalo(player, PALETTE.player, r);
  player.circle(0, 0, r).fill({ color: PALETTE.player, alpha: 0.25 });
  player.circle(0, 0, r).stroke({ color: PALETTE.player, width: 2.5 });
  player.circle(0, 0, r * 0.45).fill({ color: PALETTE.playerCore });
  // Facing notch: the sprite rotates so this always points along the aim/move direction.
  player
    .poly([r * 1.15, 0, r * 0.7, -r * 0.38, r * 0.7, r * 0.38])
    .fill({ color: PALETTE.playerCore });
  const playerFlash = new Graphics();
  playerFlash.circle(0, 0, r * 1.05).fill({ color: 0xffffff });

  const drifter = new Graphics();
  glowHalo(drifter, PALETTE.drifter, r * 0.8);
  drifter
    .poly([0, -r, r, 0, 0, r, -r, 0])
    .fill({ color: PALETTE.drifter, alpha: 0.2 })
    .stroke({ color: PALETTE.drifter, width: 2.5 });
  const drifterFlash = new Graphics();
  drifterFlash.poly([0, -r, r, 0, 0, r, -r, 0]).fill({ color: 0xffffff });

  const shot = new Graphics();
  glowHalo(shot, PALETTE.enemyShot, r * 0.7);
  shot.circle(0, 0, r).fill({ color: PALETTE.enemyShot, alpha: 0.6 });
  shot.circle(0, 0, r * 0.55).fill({ color: 0xffffff });

  const dot = new Graphics();
  for (let i = 5; i >= 1; i--) dot.circle(0, 0, (r * i) / 5).fill({ color: 0xffffff, alpha: 0.2 });
  const spark = new Graphics();
  spark.poly([-r, 0, 0, -r * 0.18, r, 0, 0, r * 0.18]).fill({ color: 0xffffff });
  const ring = new Graphics();
  ring.circle(0, 0, r * 0.94).stroke({ color: 0xffffff, width: 2 });
  const disc = new Graphics();
  disc.circle(0, 0, r).fill({ color: 0xffffff });

  return {
    player: { normal: bake(renderer, player), flash: bake(renderer, playerFlash) },
    drifter: { normal: bake(renderer, drifter), flash: bake(renderer, drifterFlash) },
    enemies: ENEMIES.map((e) =>
      enemyTextures(renderer, e.visual.color, e.visual.sides, e.visual.rotationDeg),
    ),
    enemyShot: bake(renderer, shot),
    dot: bake(renderer, dot, r),
    spark: bake(renderer, spark, r),
    ring: bake(renderer, ring, r),
    disc: bake(renderer, disc, r),
    white: Texture.WHITE,
    vignette: radialTexture(256, [
      [0, 'rgba(0,0,0,0)'],
      [0.55, 'rgba(0,0,0,0)'],
      [1, 'rgba(255,255,255,1)'],
    ]),
  };
}
