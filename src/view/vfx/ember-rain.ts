import { Container, Sprite, type Texture } from 'pixi.js';
import type { ArtStyleDef } from '../../content/art/styles';

/**
 * Ashfields ember rain (ROADMAP M4.4): a few embers drifting down in three parallax layers,
 * far ones small and slow, near ones large and soft. Screen-space sprites created once and
 * only moved; cosmetic only.
 */
interface RainLayer {
  count: number;
  /** Fall speed in screen px per second. */
  speed: number;
  scale: number;
  alpha: number;
  /** How strongly the layer follows camera movement (1 = like the floor). */
  parallax: number;
}

const LAYERS: readonly RainLayer[] = [
  { count: 26, speed: 16, scale: 0.14, alpha: 0.45, parallax: 0.55 },
  { count: 16, speed: 30, scale: 0.24, alpha: 0.6, parallax: 1 },
  { count: 6, speed: 52, scale: 0.7, alpha: 0.18, parallax: 1.6 },
];
const MARGIN_PX = 30;

/** How each art style's ambient particles move (ROADMAP M4.5). */
interface Motion {
  /** Multiplies the layer's fall speed; negative rises. */
  fall: number;
  windPxPerSec: number;
  swayPx: number;
  /** Blinking like a firefly instead of a soft flicker. */
  blink: boolean;
  /** Tumbling leaves turn while they fall. */
  spin: boolean;
  additive: boolean;
}

const MOTION: Record<ArtStyleDef['particles']['kind'], Motion> = {
  embers: { fall: 1, windPxPerSec: 9, swayPx: 6, blink: false, spin: false, additive: true },
  fireflies: { fall: 0.15, windPxPerSec: 3, swayPx: 22, blink: true, spin: false, additive: true },
  leaves: { fall: 0.9, windPxPerSec: 20, swayPx: 18, blink: false, spin: true, additive: false },
  motes: { fall: -0.4, windPxPerSec: 4, swayPx: 10, blink: false, spin: false, additive: true },
};

export class EmberRain {
  readonly root = new Container();
  private readonly sprites: Sprite[] = [];
  private readonly x: Float32Array;
  private readonly y: Float32Array;
  private readonly layer: Uint8Array;
  private readonly phase: Float32Array;
  private lastCamX = Number.NaN;
  private lastCamY = Number.NaN;
  private time = 0;
  /** Share of embers shown (the low quality tier halves it). */
  density = 1;
  private readonly motion: Motion;

  constructor(texture: Texture, particles: ArtStyleDef['particles']) {
    this.motion = MOTION[particles.kind];
    const total = LAYERS.reduce((n, l) => n + l.count, 0);
    this.x = new Float32Array(total);
    this.y = new Float32Array(total);
    this.layer = new Uint8Array(total);
    this.phase = new Float32Array(total);
    let i = 0;
    LAYERS.forEach((l, li) => {
      for (let k = 0; k < l.count; k++, i++) {
        const s = new Sprite(texture);
        s.anchor.set(0.5);
        s.tint = particles.colors[k % particles.colors.length] ?? 0xffffff;
        // Leaves are the long spark shape: flatter, so they read as leaves, not sparks.
        if (this.motion.spin) s.scale.set(l.scale * 0.8, l.scale * 0.5);
        else s.scale.set(l.scale);
        this.sprites.push(s);
        this.root.addChild(s);
        this.layer[i] = li;
        // Spread evenly without a seed: golden-ratio sequence (cosmetic).
        this.x[i] = ((i * 0.618034) % 1) * 2000;
        this.y[i] = ((i * 0.381966 + li * 0.3) % 1) * 2000;
        this.phase[i] = i * 1.7;
      }
    });
    this.root.blendMode = this.motion.additive ? 'add' : 'normal';
  }

  update(
    dtSec: number,
    camX: number,
    camY: number,
    zoom: number,
    viewWidth: number,
    viewHeight: number,
  ): void {
    this.time += dtSec;
    const dx = Number.isNaN(this.lastCamX) ? 0 : (camX - this.lastCamX) * zoom;
    const dy = Number.isNaN(this.lastCamY) ? 0 : (camY - this.lastCamY) * zoom;
    this.lastCamX = camX;
    this.lastCamY = camY;
    const w = viewWidth + MARGIN_PX * 2;
    const h = viewHeight + MARGIN_PX * 2;
    for (let i = 0; i < this.sprites.length; i++) {
      const sprite = this.sprites[i] as Sprite;
      const l = LAYERS[this.layer[i] as number] as RainLayer;
      // Thin out from the back when the density drops.
      sprite.visible = (i % 2 === 0 || this.density >= 1) && this.density > 0;
      if (!sprite.visible) continue;
      const m = this.motion;
      let x = (this.x[i] as number) + (m.windPxPerSec * dtSec - dx) * l.parallax;
      let y = (this.y[i] as number) + l.speed * m.fall * dtSec - dy * l.parallax;
      x = ((x % w) + w) % w;
      y = ((y % h) + h) % h;
      this.x[i] = x;
      this.y[i] = y;
      const phase = this.phase[i] as number;
      const swing = Math.sin(this.time * 1.3 + phase);
      sprite.position.set(x - MARGIN_PX + swing * m.swayPx, y - MARGIN_PX);
      if (m.spin) sprite.rotation = swing * 1.2 + phase;
      if (m.blink) {
        // Fireflies glow up and fade out, each on its own beat.
        const pulse = Math.max(0, Math.sin(this.time * 1.6 + phase));
        sprite.alpha = Math.min(1, l.alpha * 1.6) * (0.1 + 0.9 * pulse * pulse);
      } else {
        sprite.alpha = l.alpha * (0.6 + 0.4 * Math.sin(this.time * 3 + phase));
      }
    }
  }
}
