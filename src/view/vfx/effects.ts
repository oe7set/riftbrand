import type { Texture } from 'pixi.js';
import { RIG_TUNING } from '../../content/rigs';
import { PALETTE } from '../render/palette';
import type { BakedTextures } from '../render/textures';
import { type ParticleSystem, PFlag } from './particles';

/** Cosmetic randomness only; never feeds back into the sim. */
const rand = (min: number, max: number) => min + Math.random() * (max - min);

/** Named particle recipes for the feedback director (GDD §4.7). */
export class Effects {
  /** The aura's reach ring is opt-in (settings): a steady pulse around Vesper reads as noise. */
  auraRingEnabled = false;

  constructor(
    private readonly fx: ParticleSystem,
    private readonly ground: ParticleSystem,
    private readonly tex: BakedTextures,
  ) {}

  /** Sparks spraying in the hit direction. */
  hitSparks(x: number, y: number, dirX: number, dirY: number, color: number, count: number): void {
    const base = Math.atan2(dirY, dirX);
    for (let i = 0; i < count; i++) {
      const a = base + rand(-0.6, 0.6);
      const speed = rand(220, 520);
      this.fx.emit({
        texture: this.tex.spark,
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        lifeSec: rand(0.12, 0.28),
        color: i % 3 === 0 ? 0xffffff : color,
        scaleStart: rand(0.55, 0.9),
        scaleEnd: 0.15,
        dragPerSec: 0.02,
        stretch: 2.4,
        flags: PFlag.AlignToVelocity,
      });
    }
    this.fx.emit({
      texture: this.tex.dot,
      x,
      y,
      lifeSec: 0.1,
      color: 0xffffff,
      scaleStart: 1.6,
      scaleEnd: 2.4,
    });
  }

  /** Enemy shatters into fragments of its color. */
  killBurst(x: number, y: number, dirX: number, dirY: number, color: number, radius: number): void {
    const base = Math.atan2(dirY, dirX);
    const count = Math.round(10 + radius * 0.5);
    for (let i = 0; i < count; i++) {
      const a = i < count / 2 ? base + rand(-0.9, 0.9) : rand(0, Math.PI * 2);
      const speed = rand(120, 420);
      this.fx.emit({
        texture: i % 2 === 0 ? this.tex.spark : this.tex.dot,
        x: x + rand(-radius, radius) * 0.4,
        y: y + rand(-radius, radius) * 0.4,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        lifeSec: rand(0.3, 0.6),
        color: i % 4 === 0 ? 0xffffff : color,
        scaleStart: rand(0.3, 0.7),
        dragPerSec: 0.05,
        stretch: i % 2 === 0 ? 1.8 : 1,
        spin: rand(-12, 12),
        flags: PFlag.Shrink,
      });
    }
    this.fx.emit({
      texture: this.tex.ring,
      x,
      y,
      lifeSec: 0.3,
      color,
      scaleStart: radius / 16,
      scaleEnd: (radius / 16) * 3.5,
    });
    this.fx.emit({
      texture: this.tex.dot,
      x,
      y,
      lifeSec: 0.18,
      color: 0xffffff,
      scaleStart: radius / 8,
      scaleEnd: radius / 5,
    });
  }

  /** Bright crescent of streaks along the swing arc; player attacks are cool and elongated. */
  slash(
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    reach: number,
    arcDeg: number,
    heavy: boolean,
  ): void {
    const base = Math.atan2(dirY, dirX);
    const half = (arcDeg * Math.PI) / 180 / 2;
    const steps = heavy ? 9 : 7;
    for (let i = 0; i < steps; i++) {
      const a = base - half + (2 * half * i) / (steps - 1);
      const d = reach * 0.75;
      this.fx.emit({
        texture: this.tex.spark,
        x: x + Math.cos(a) * d,
        y: y + Math.sin(a) * d,
        vx: Math.cos(a + Math.PI / 2) * 60,
        vy: Math.sin(a + Math.PI / 2) * 60,
        rotation: a + Math.PI / 2,
        lifeSec: 0.12,
        color: heavy ? PALETTE.ember : PALETTE.playerSlash,
        alpha: 0.9,
        scaleStart: heavy ? 1.1 : 0.8,
        scaleEnd: 0.2,
        stretch: 2.5,
      });
    }
  }

  whirl(x: number, y: number, radius: number): void {
    this.fx.emit({
      texture: this.tex.ring,
      x,
      y,
      lifeSec: 0.25,
      color: PALETTE.ember,
      scaleStart: radius / 32,
      scaleEnd: radius / 15,
    });
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      this.fx.emit({
        texture: this.tex.spark,
        x: x + Math.cos(a) * radius * 0.6,
        y: y + Math.sin(a) * radius * 0.6,
        vx: Math.cos(a + Math.PI / 2) * 380,
        vy: Math.sin(a + Math.PI / 2) * 380,
        lifeSec: 0.22,
        color: i % 2 === 0 ? PALETTE.ember : 0xffffff,
        scaleStart: 0.6,
        scaleEnd: 0.1,
        dragPerSec: 0.1,
        stretch: 2,
        flags: PFlag.AlignToVelocity,
      });
    }
  }

  dashPuff(x: number, y: number, dirX: number, dirY: number): void {
    for (let i = 0; i < 8; i++) {
      const a = Math.atan2(-dirY, -dirX) + rand(-0.7, 0.7);
      const speed = rand(60, 180);
      this.ground.emit({
        texture: this.tex.dot,
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        lifeSec: rand(0.25, 0.4),
        color: PALETTE.player,
        alpha: 0.5,
        scaleStart: rand(0.4, 0.8),
        scaleEnd: 1.4,
        dragPerSec: 0.05,
      });
    }
  }

  /** Fading copy of the player body, laid down during a dash. */
  afterimage(x: number, y: number, rotation: number, scale: number): void {
    this.ground.emit({
      texture: this.tex.player.flash,
      x,
      y,
      rotation,
      lifeSec: 0.18,
      color: PALETTE.player,
      alpha: 0.45,
      scaleStart: scale,
    });
  }

  perfectDash(x: number, y: number): void {
    this.fx.emit({
      texture: this.tex.ring,
      x,
      y,
      lifeSec: 0.45,
      color: PALETTE.perfectDash,
      scaleStart: 1,
      scaleEnd: 9,
    });
    this.fx.emit({
      texture: this.tex.ring,
      x,
      y,
      lifeSec: 0.35,
      color: 0xffffff,
      scaleStart: 0.5,
      scaleEnd: 5,
    });
  }

  portal(x: number, y: number, lifeSec: number, color: number): void {
    this.ground.emit({
      texture: this.tex.ring,
      x,
      y,
      lifeSec,
      color,
      alpha: 0.9,
      scaleStart: 3,
      scaleEnd: 0.8,
      spin: 4,
    });
    this.ground.emit({
      texture: this.tex.disc,
      x,
      y,
      lifeSec,
      color,
      alpha: 0.25,
      scaleStart: 0.5,
      scaleEnd: 2,
    });
    for (let i = 0; i < 6; i++) {
      const a = rand(0, Math.PI * 2);
      const d = rand(30, 60);
      this.ground.emit({
        texture: this.tex.dot,
        x: x + Math.cos(a) * d,
        y: y + Math.sin(a) * d,
        vx: -Math.cos(a) * d * 1.5,
        vy: -Math.sin(a) * d * 1.5,
        lifeSec: lifeSec * 0.7,
        color,
        scaleStart: 0.5,
        flags: PFlag.Shrink,
      });
    }
  }

  spawnFlash(x: number, y: number, color: number): void {
    this.fx.emit({
      texture: this.tex.dot,
      x,
      y,
      lifeSec: 0.2,
      color: 0xffffff,
      scaleStart: 2.5,
      scaleEnd: 0.5,
    });
    this.fx.emit({
      texture: this.tex.ring,
      x,
      y,
      lifeSec: 0.3,
      color,
      scaleStart: 0.5,
      scaleEnd: 3,
    });
  }

  slamShockwave(x: number, y: number, radius: number): void {
    this.ground.emit({
      texture: this.tex.ring,
      x,
      y,
      lifeSec: 0.35,
      color: PALETTE.telegraph,
      scaleStart: radius / 24,
      scaleEnd: radius / 14,
    });
    this.ground.emit({
      texture: this.tex.disc,
      x,
      y,
      lifeSec: 0.25,
      color: PALETTE.telegraphFill,
      alpha: 0.4,
      scaleStart: radius / 16,
      scaleEnd: radius / 15,
    });
    for (let i = 0; i < 16; i++) {
      const a = rand(0, Math.PI * 2);
      const speed = rand(150, 380);
      this.fx.emit({
        texture: this.tex.dot,
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        lifeSec: rand(0.25, 0.45),
        color: PALETTE.telegraphFill,
        scaleStart: rand(0.3, 0.6),
        dragPerSec: 0.03,
        flags: PFlag.Shrink,
      });
    }
  }

  muzzle(x: number, y: number, color: number): void {
    this.fx.emit({
      texture: this.tex.dot,
      x,
      y,
      lifeSec: 0.12,
      color,
      scaleStart: 1.4,
      scaleEnd: 0.4,
    });
  }

  shotPop(x: number, y: number, color: number = PALETTE.enemyShot): void {
    for (let i = 0; i < 5; i++) {
      const a = rand(0, Math.PI * 2);
      this.fx.emit({
        texture: this.tex.dot,
        x,
        y,
        vx: Math.cos(a) * 90,
        vy: Math.sin(a) * 90,
        lifeSec: 0.2,
        color,
        scaleStart: 0.3,
        flags: PFlag.Shrink,
      });
    }
  }

  /** One trail particle behind a player projectile (called at a fixed rate per projectile). */
  projectileTrail(
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    color: number,
    big: boolean,
  ): void {
    this.fx.emit({
      texture: big ? this.tex.spark : this.tex.dot,
      x: x - dirX * (big ? 14 : 8) + rand(-3, 3),
      y: y - dirY * (big ? 14 : 8) + rand(-3, 3),
      vx: -dirX * rand(20, 60) + rand(-30, 30),
      vy: -dirY * rand(20, 60) + rand(-30, 30),
      rotation: Math.atan2(dirY, dirX),
      lifeSec: big ? rand(0.25, 0.4) : 0.15,
      color: big && rand(0, 1) < 0.3 ? 0xffe0a0 : color,
      scaleStart: big ? rand(0.4, 0.6) : 0.35,
      flags: PFlag.Shrink,
    });
  }

  /** Ultimate windup: energy streaming into the player. */
  ultimateCharge(x: number, y: number, color: number): void {
    for (let i = 0; i < 24; i++) {
      const a = rand(0, Math.PI * 2);
      const d = rand(80, 160);
      this.fx.emit({
        texture: this.tex.spark,
        x: x + Math.cos(a) * d,
        y: y + Math.sin(a) * d,
        vx: -Math.cos(a) * d * 2.6,
        vy: -Math.sin(a) * d * 2.6,
        lifeSec: 0.32,
        color: i % 3 === 0 ? 0xffffff : color,
        scaleStart: 0.5,
        scaleEnd: 0.1,
        stretch: 2,
        flags: PFlag.AlignToVelocity,
      });
    }
    this.fx.emit({
      texture: this.tex.ring,
      x,
      y,
      lifeSec: 0.35,
      color,
      scaleStart: 8,
      scaleEnd: 1,
    });
  }

  /** Ultimate blast: screen-filling disc, layered rings and a spray of sparks. */
  ultimate(x: number, y: number, radius: number, color: number): void {
    this.ground.emit({
      texture: this.tex.disc,
      x,
      y,
      lifeSec: 0.5,
      color,
      alpha: 0.35,
      scaleStart: radius / 40,
      scaleEnd: radius / 16,
    });
    for (let i = 0; i < 3; i++) {
      this.fx.emit({
        texture: this.tex.ring,
        x,
        y,
        lifeSec: 0.35 + i * 0.12,
        color: i === 0 ? 0xffffff : color,
        scaleStart: radius / 60,
        scaleEnd: radius / (15 - i * 2),
      });
    }
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2 + rand(-0.05, 0.05);
      const speed = rand(500, 1100);
      this.fx.emit({
        texture: this.tex.spark,
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        lifeSec: rand(0.25, 0.45),
        color: i % 4 === 0 ? 0xffffff : color,
        scaleStart: rand(0.6, 1),
        scaleEnd: 0.1,
        dragPerSec: 0.03,
        stretch: 3,
        flags: PFlag.AlignToVelocity,
      });
    }
    this.fx.emit({
      texture: this.tex.dot,
      x,
      y,
      lifeSec: 0.2,
      color: 0xffffff,
      scaleStart: 6,
      scaleEnd: 12,
    });
  }

  playerHit(x: number, y: number, dirX: number, dirY: number): void {
    this.hitSparks(x, y, dirX, dirY, PALETTE.hpFill, 14);
    this.fx.emit({
      texture: this.tex.ring,
      x,
      y,
      lifeSec: 0.25,
      color: PALETTE.hpFill,
      scaleStart: 1,
      scaleEnd: 4,
    });
  }

  playerDeath(x: number, y: number): void {
    this.killBurst(x, y, 0, -1, PALETTE.player, 30);
    this.killBurst(x, y, 0, 1, PALETTE.ember, 20);
  }

  waveCleared(x: number, y: number): void {
    this.fx.emit({
      texture: this.tex.ring,
      x,
      y,
      lifeSec: 0.8,
      color: PALETTE.ember,
      alpha: 0.7,
      scaleStart: 2,
      scaleEnd: 40,
    });
  }

  /** Single ember drifting up from a burning enemy. */
  ember(x: number, y: number, radius: number): void {
    this.fx.emit({
      texture: this.tex.dot,
      x: x + rand(-radius, radius) * 0.7,
      y: y + rand(-radius, radius) * 0.5,
      vx: rand(-20, 20),
      vy: rand(-90, -40),
      lifeSec: rand(0.35, 0.6),
      color: rand(0, 1) < 0.5 ? PALETTE.ember : 0xffd36b,
      scaleStart: rand(0.15, 0.3),
      flags: PFlag.Shrink,
    });
  }

  /** A slow green bubble rising off a poisoned enemy. */
  poisonBubble(x: number, y: number, radius: number, color: number): void {
    this.fx.emit({
      texture: this.tex.ring,
      x: x + rand(-radius, radius) * 0.6,
      y: y + rand(-radius, radius) * 0.4,
      vx: rand(-10, 10),
      vy: rand(-45, -20),
      lifeSec: rand(0.5, 0.8),
      color,
      scaleStart: rand(0.2, 0.35),
      flags: PFlag.Shrink,
    });
  }

  statusPuff(x: number, y: number, color: number): void {
    for (let i = 0; i < 6; i++) {
      const a = rand(0, Math.PI * 2);
      this.fx.emit({
        texture: this.tex.dot,
        x,
        y,
        vx: Math.cos(a) * 80,
        vy: Math.sin(a) * 80,
        lifeSec: 0.25,
        color,
        scaleStart: 0.3,
        flags: PFlag.Shrink,
      });
    }
  }

  freezeBurst(x: number, y: number, radius: number): void {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const speed = rand(120, 260);
      this.fx.emit({
        texture: this.tex.spark,
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        lifeSec: rand(0.2, 0.35),
        color: i % 2 === 0 ? 0xffffff : PALETTE.frost,
        scaleStart: 0.5,
        scaleEnd: 0.1,
        dragPerSec: 0.02,
        stretch: 1.8,
        flags: PFlag.AlignToVelocity,
      });
    }
    this.fx.emit({
      texture: this.tex.ring,
      x,
      y,
      lifeSec: 0.3,
      color: PALETTE.frost,
      scaleStart: radius / 16,
      scaleEnd: (radius / 16) * 2.5,
    });
  }

  /** Effect area burst (boon novas): ring sized to the actual radius. */
  nova(x: number, y: number, radius: number, color: number): void {
    this.ground.emit({
      texture: this.tex.disc,
      x,
      y,
      lifeSec: 0.25,
      color,
      alpha: 0.25,
      scaleStart: radius / 32,
      scaleEnd: radius / 16,
    });
    this.fx.emit({
      texture: this.tex.ring,
      x,
      y,
      lifeSec: 0.3,
      color,
      scaleStart: radius / 40,
      scaleEnd: radius / 15,
    });
  }

  /**
   * A straight beam from (x, y) along (dirX, dirY): a coloured sheath with a white core that
   * flashes and fades (light lance).
   */
  beam(
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    length: number,
    width: number,
    color: number,
  ): void {
    const rotation = Math.atan2(dirY, dirX);
    const cx = x + dirX * length * 0.5;
    const cy = y + dirY * length * 0.5;
    // The spark texture is 32 px long and ~6 px thick at scale 1.
    const sheath = width / 6;
    const core = width / 14;
    this.fx.emit({
      texture: this.tex.spark,
      x: cx,
      y: cy,
      lifeSec: 0.35,
      color,
      alpha: 0.8,
      scaleStart: sheath,
      scaleEnd: sheath * 0.2,
      rotation,
      stretch: length / 32 / sheath,
    });
    this.fx.emit({
      texture: this.tex.spark,
      x: cx,
      y: cy,
      lifeSec: 0.2,
      color: 0xffffff,
      scaleStart: core,
      scaleEnd: core * 0.2,
      rotation,
      stretch: length / 32 / core,
    });
    for (let i = 0; i < 10; i++) {
      const t = rand(0, 1);
      this.fx.emit({
        texture: this.tex.dot,
        x: x + dirX * length * t,
        y: y + dirY * length * t,
        vx: rand(-60, 60),
        vy: rand(-60, 60),
        lifeSec: rand(0.2, 0.4),
        color,
        scaleStart: rand(0.15, 0.3),
        flags: PFlag.Shrink,
      });
    }
  }

  /** A slow drifting puff inside a lingering cloud. */
  cloudPuff(x: number, y: number, radius: number, color: number): void {
    for (let i = 0; i < 3; i++) {
      const a = rand(0, Math.PI * 2);
      const d = rand(0, radius * 0.8);
      this.ground.emit({
        texture: this.tex.dot,
        x: x + Math.cos(a) * d,
        y: y + Math.sin(a) * d,
        vx: rand(-15, 15),
        vy: rand(-25, -5),
        lifeSec: rand(0.6, 1),
        color,
        alpha: 0.35,
        scaleStart: rand(0.8, 1.4),
        scaleEnd: rand(1.6, 2.2),
      });
    }
  }

  /** A faint ring settling onto the aura's edge: shows its reach without stealing focus. */
  auraRing(x: number, y: number, radius: number, color: number, strong: boolean): void {
    if (!this.auraRingEnabled) return;
    this.ground.emit({
      texture: this.tex.ring,
      x,
      y,
      lifeSec: 0.4,
      color,
      alpha: strong ? 0.55 : 0.3,
      scaleStart: radius / 13,
      scaleEnd: radius / 15,
    });
  }

  /** Dash afterimage of a rigged body (ROADMAP M4.1): a fading silhouette left behind. */
  rigAfterimage(
    texture: Texture,
    x: number,
    y: number,
    scale: number,
    mirror: number,
    color: number,
  ): void {
    this.ground.emit({
      texture,
      x,
      y,
      lifeSec: RIG_TUNING.afterimageLifeSec,
      color,
      alpha: 0.45,
      scaleStart: scale,
      stretch: mirror,
    });
  }

  /**
   * One part of a rigged body breaking off on death: it tumbles away and burns out. `dirX`/`dirY`
   * is the flight direction (roughly unit length).
   */
  rigPart(
    texture: Texture,
    x: number,
    y: number,
    rotation: number,
    scale: number,
    mirror: number,
    color: number,
    dirX: number,
    dirY: number,
  ): void {
    const speed = RIG_TUNING.shatterSpeedPxPerSec * rand(0.6, 1.2);
    this.fx.emit({
      texture,
      x,
      y,
      vx: dirX * speed,
      vy: dirY * speed,
      lifeSec: RIG_TUNING.shatterLifeSec * rand(0.8, 1.2),
      color,
      rotation,
      spin: rand(-9, 9),
      scaleStart: scale,
      scaleEnd: scale * 0.6,
      dragPerSec: 0.08,
      stretch: mirror,
      flags: PFlag.Shrink,
    });
    // Embers trailing off the part.
    for (let i = 0; i < 2; i++) {
      this.fx.emit({
        texture: this.tex.dot,
        x,
        y,
        vx: dirX * speed * 0.5 + rand(-60, 60),
        vy: dirY * speed * 0.5 - rand(40, 120),
        lifeSec: rand(0.4, 0.8),
        color: PALETTE.ember,
        scaleStart: rand(0.15, 0.3),
        dragPerSec: 0.2,
        flags: PFlag.Shrink,
      });
    }
  }

  /** Gold glints rising from a kill: shards gained. */
  shards(x: number, y: number, amount: number): void {
    const count = Math.min(8, 2 + amount);
    for (let i = 0; i < count; i++) {
      this.fx.emit({
        texture: this.tex.spark,
        x: x + rand(-10, 10),
        y: y + rand(-10, 10),
        vx: rand(-40, 40),
        vy: rand(-160, -90),
        rotation: Math.PI / 2,
        lifeSec: rand(0.4, 0.6),
        color: PALETTE.shard,
        scaleStart: 0.35,
        dragPerSec: 0.1,
        flags: PFlag.Shrink,
      });
    }
  }

  heal(x: number, y: number): void {
    for (let i = 0; i < 8; i++) {
      this.fx.emit({
        texture: this.tex.dot,
        x: x + rand(-14, 14),
        y: y + rand(-6, 10),
        vy: rand(-80, -40),
        lifeSec: 0.5,
        color: PALETTE.heal,
        scaleStart: 0.3,
        flags: PFlag.Shrink,
      });
    }
  }
}
