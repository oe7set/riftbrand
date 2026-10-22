import { Container, Graphics, Sprite } from 'pixi.js';
import type { RoomState } from '../../sim/room';
import { PALETTE } from './palette';
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
