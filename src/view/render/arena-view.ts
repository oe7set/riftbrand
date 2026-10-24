import { Container, Graphics } from 'pixi.js';
import type { ArtStyleDef } from '../../content/art/style';
import { scatterRandom } from './scatter';

/** Picture-book floor (ROADMAP M4.5): grass patches and ink doodles per this much area. */
const PATCH_AREA_PX2 = 90_000;
const DETAIL_AREA_PX2 = 9_000;

type Rand = () => number;

/** Static floor and arena border in the art style; rebuilt only when the arena size changes. */
export class ArenaView {
  readonly root = new Container();
  private readonly floor = new Graphics();
  /** Grass patches and doodles. */
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
    drawPatches(g, rand, width, height, gr.patches, gr.patchAlpha);
    drawDoodles(g, rand, width, height, gr.accents, this.style.rigs.outlineColor);
  }

  sync(width: number, height: number): void {
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    this.drawGround(width, height);
    const g = this.floor;
    g.clear();
    const edge = this.style.edge;
    // A soft rounded border with an ink line, like a page edge.
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

/** Large flat patches of lighter and darker grass. */
function drawPatches(
  g: Graphics,
  rand: Rand,
  w: number,
  h: number,
  colors: readonly number[],
  alpha: number,
) {
  const count = Math.round((w * h) / PATCH_AREA_PX2) + 2;
  for (let i = 0; i < count; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 90 + rand() * 170;
    const color = pick(rand, colors);
    g.ellipse(x, y, r, r * 0.75).fill({ color, alpha });
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
