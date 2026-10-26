import { Container, Sprite, type Texture } from 'pixi.js';
import type { ArtStyleDef } from '../../content/art/style';

/**
 * Ambient particles (ROADMAP M4.4, leaves since M4.5): a few drifting down in three parallax layers,
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

/** Falling leaves (picture-book look, ROADMAP M4.5): drift sideways and tumble. */
const WIND_PX_PER_SEC = 20;
const SWAY_PX = 18;

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
  private kind: ArtStyleDef['particles']['kind'];
  constructor(texture: Texture, particles: ArtStyleDef['particles']) {
    this.kind = particles.kind;
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
        this.sprites.push(s);
        this.root.addChild(s);
        this.layer[i] = li;
        // Spread evenly without a seed: golden-ratio sequence (cosmetic).
        this.x[i] = ((i * 0.618034) % 1) * 2000;
        this.y[i] = ((i * 0.381966 + li * 0.3) % 1) * 2000;
        this.phase[i] = i * 1.7;
      }
    });
    this.setParticles(texture, particles);
  }

  /** Switches what drifts (per world, ROADMAP M6.1): leaves tumble, snow floats. */
  setParticles(texture: Texture, particles: ArtStyleDef['particles']): void {
    this.kind = particles.kind;
    for (let i = 0; i < this.sprites.length; i++) {
      const s = this.sprites[i] as Sprite;
      const l = LAYERS[this.layer[i] as number] as RainLayer;
      s.texture = texture;
      s.tint = particles.colors[i % particles.colors.length] ?? 0xffffff;
      // Leaves are the long spark shape, flattened so they read as leaves, not sparks.
      if (particles.kind === 'leaves') s.scale.set(l.scale * 0.8, l.scale * 0.5);
      else s.scale.set(l.scale * 0.55);
      s.rotation = 0;
    }
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
      let x = (this.x[i] as number) + (WIND_PX_PER_SEC * dtSec - dx) * l.parallax;
      const snow = this.kind === 'snow';
      let y = (this.y[i] as number) + l.speed * (snow ? 0.7 : 1) * dtSec - dy * l.parallax;
      x = ((x % w) + w) % w;
      y = ((y % h) + h) % h;
      this.x[i] = x;
      this.y[i] = y;
      const phase = this.phase[i] as number;
      const swing = Math.sin(this.time * 1.3 + phase);
      sprite.position.set(x - MARGIN_PX + swing * SWAY_PX * (snow ? 0.6 : 1), y - MARGIN_PX);
      if (!snow) sprite.rotation = swing * 1.2 + phase;
      sprite.alpha = l.alpha * (0.6 + 0.4 * Math.sin(this.time * 3 + phase));
    }
  }
}
