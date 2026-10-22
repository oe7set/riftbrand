import { PALETTE } from '../render/palette';
import type { BakedTextures } from '../render/textures';
import { type ParticleSystem, PFlag } from './particles';

/** Cosmetic randomness only; never feeds back into the sim. */
const rand = (min: number, max: number) => min + Math.random() * (max - min);

/** Named particle recipes for the feedback director (GDD §4.7). */
export class Effects {
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

  shotPop(x: number, y: number): void {
    for (let i = 0; i < 5; i++) {
      const a = rand(0, Math.PI * 2);
      this.fx.emit({
        texture: this.tex.dot,
        x,
        y,
        vx: Math.cos(a) * 90,
        vy: Math.sin(a) * 90,
        lifeSec: 0.2,
        color: PALETTE.enemyShot,
        scaleStart: 0.3,
        flags: PFlag.Shrink,
      });
    }
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
