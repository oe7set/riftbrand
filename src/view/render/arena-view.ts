import { Container, Graphics } from 'pixi.js';
import { PALETTE } from './palette';

const GRID_PX = 64;
const MAJOR_EVERY = 4;

/** Static floor grid and glowing arena border; rebuilt only when the arena size changes. */
export class ArenaView {
  readonly root = new Container();
  private readonly floor = new Graphics();
  private width = 0;
  private height = 0;

  constructor() {
    this.root.addChild(this.floor);
  }

  sync(width: number, height: number): void {
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
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
