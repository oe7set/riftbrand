import { Container, Graphics, Sprite } from 'pixi.js';
import type { ArtStyleDef } from '../../content/art/style';
import type { RoomState } from '../../sim/room';
import { PALETTE } from './palette';
import { scatterRandom } from './scatter';

/** Moss on top of the stone blocks. */
const MOSS = 0x7fa05e;

import type { BakedTextures } from './textures';

/** Static obstacles plus the exit portal that opens when a room is cleared. */
export class RoomView {
  readonly root = new Container();
  private readonly obstacles = new Graphics();
  private readonly portalGlow: Sprite;
  private readonly portalRingA: Sprite;
  private readonly portalRingB: Sprite;
  private shownRoom: RoomState | null = null;
  private openSec = 0;
  private time = 0;

  constructor(
    textures: BakedTextures,
    private readonly style: ArtStyleDef,
  ) {
    const make = (t: typeof textures.ring, tint: number) => {
      const s = new Sprite(t);
      s.anchor.set(0.5);
      s.tint = tint;
      s.visible = false;
      return s;
    };
    this.portalGlow = make(textures.disc, PALETTE.portal);
    this.portalRingA = make(textures.ring, 0xd8c4ff);
    this.portalRingB = make(textures.ring, PALETTE.portal);
    this.root.addChild(this.obstacles, this.portalGlow, this.portalRingA, this.portalRingB);
  }

  /** Obstacles are redrawn only when a new room is loaded, never per frame. */
  private drawObstacles(room: RoomState): void {
    const g = this.obstacles;
    g.clear();
    const o = this.style.obstacle;
    // Only the template's obstacles; puzzle gates and blocks draw themselves (PuzzleView).
    for (let i = 0; i < room.staticRectCount; i++) {
      const x = room.rects[i * 4] as number;
      const y = room.rects[i * 4 + 1] as number;
      const w = room.rects[i * 4 + 2] as number;
      const h = room.rects[i * 4 + 3] as number;
      // Picture-book stone blocks: soft shadow, ink outline, a lighter top face.
      g.roundRect(x + 4, y + 8, w, h, 14).fill({ color: 0x000000, alpha: 0.18 });
      g.roundRect(x, y, w, h, 14)
        .fill({ color: o.fill })
        .stroke({ color: o.stroke, width: o.strokeWidthPx });
      g.roundRect(x + 6, y + 6, w - 12, Math.min(14, h * 0.25), 7).fill({
        color: 0xffffff,
        alpha: 0.12,
      });
      this.drawProps(g, x, y, w, h);
    }
    for (let i = 0; i < room.staticCircleCount; i++) {
      const x = room.circles[i * 3] as number;
      const y = room.circles[i * 3 + 1] as number;
      const r = room.circles[i * 3 + 2] as number;
      g.ellipse(x + 3, y + 7, r, r * 0.9).fill({ color: 0x000000, alpha: 0.18 });
      g.circle(x, y, r).fill({ color: o.fill }).stroke({ color: o.stroke, width: o.strokeWidthPx });
      g.ellipse(x - r * 0.25, y - r * 0.35, r * 0.4, r * 0.22).fill({
        color: 0xffffff,
        alpha: 0.12,
      });
    }
  }

  /**
   * Props on a block (ROADMAP M4.4, picture book since M4.5): moss along the top edge and an
   * ink crack or two. Seeded by position, so a room always looks the same.
   */
  private drawProps(g: Graphics, x: number, y: number, w: number, h: number): void {
    const rand = scatterRandom(Math.round(x * 31 + y * 17 + w));
    const ink = this.style.obstacle.stroke;
    const tufts = 2 + Math.floor((w / 60) * rand());
    for (let i = 0; i < tufts; i++) {
      const mx = x + 12 + rand() * (w - 24);
      const mr = 7 + rand() * 6;
      g.ellipse(mx, y + 2, mr, mr * 0.6)
        .fill({ color: MOSS })
        .stroke({ color: ink, width: 2.5 });
    }
    const cracks = 1 + Math.floor(rand() * 2);
    for (let i = 0; i < cracks; i++) {
      const cx = x + w * (0.25 + rand() * 0.5);
      const cy = y + h * (0.35 + rand() * 0.3);
      const len = Math.min(w, h) * 0.25;
      g.moveTo(cx, cy)
        .lineTo(cx + len * 0.4, cy + len * 0.3)
        .lineTo(cx + len * 0.2, cy + len * 0.7)
        .stroke({ color: ink, width: 2.5, cap: 'round', join: 'round', alpha: 0.7 });
    }
  }

  sync(room: RoomState, dtSec: number): void {
    this.time += dtSec;
    if (room !== this.shownRoom) {
      this.shownRoom = room;
      this.openSec = 0;
      this.drawObstacles(room);
    }
    const open = room.exitOpen;
    this.portalGlow.visible = this.portalRingA.visible = this.portalRingB.visible = open;
    if (!open) return;
    this.openSec += dtSec;
    // Grow in over half a second, then breathe.
    const grow = Math.min(1, this.openSec / 0.5);
    const pulse = 1 + Math.sin(this.time * 4) * 0.06;
    this.portalGlow.position.set(room.exitX, room.exitY);
    this.portalGlow.scale.set(2.6 * grow * pulse);
    this.portalGlow.alpha = 0.22;
    this.portalRingA.position.set(room.exitX, room.exitY);
    this.portalRingA.scale.set(2.8 * grow);
    this.portalRingA.rotation = this.time * 1.5;
    this.portalRingB.position.set(room.exitX, room.exitY);
    this.portalRingB.scale.set(2 * grow * pulse);
    this.portalRingB.rotation = -this.time * 2.2;
  }
}
