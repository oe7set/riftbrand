import { Container, Sprite, type Texture } from 'pixi.js';

/** Per-particle behaviour flags. */
export const PFlag = {
  /** Rotate the sprite to its velocity (sparks, streaks). */
  AlignToVelocity: 1 << 0,
  /** Shrink to zero instead of fading out. */
  Shrink: 1 << 1,
} as const;

export interface EmitOptions {
  texture: Texture;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  lifeSec: number;
  color: number;
  alpha?: number;
  scaleStart: number;
  scaleEnd?: number;
  /** Fraction of velocity kept per second (0.02 = strong drag). */
  dragPerSec?: number;
  rotation?: number;
  spin?: number;
  /** Stretch along x (sparks look faster when longer). */
  stretch?: number;
  flags?: number;
}

/**
 * Pooled, struct-of-arrays particle system for the view (TECH_DESIGN §8). Particles are
 * cosmetic: they never affect the sim and keep animating during hitstop.
 */
export class ParticleSystem {
  readonly root = new Container();
  private readonly sprites: Sprite[] = [];
  private readonly x: Float32Array;
  private readonly y: Float32Array;
  private readonly vx: Float32Array;
  private readonly vy: Float32Array;
  private readonly life: Float32Array;
  private readonly maxLife: Float32Array;
  private readonly alpha: Float32Array;
  private readonly scale0: Float32Array;
  private readonly scale1: Float32Array;
  private readonly drag: Float32Array;
  private readonly spin: Float32Array;
  private readonly stretch: Float32Array;
  private readonly flags: Uint8Array;
  private count = 0;
  /** Lower on weak devices (quality tiers); emits beyond the budget are dropped. */
  budget: number;

  constructor(readonly capacity: number) {
    this.budget = capacity;
    this.x = new Float32Array(capacity);
    this.y = new Float32Array(capacity);
    this.vx = new Float32Array(capacity);
    this.vy = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.alpha = new Float32Array(capacity);
    this.scale0 = new Float32Array(capacity);
    this.scale1 = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);
    this.spin = new Float32Array(capacity);
    this.stretch = new Float32Array(capacity);
    this.flags = new Uint8Array(capacity);
  }

  get active(): number {
    return this.count;
  }

  emit(o: EmitOptions): void {
    if (this.count >= Math.min(this.budget, this.capacity)) return;
    const i = this.count++;
    let sprite = this.sprites[i];
    if (!sprite) {
      sprite = new Sprite(o.texture);
      sprite.anchor.set(0.5);
      this.sprites[i] = sprite;
      this.root.addChild(sprite);
    }
    sprite.texture = o.texture;
    sprite.tint = o.color;
    sprite.visible = true;
    sprite.rotation = o.rotation ?? 0;
    this.x[i] = o.x;
    this.y[i] = o.y;
    this.vx[i] = o.vx ?? 0;
    this.vy[i] = o.vy ?? 0;
    this.life[i] = o.lifeSec;
    this.maxLife[i] = o.lifeSec;
    this.alpha[i] = o.alpha ?? 1;
    this.scale0[i] = o.scaleStart;
    this.scale1[i] = o.scaleEnd ?? o.scaleStart;
    this.drag[i] = o.dragPerSec ?? 1;
    this.spin[i] = o.spin ?? 0;
    this.stretch[i] = o.stretch ?? 1;
    this.flags[i] = o.flags ?? 0;
    this.apply(i, sprite);
  }

  private apply(i: number, sprite: Sprite): void {
    const t = 1 - (this.life[i] as number) / (this.maxLife[i] as number);
    const shrink = ((this.flags[i] as number) & PFlag.Shrink) !== 0;
    const s =
      (this.scale0[i] as number) + ((this.scale1[i] as number) - (this.scale0[i] as number)) * t;
    const k = shrink ? 1 - t : 1;
    sprite.position.set(this.x[i] as number, this.y[i] as number);
    sprite.scale.set(s * k * (this.stretch[i] as number), s * k);
    sprite.alpha = (this.alpha[i] as number) * (shrink ? 1 : 1 - t * t);
  }

  update(dtSec: number): void {
    let i = 0;
    while (i < this.count) {
      const life = (this.life[i] as number) - dtSec;
      if (life <= 0) {
        this.removeAt(i);
        continue;
      }
      this.life[i] = life;
      const drag = (this.drag[i] as number) ** dtSec;
      this.vx[i] = (this.vx[i] as number) * drag;
      this.vy[i] = (this.vy[i] as number) * drag;
      this.x[i] = (this.x[i] as number) + (this.vx[i] as number) * dtSec;
      this.y[i] = (this.y[i] as number) + (this.vy[i] as number) * dtSec;
      const sprite = this.sprites[i] as Sprite;
      if (((this.flags[i] as number) & PFlag.AlignToVelocity) !== 0) {
        sprite.rotation = Math.atan2(this.vy[i] as number, this.vx[i] as number);
      } else {
        sprite.rotation += (this.spin[i] as number) * dtSec;
      }
      this.apply(i, sprite);
      i++;
    }
  }

  /** Swap-remove: moves the last live particle into slot i (sprites swap with it). */
  private removeAt(i: number): void {
    const last = --this.count;
    const dead = this.sprites[i] as Sprite;
    dead.visible = false;
    if (i === last) return;
    const moved = this.sprites[last] as Sprite;
    this.sprites[i] = moved;
    this.sprites[last] = dead;
    this.x[i] = this.x[last] as number;
    this.y[i] = this.y[last] as number;
    this.vx[i] = this.vx[last] as number;
    this.vy[i] = this.vy[last] as number;
    this.life[i] = this.life[last] as number;
    this.maxLife[i] = this.maxLife[last] as number;
    this.alpha[i] = this.alpha[last] as number;
    this.scale0[i] = this.scale0[last] as number;
    this.scale1[i] = this.scale1[last] as number;
    this.drag[i] = this.drag[last] as number;
    this.spin[i] = this.spin[last] as number;
    this.stretch[i] = this.stretch[last] as number;
    this.flags[i] = this.flags[last] as number;
  }

  clear(): void {
    for (let i = 0; i < this.count; i++) (this.sprites[i] as Sprite).visible = false;
    this.count = 0;
  }
}
