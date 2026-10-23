import { Container, Graphics } from 'pixi.js';
import { PALETTE } from './palette';
import { crackPoints, scatterRandom } from './scatter';

const GRID_PX = 64;
const MAJOR_EVERY = 4;
/** Ashfields floor (ROADMAP M4.4): one crack per this much area, some carrying ember veins. */
const CRACK_AREA_PX2 = 70_000;
const EMBER_VEIN_SHARE = 0.4;

/** Static floor grid and glowing arena border; rebuilt only when the arena size changes. */
export class ArenaView {
  readonly root = new Container();
  private readonly floor = new Graphics();
  /** Cracks and ember veins under the grid. */
  private readonly ground = new Graphics();
  private width = 0;
  private height = 0;

  constructor() {
    this.root.addChild(this.ground, this.floor);
  }

  /** Dark cracks across the ash, some glowing with ember veins; drawn once per arena size. */
  private drawGround(width: number, height: number): void {
    const g = this.ground;
    g.clear();
    const rand = scatterRandom(width * 7919 + height);
    const count = Math.round((width * height) / CRACK_AREA_PX2);
    for (let i = 0; i < count; i++) {
      const pts = crackPoints(rand, rand() * width, rand() * height, 60 + rand() * 180, 14);
      const vein = rand() < EMBER_VEIN_SHARE;
      if (vein) g.poly(pts, false).stroke({ color: PALETTE.ashVein, width: 8, alpha: 0.07 });
      g.poly(pts, false).stroke({
        color: vein ? PALETTE.ashVein : PALETTE.ashCrack,
        width: vein ? 1.6 : 2.2,
        alpha: vein ? 0.5 : 0.8,
        cap: 'round',
        join: 'round',
      });
    }
  }

  sync(width: number, height: number): void {
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    this.drawGround(width, height);
    const g = this.floor;
    g.clear();
    for (let x = 0, i = 0; x <= width; x += GRID_PX, i++) {
      g.moveTo(x, 0).lineTo(x, height);
      g.stroke({
        color: i % MAJOR_EVERY === 0 ? PALETTE.floorGridMajor : PALETTE.floorGrid,
        width: 1,
      });
    }
    for (let y = 0, i = 0; y <= height; y += GRID_PX, i++) {
      g.moveTo(0, y).lineTo(width, y);
      g.stroke({
        color: i % MAJOR_EVERY === 0 ? PALETTE.floorGridMajor : PALETTE.floorGrid,
        width: 1,
      });
    }
    for (let i = 4; i >= 0; i--) {
      g.rect(-i * 3, -i * 3, width + i * 6, height + i * 6).stroke({
        color: PALETTE.arenaEdge,
        width: i === 0 ? 3 : 4,
        alpha: i === 0 ? 1 : 0.08,
      });
    }
  }
}
