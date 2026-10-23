import { Container, Graphics, Sprite } from 'pixi.js';
import type { RoomState } from '../../sim/room';
import { PALETTE } from './palette';
import { crackPoints, scatterRandom } from './scatter';
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

  constructor(textures: BakedTextures) {
    const make = (t: typeof textures.ring, tint: number) => {
      const s = new Sprite(t);
      s.anchor.set(0.5);
      s.tint = tint;
      s.visible = false;
      return s;
    };
    this.portalGlow = make(textures.disc, PALETTE.portal);
    this.portalRingA = make(textures.ring, PALETTE.player);
    this.portalRingB = make(textures.ring, PALETTE.portal);
    this.root.addChild(this.obstacles, this.portalGlow, this.portalRingA, this.portalRingB);
  }

  /** Obstacles are redrawn only when a new room is loaded, never per frame. */
  private drawObstacles(room: RoomState): void {
    const g = this.obstacles;
    g.clear();
    for (let i = 0; i < room.rectCount; i++) {
      const x = room.rects[i * 4] as number;
      const y = room.rects[i * 4 + 1] as number;
      const w = room.rects[i * 4 + 2] as number;
      const h = room.rects[i * 4 + 3] as number;
      g.rect(x - 4, y - 4, w + 8, h + 8).stroke({
        color: PALETTE.arenaEdge,
        width: 6,
        alpha: 0.08,
      });
      g.rect(x, y, w, h)
        .fill({ color: 0x120e1f })
        .stroke({ color: PALETTE.arenaEdge, width: 2, alpha: 0.75 });
      this.drawProps(g, x, y, w, h);
    }
    for (let i = 0; i < room.circleCount; i++) {
      const x = room.circles[i * 3] as number;
      const y = room.circles[i * 3 + 1] as number;
      const r = room.circles[i * 3 + 2] as number;
      g.circle(x, y, r + 4).stroke({ color: PALETTE.arenaEdge, width: 6, alpha: 0.08 });
      g.circle(x, y, r)
        .fill({ color: 0x120e1f })
        .stroke({ color: PALETTE.arenaEdge, width: 2, alpha: 0.75 });
    }
  }

  /**
   * Props on a block (ROADMAP M4.4): a glowing seam across the top and cooled rubble along
   * the lower edge. Seeded by position, so a room always looks the same.
   */
  private drawProps(g: Graphics, x: number, y: number, w: number, h: number): void {
    const rand = scatterRandom(Math.round(x * 31 + y * 17 + w));
    const seam = crackPoints(
      rand,
      x + w * (0.2 + rand() * 0.2),
      y + h * (0.3 + rand() * 0.3),
      w * 0.5,
      10,
    );
    // Keep the seam on the block.
    for (let i = 0; i < seam.length; i += 2) {
      seam[i] = Math.min(x + w - 4, Math.max(x + 4, seam[i] as number));
      seam[i + 1] = Math.min(y + h - 4, Math.max(y + 4, seam[i + 1] as number));
    }
    g.poly(seam, false).stroke({ color: PALETTE.ashVein, width: 5, alpha: 0.08 });
    g.poly(seam, false).stroke({ color: PALETTE.ashVein, width: 1.5, alpha: 0.5, cap: 'round' });
    const rubble = 2 + Math.floor(rand() * 3);
    for (let i = 0; i < rubble; i++) {
      const rx = x + rand() * w;
      const ry = y + h + 3 + rand() * 6;
      const r = 3 + rand() * 4;
      g.poly([
        rx - r,
        ry,
        rx - r * 0.3,
        ry - r * 0.9,
        rx + r * 0.8,
        ry - r * 0.5,
        rx + r,
        ry + r * 0.4,
      ])
        .fill({ color: 0x1a1426 })
        .stroke({ color: PALETTE.arenaEdge, width: 1, alpha: 0.35 });
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
