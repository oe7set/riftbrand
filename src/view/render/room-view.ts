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
  /** Doors of a room net (ROADMAP M6.0b): bars and padlocks per door, toggled per frame. */
  private readonly doorLayer = new Container();
  private doorBars: Graphics[] = [];
  private doorLocks: Graphics[] = [];
  private doorGlows: Sprite[] = [];
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
    this.root.addChild(
      this.obstacles,
      this.doorLayer,
      this.portalGlow,
      this.portalRingA,
      this.portalRingB,
    );
    this.glowTexture = textures.softGlow;
  }

  private readonly glowTexture: BakedTextures['softGlow'];

  /**
   * Archways at the room's edges, drawn once per room as a north door and rotated into place.
   * Bars stand in the opening while the room is not cleared; locked doors carry a padlock.
   */
  private drawDoors(room: RoomState): void {
    for (const child of this.doorLayer.removeChildren()) child.destroy();
    this.doorBars = [];
    this.doorLocks = [];
    this.doorGlows = [];
    const ink = this.style.obstacle.stroke;
    const stone = this.style.obstacle.fill;
    for (let i = 0; i < room.doorCount; i++) {
      const door = new Container();
      door.position.set(room.doorX[i] as number, room.doorY[i] as number);
      door.rotation = ((room.doorDir[i] as number) * Math.PI) / 2;
      const glow = new Sprite(this.glowTexture);
      glow.anchor.set(0.5);
      glow.tint = 0xffe0a3;
      glow.scale.set(1.3, 0.8);
      glow.position.set(0, -24);
      glow.blendMode = 'add';
      const frame = new Graphics()
        .rect(-46, -60, 92, 56)
        .fill({ color: 0x3a2a33 })
        .roundRect(-70, -64, 24, 70, 8)
        .fill({ color: stone })
        .stroke({ color: ink, width: 4 })
        .roundRect(46, -64, 24, 70, 8)
        .fill({ color: stone })
        .stroke({ color: ink, width: 4 })
        .roundRect(-74, -76, 148, 20, 8)
        .fill({ color: stone })
        .stroke({ color: ink, width: 4 });
      const bars = new Graphics();
      for (let k = 0; k < 5; k++) bars.roundRect(-38 + k * 17, -56, 7, 52, 3.5);
      bars.fill({ color: 0x5b4a63 }).stroke({ color: ink, width: 2.5 });
      bars.rect(-44, -36, 88, 6).fill({ color: 0x5b4a63 }).stroke({ color: ink, width: 2.5 });
      const lock = new Graphics()
        .roundRect(-9, -40, 18, 7, 3)
        .stroke({ color: ink, width: 7 })
        .roundRect(-9, -40, 18, 7, 3)
        .stroke({ color: 0xffd36b, width: 3 })
        .roundRect(-13, -34, 26, 20, 5)
        .fill({ color: 0xffd36b })
        .stroke({ color: ink, width: 3 })
        .circle(0, -25, 3)
        .fill({ color: ink });
      // Undo the door's rotation so the padlock always stands upright.
      lock.rotation = -door.rotation;
      lock.pivot.set(0, -24);
      lock.position.set(0, -24);
      door.addChild(frame, glow, bars, lock);
      this.doorLayer.addChild(door);
      this.doorBars.push(bars);
      this.doorLocks.push(lock);
      this.doorGlows.push(glow);
    }
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
      this.drawDoors(room);
    }
    if (room.doorCount > 0) {
      // Nets leave by doors; the portal stays hidden.
      this.portalGlow.visible = this.portalRingA.visible = this.portalRingB.visible = false;
      const open = room.exitOpen || room.doorsAlwaysOpen;
      for (let i = 0; i < room.doorCount; i++) {
        const locked = room.doorLocked[i] === 1;
        (this.doorBars[i] as Graphics).visible = !open || locked;
        (this.doorLocks[i] as Graphics).visible = locked;
        const glow = this.doorGlows[i] as Sprite;
        glow.visible = open && !locked;
        glow.alpha = 0.35 + Math.sin(this.time * 3 + i) * 0.08;
      }
      return;
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
