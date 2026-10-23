import { Graphics, Rectangle, type Renderer, Texture } from 'pixi.js';
import { ENEMIES } from '../../content/enemies';
import type { Glyph } from '../../content/schema';
import { SPELLS } from '../../content/spells';
import { STATUSES } from '../../content/statuses';
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
  riftShot: BodyTextures;
  firebird: BodyTextures;
  /** White particle shapes, tinted per use. */
  dot: Texture;
  spark: Texture;
  ring: Texture;
  disc: Texture;
  /** Frontal shield arc pointing along +x (shielded elites). */
  shieldArc: Texture;
  /** Status icons (dark disc, coloured rim and glyph), indexed by status index. */
  statusIcons: Texture[];
  /** Spell icons, indexed by spell index. */
  spellIcons: Texture[];
  /** 1×1 white for bars and rectangles. */
  white: Texture;
  vignette: Texture;
  /** Smooth radial falloff (white centre to transparent edge), GLOW_TEXTURE_PX wide. */
  softGlow: Texture;
}

export const GLOW_TEXTURE_PX = 128;

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

/** Projectiles don't flash on hit; both slots share one texture. */
function projectileTextures(texture: Texture): BodyTextures {
  return { normal: texture, flash: texture };
}

/** Glyphs differ in shape, not only colour, so statuses stay readable for colour-blind players. */
function drawGlyph(g: Graphics, glyph: Glyph, r: number, color: number): void {
  switch (glyph) {
    case 'flame':
      g.poly([
        -0.1 * r,
        -0.8 * r,
        0.08 * r,
        -0.35 * r,
        0.3 * r,
        -0.55 * r,
        0.45 * r,
        0.12 * r,
        0.25 * r,
        0.55 * r,
        -0.25 * r,
        0.55 * r,
        -0.45 * r,
        0.12 * r,
        -0.3 * r,
        -0.2 * r,
      ]).fill({ color });
      g.circle(0, 0.25 * r, 0.16 * r).fill({ color: 0xffffff });
      break;
    case 'snowflake':
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI) / 3 + Math.PI / 2;
        const dx = Math.cos(a) * 0.62 * r;
        const dy = Math.sin(a) * 0.62 * r;
        g.moveTo(-dx, -dy)
          .lineTo(dx, dy)
          .stroke({ color, width: r * 0.16, cap: 'round' });
      }
      g.circle(0, 0, 0.14 * r).fill({ color: 0xffffff });
      break;
    case 'drop':
      g.poly([0, -0.68 * r, 0.34 * r, 0.02 * r, -0.34 * r, 0.02 * r]).fill({ color });
      g.circle(0, 0.18 * r, 0.38 * r).fill({ color });
      g.circle(-0.12 * r, 0.1 * r, 0.1 * r).fill({ color: 0xffffff, alpha: 0.85 });
      break;
    case 'eye':
      g.ellipse(0, 0, 0.66 * r, 0.36 * r).stroke({ color, width: r * 0.14 });
      g.circle(0, 0, 0.2 * r).fill({ color });
      for (let i = 0; i < 4; i++) {
        const a = -Math.PI / 2 + (i - 1.5) * 0.45;
        g.moveTo(Math.cos(a) * 0.5 * r, Math.sin(a) * 0.5 * r - 0.1 * r)
          .lineTo(Math.cos(a) * 0.78 * r, Math.sin(a) * 0.78 * r - 0.1 * r)
          .stroke({ color, width: r * 0.08, cap: 'round' });
      }
      break;
    case 'nova':
      g.circle(0, 0, 0.22 * r).fill({ color: 0xffffff });
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        g.moveTo(Math.cos(a) * 0.38 * r, Math.sin(a) * 0.38 * r)
          .lineTo(Math.cos(a) * 0.72 * r, Math.sin(a) * 0.72 * r)
          .stroke({ color, width: r * 0.13, cap: 'round' });
      }
      break;
    case 'ray':
      g.moveTo(-0.62 * r, 0.62 * r)
        .lineTo(0.5 * r, -0.5 * r)
        .stroke({ color, width: r * 0.2, cap: 'round' });
      g.star(0.5 * r, -0.5 * r, 4, 0.3 * r, 0.1 * r).fill({ color: 0xffffff });
      break;
    case 'meteor':
      for (let i = 0; i < 3; i++) {
        const o = (i - 1) * 0.22 * r;
        g.moveTo(-0.65 * r + o, -0.1 * r - o)
          .lineTo(0.05 * r + o, 0.6 * r - o)
          .stroke({ color, width: r * 0.09, cap: 'round', alpha: 0.7 });
      }
      g.circle(0.25 * r, -0.25 * r, 0.32 * r).fill({ color });
      g.circle(0.32 * r, -0.32 * r, 0.12 * r).fill({ color: 0xffffff });
      break;
    case 'cloud':
      g.circle(-0.3 * r, 0.1 * r, 0.3 * r).fill({ color });
      g.circle(0.05 * r, -0.12 * r, 0.36 * r).fill({ color });
      g.circle(0.35 * r, 0.12 * r, 0.27 * r).fill({ color });
      g.rect(-0.3 * r, 0.1 * r, 0.65 * r, 0.3 * r).fill({ color });
      break;
  }
}

/**
 * Spell icons: a diamond frame in the school colour (auras get a ring around it), so spells
 * never read as statuses (round) or relics.
 */
function spellIcon(renderer: Renderer, glyph: Glyph, color: number, aura: boolean): Texture {
  const r = BAKE_RADIUS_PX;
  const g = new Graphics();
  const diamond = [0, -r, r, 0, 0, r, -r, 0];
  if (aura) g.circle(0, 0, r * 1.12).stroke({ color, width: r * 0.08, alpha: 0.8 });
  g.poly(diamond).fill({ color: PALETTE.background, alpha: 0.9 });
  g.poly(diamond).stroke({ color, width: r * 0.12 });
  drawGlyph(g, glyph, r * 0.62, color);
  return bake(renderer, g, r * 1.25);
}

function statusIcon(renderer: Renderer, glyph: Glyph, color: number): Texture {
  const r = BAKE_RADIUS_PX;
  const g = new Graphics();
  g.circle(0, 0, r * 1.15).fill({ color, alpha: 0.18 });
  g.circle(0, 0, r).fill({ color: PALETTE.background, alpha: 0.9 });
  g.circle(0, 0, r).stroke({ color, width: r * 0.12 });
  drawGlyph(g, glyph, r * 0.85, color);
  return bake(renderer, g, r * 1.2);
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

  // Rift shot: elongated diamond pointing along +x (sprites rotate to the flight direction).
  const rift = new Graphics();
  glowHalo(rift, PALETTE.riftShot, r * 0.6);
  rift
    .poly([r * 1.6, 0, 0, -r * 0.55, -r * 0.9, 0, 0, r * 0.55])
    .fill({ color: PALETTE.riftShot, alpha: 0.7 });
  rift.poly([r * 1.2, 0, 0, -r * 0.25, -r * 0.4, 0, 0, r * 0.25]).fill({ color: 0xffffff });

  // Firebird: a swept-wing chevron with a bright core.
  const bird = new Graphics();
  glowHalo(bird, PALETTE.firebird, r);
  bird
    .poly([r * 1.3, 0, -r * 0.6, -r * 1.1, -r * 0.1, 0, -r * 0.6, r * 1.1])
    .fill({ color: PALETTE.firebird, alpha: 0.8 })
    .stroke({ color: 0xffe0a0, width: 2 });
  bird.circle(r * 0.35, 0, r * 0.3).fill({ color: 0xffffff });

  const dot = new Graphics();
  for (let i = 5; i >= 1; i--) dot.circle(0, 0, (r * i) / 5).fill({ color: 0xffffff, alpha: 0.2 });
  const spark = new Graphics();
  spark.poly([-r, 0, 0, -r * 0.18, r, 0, 0, r * 0.18]).fill({ color: 0xffffff });
  const ring = new Graphics();
  ring.circle(0, 0, r * 0.94).stroke({ color: 0xffffff, width: 2 });
  const disc = new Graphics();
  disc.circle(0, 0, r).fill({ color: 0xffffff });
  const shieldArc = new Graphics();
  shieldArc.arc(0, 0, r * 0.9, -1.2, 1.2).stroke({ color: 0xffffff, width: 4, cap: 'round' });
  shieldArc.arc(0, 0, r * 0.9, -1.2, 1.2).stroke({ color: 0xffffff, width: 9, alpha: 0.25 });

  return {
    player: { normal: bake(renderer, player), flash: bake(renderer, playerFlash) },
    drifter: { normal: bake(renderer, drifter), flash: bake(renderer, drifterFlash) },
    enemies: ENEMIES.map((e) =>
      enemyTextures(renderer, e.visual.color, e.visual.sides, e.visual.rotationDeg),
    ),
    enemyShot: bake(renderer, shot),
    riftShot: projectileTextures(bake(renderer, rift)),
    firebird: projectileTextures(bake(renderer, bird)),
    dot: bake(renderer, dot, r),
    spark: bake(renderer, spark, r),
    ring: bake(renderer, ring, r),
    disc: bake(renderer, disc, r),
    shieldArc: bake(renderer, shieldArc, r),
    statusIcons: STATUSES.map((s) => statusIcon(renderer, s.visual.glyph, s.visual.color)),
    spellIcons: SPELLS.map((s) =>
      spellIcon(renderer, s.visual.glyph, s.visual.color, s.kind === 'aura'),
    ),
    white: Texture.WHITE,
    softGlow: radialTexture(GLOW_TEXTURE_PX, [
      [0, 'rgba(255,255,255,1)'],
      [0.45, 'rgba(255,255,255,0.45)'],
      [1, 'rgba(255,255,255,0)'],
    ]),
    vignette: radialTexture(256, [
      [0, 'rgba(0,0,0,0)'],
      [0.55, 'rgba(0,0,0,0)'],
      [1, 'rgba(255,255,255,1)'],
    ]),
  };
}
