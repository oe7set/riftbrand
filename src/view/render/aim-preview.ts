import { Container, Sprite, type Texture } from 'pixi.js';
import { RIFT_SHOT } from '../../content/abilities';
import { PALETTE } from './palette';
import { BAKE_RADIUS_PX } from './textures';

const LINE_WIDTH_PX = 3;

/** Touch cast aiming (GDD §4.4): a line to the shot's range plus a ring where it ends. */
export class AimPreview {
  readonly root = new Container();
  private readonly line: Sprite;
  private readonly end: Sprite;
  private time = 0;

  constructor(white: Texture, ring: Texture) {
    this.line = new Sprite(white);
    this.line.anchor.set(0, 0.5);
    this.line.tint = PALETTE.riftShot;
    this.end = new Sprite(ring);
    this.end.anchor.set(0.5);
    this.end.tint = PALETTE.riftShot;
    this.root.addChild(this.line, this.end);
    this.root.visible = false;
  }

  sync(visible: boolean, x: number, y: number, dirX: number, dirY: number, dtSec: number): void {
    this.root.visible = visible;
    if (!visible) return;
    this.time += dtSec;
    const range = RIFT_SHOT.rangePx;
    this.line.position.set(x, y);
    this.line.rotation = Math.atan2(dirY, dirX);
    this.line.scale.set(range, LINE_WIDTH_PX);
    this.line.alpha = 0.35;
    this.end.position.set(x + dirX * range, y + dirY * range);
    this.end.scale.set((RIFT_SHOT.radiusPx * 2.2) / BAKE_RADIUS_PX);
    this.end.alpha = 0.6 + 0.3 * Math.sin(this.time * 12);
  }
}
