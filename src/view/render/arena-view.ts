import { Container, Graphics } from 'pixi.js';
import type { ArtStyleDef } from '../../content/art/styles';
import { crackPoints, scatterRandom } from './scatter';

const GRID_PX = 64;
const MAJOR_EVERY = 4;
const GRID_MINOR = 0x1c1830;
const GRID_MAJOR = 0x2a2346;
/** Ashfields floor (ROADMAP M4.4): one crack per this much area, some carrying ember veins. */
const CRACK_AREA_PX2 = 70_000;
const EMBER_VEIN_SHARE = 0.4;
/** Friendly floors (ROADMAP M4.5): soft patches and small details per this much area. */
const PATCH_AREA_PX2 = 90_000;
const DETAIL_AREA_PX2 = 9_000;

type Rand = () => number;

/** Static floor and arena border in the art style; rebuilt only when the arena size changes. */
export class ArenaView {
  readonly root = new Container();
  private readonly floor = new Graphics();
  /** Cracks, meadow, doodles or paint under the grid. */
  private readonly ground = new Graphics();
  private width = 0;
  private height = 0;

  constructor(private readonly style: ArtStyleDef) {
    this.root.addChild(this.ground, this.floor);
  }

  private drawGround(width: number, height: number): void {
    const g = this.ground;
    g.clear();
    const rand = scatterRandom(width * 7919 + height);
    const gr = this.style.ground;
    switch (gr.detail) {
      case 'cracks':
        drawCracks(g, rand, width, height, gr.accents);
        break;
      case 'meadow':
        drawPatches(g, rand, width, height, gr.patches, gr.patchAlpha, 10);
        drawMeadow(g, rand, width, height, gr.accents);
        break;
      case 'doodles':
        drawPatches(g, rand, width, height, gr.patches, gr.patchAlpha, 1);
        drawDoodles(g, rand, width, height, gr.accents, this.style.rigs.outlineColor);
        break;
      case 'watercolor':
        drawWatercolor(g, rand, width, height, gr.patches, gr.patchAlpha, gr.accents);
        break;
    }
  }

  sync(width: number, height: number): void {
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    this.drawGround(width, height);
    const g = this.floor;
    g.clear();
    const edge = this.style.edge;
    if (this.style.ground.grid) {
      for (let x = 0, i = 0; x <= width; x += GRID_PX, i++) {
        g.moveTo(x, 0).lineTo(x, height);
        g.stroke({ color: i % MAJOR_EVERY === 0 ? GRID_MAJOR : GRID_MINOR, width: 1 });
      }
      for (let y = 0, i = 0; y <= height; y += GRID_PX, i++) {
        g.moveTo(0, y).lineTo(width, y);
        g.stroke({ color: i % MAJOR_EVERY === 0 ? GRID_MAJOR : GRID_MINOR, width: 1 });
      }
      for (let i = 4; i >= 0; i--) {
        g.rect(-i * 3, -i * 3, width + i * 6, height + i * 6).stroke({
          color: edge,
          width: i === 0 ? 3 : 4,
          alpha: i === 0 ? 1 : 0.08,
        });
      }
      return;
    }
    // Friendly styles: a soft rounded border instead of a glowing neon frame.
    const ink = this.style.obstacle.strokeWidthPx;
    g.roundRect(-6, -6, width + 12, height + 12, 28).stroke({
      color: edge,
      width: 12,
      alpha: 0.12,
    });
    g.roundRect(0, 0, width, height, 22).stroke({ color: edge, width: ink + 1, alpha: 0.85 });
  }
}

function pick(rand: Rand, colors: readonly number[]): number {
  return colors[Math.floor(rand() * colors.length)] ?? 0xffffff;
}

/** Dark cracks across the ash, some glowing with ember veins (the neon look). */
function drawCracks(g: Graphics, rand: Rand, w: number, h: number, accents: readonly number[]) {
  const crack = accents[0] ?? 0x1a1222;
  const vein = accents[1] ?? 0xff6a2a;
  const count = Math.round((w * h) / CRACK_AREA_PX2);
  for (let i = 0; i < count; i++) {
    const pts = crackPoints(rand, rand() * w, rand() * h, 60 + rand() * 180, 14);
    const glowing = rand() < EMBER_VEIN_SHARE;
    if (glowing) g.poly(pts, false).stroke({ color: vein, width: 8, alpha: 0.07 });
    g.poly(pts, false).stroke({
      color: glowing ? vein : crack,
      width: glowing ? 1.6 : 2.2,
      alpha: glowing ? 0.5 : 0.8,
      cap: 'round',
      join: 'round',
    });
  }
}

/** Large soft colour patches; `rings` > 1 fades their edge (light pools, moss). */
function drawPatches(
  g: Graphics,
  rand: Rand,
  w: number,
  h: number,
  colors: readonly number[],
  alpha: number,
  rings: number,
) {
  const count = Math.round((w * h) / PATCH_AREA_PX2) + 2;
  for (let i = 0; i < count; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 90 + rand() * 170;
    const color = pick(rand, colors);
    for (let k = rings; k >= 1; k--) {
      g.ellipse(x, y, (r * k) / rings, ((r * k) / rings) * 0.75).fill({
        color,
        alpha: rings === 1 ? alpha : alpha / rings,
      });
    }
  }
}

/** Grass tufts and little flowers (Glühwürmchen-Abend). */
function drawMeadow(g: Graphics, rand: Rand, w: number, h: number, accents: readonly number[]) {
  const grass = accents.slice(0, 2);
  const flowers = accents.slice(2);
  const count = Math.round((w * h) / DETAIL_AREA_PX2);
  for (let i = 0; i < count; i++) {
    const x = rand() * w;
    const y = rand() * h;
    if (rand() < 0.75) {
      const color = pick(rand, grass);
      for (let b = -1; b <= 1; b++) {
        g.moveTo(x, y)
          .quadraticCurveTo(x + b * 3, y - 6, x + b * 6 + (rand() - 0.5) * 3, y - 10 - rand() * 6)
          .stroke({ color, width: 1.8, alpha: 0.75, cap: 'round' });
      }
    } else {
      const color = pick(rand, flowers);
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        g.circle(x + Math.cos(a) * 3.2, y + Math.sin(a) * 3.2, 2.4).fill({ color, alpha: 0.9 });
      }
      g.circle(x, y, 1.8).fill({ color: 0xfff3c4, alpha: 0.95 });
    }
  }
}

/** Ink doodles: grass strokes, pebbles and the odd mushroom (Bilderbuch). */
function drawDoodles(
  g: Graphics,
  rand: Rand,
  w: number,
  h: number,
  accents: readonly number[],
  ink: number,
) {
  const [dark = 0x2c3a24, light = 0x7fa05e, pebble = 0xe8d9a8, cap = 0xd9604a] = accents;
  const count = Math.round((w * h) / DETAIL_AREA_PX2);
  for (let i = 0; i < count; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const roll = rand();
    if (roll < 0.7) {
      g.moveTo(x - 5, y - 6)
        .lineTo(x - 1, y)
        .lineTo(x + 2, y - 8);
      g.stroke({ color: rand() < 0.5 ? dark : light, width: 2.4, cap: 'round', join: 'round' });
    } else if (roll < 0.92) {
      g.ellipse(x, y, 5 + rand() * 4, 3.5 + rand() * 2)
        .fill({ color: pebble })
        .stroke({ color: ink, width: 2 });
    } else {
      g.rect(x - 2, y - 2, 4, 7)
        .fill({ color: pebble })
        .stroke({ color: ink, width: 1.6 });
      g.ellipse(x, y - 3, 7, 5)
        .fill({ color: cap })
        .stroke({ color: ink, width: 2 });
      g.circle(x - 2, y - 4, 1.2).fill({ color: 0xfff1d6 });
      g.circle(x + 2.5, y - 3, 1).fill({ color: 0xfff1d6 });
    }
  }
}

/** Overlapping, irregular washes of paint with a few sparkles (Mond-Aquarell). */
function drawWatercolor(
  g: Graphics,
  rand: Rand,
  w: number,
  h: number,
  colors: readonly number[],
  alpha: number,
  accents: readonly number[],
) {
  const count = Math.round((w * h) / PATCH_AREA_PX2) * 2 + 3;
  for (let i = 0; i < count; i++) {
    const cx = rand() * w;
    const cy = rand() * h;
    const r = 80 + rand() * 200;
    const color = pick(rand, colors);
    // Smooth wobbly layers (a few sine waves around the rim): a wash is darker where the
    // paint pooled at its edge, so the outer layer is the strongest.
    const f1 = 2 + Math.floor(rand() * 3);
    const f2 = 5 + Math.floor(rand() * 3);
    const p1 = rand() * Math.PI * 2;
    const p2 = rand() * Math.PI * 2;
    for (let layer = 0; layer < 4; layer++) {
      const pts: number[] = [];
      const steps = 40;
      const shrink = 1 - layer * 0.16;
      for (let k = 0; k < steps; k++) {
        const a = (k / steps) * Math.PI * 2;
        const wobble = 1 + 0.14 * Math.sin(a * f1 + p1) + 0.06 * Math.sin(a * f2 + p2 + layer);
        const rr = r * wobble * shrink;
        pts.push(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.8);
      }
      g.poly(pts).fill({ color, alpha: alpha * (layer === 0 ? 0.55 : 0.22) });
    }
  }
  const sparkles = Math.round((w * h) / (DETAIL_AREA_PX2 * 6));
  for (let i = 0; i < sparkles; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const s = 2 + rand() * 3;
    const color = pick(rand, accents);
    g.poly([x, y - s * 2, x + s * 0.5, y, x, y + s * 2, x - s * 0.5, y]).fill({
      color,
      alpha: 0.5,
    });
  }
}
