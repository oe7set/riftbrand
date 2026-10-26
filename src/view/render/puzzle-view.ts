import { Container, Graphics, Rectangle, type Renderer, Sprite, type Texture } from 'pixi.js';
import { PUZZLE_TUNING } from '../../content/puzzles/tuning';
import { PieceCode } from '../../sim/events';
import type { PuzzleState } from '../../sim/puzzle';
import { TICK_RATE_HZ } from '../../sim/time';
import { PALETTE } from './palette';
import { scatterRandom } from './scatter';
import type { BakedTextures } from './textures';

const INK = PALETTE.ink;
const STONE = 0x9b7b5c;
const STONE_DARK = 0x6e5440;
/** Worn sandstone for floor pieces, lighter than walls and pillars so they read as "step here". */
const SLAB = 0xd9c39a;
const ABYSS = 0x1c1226;
const BRASS = 0xc9923f;
const CRYSTAL_OFF = 0xb8c4e0;
const CRYSTAL_ON = 0xd28bff;
const RUNE_ON = 0xffc65c;
const PLATE_ON = 0xffd36b;
const BAKE_RESOLUTION = 3;

function bake(renderer: Renderer, g: Graphics, halfPx: number): Texture {
  const frame = new Rectangle(-halfPx, -halfPx, halfPx * 2, halfPx * 2);
  const texture = renderer.generateTexture({ target: g, frame, resolution: BAKE_RESOLUTION });
  g.destroy();
  return texture;
}

interface PuzzleTextures {
  flame: Texture;
  crystal: Texture;
  block: Texture;
}

function bakePuzzleTextures(renderer: Renderer): PuzzleTextures {
  const flame = new Graphics()
    .moveTo(0, -30)
    .bezierCurveTo(14, -14, 16, 0, 0, 10)
    .bezierCurveTo(-16, 0, -14, -14, 0, -30)
    .fill({ color: 0xff8a3d })
    .stroke({ color: INK, width: 3.5, join: 'round' })
    .moveTo(0, -16)
    .bezierCurveTo(7, -8, 8, 0, 0, 5)
    .bezierCurveTo(-8, 0, -7, -8, 0, -16)
    .fill({ color: 0xffe08a });
  const crystal = new Graphics()
    .poly([0, -26, 15, -4, 0, 22, -15, -4])
    .fill({ color: 0xffffff })
    .stroke({ color: INK, width: 3.5, join: 'round' })
    .poly([0, -26, 5, -4, 0, 22])
    .fill({ color: 0x000000, alpha: 0.12 })
    .moveTo(-7, -8)
    .lineTo(-2, -16)
    .stroke({ color: 0xffffff, width: 3, cap: 'round' });
  const s = PUZZLE_TUNING.blockSizePx / 2;
  const block = new Graphics()
    .roundRect(-s + 3, -s + 6, s * 2, s * 2, 10)
    .fill({ color: 0x000000, alpha: 0.2 })
    .roundRect(-s, -s, s * 2, s * 2, 10)
    .fill({ color: STONE })
    .stroke({ color: INK, width: 4 })
    .roundRect(-s + 6, -s + 5, s * 2 - 12, 10, 5)
    .fill({ color: 0xffffff, alpha: 0.16 })
    // A carved rune so blocks read as "meant to be moved", not as walls.
    .circle(0, 4, s * 0.38)
    .stroke({ color: INK, width: 3, alpha: 0.55 })
    .moveTo(0, 4 - s * 0.38)
    .lineTo(0, 4 + s * 0.38)
    .stroke({ color: INK, width: 3, alpha: 0.55 });
  return {
    flame: bake(renderer, flame, 34),
    crystal: bake(renderer, crystal, 30),
    block: bake(renderer, block, s + 8),
  };
}

/** Order pips: the visible hint for sequences (no puzzle needs trial and error). */
function pips(g: Graphics, x: number, y: number, count: number, color: number): void {
  const gap = 11;
  const left = x - ((count - 1) * gap) / 2;
  for (let i = 0; i < count; i++) {
    g.circle(left + i * gap, y, 4)
      .fill({ color })
      .stroke({ color: INK, width: 2 });
  }
}

/**
 * Puzzle pieces in the picture-book style (ROADMAP M6.0). The static parts (drops, plates,
 * runes, bowls, gate posts) are drawn once per room; everything that changes is a sprite or a
 * prebuilt shape whose position, scale, tint or visibility is updated per frame.
 */
export class PuzzleView {
  readonly root = new Container();
  private readonly ground = new Graphics();
  private readonly pieces = new Container();
  private readonly tex: PuzzleTextures;
  private shown: PuzzleState | null = null;
  /** Per piece index; null where the piece has no such part. */
  private sprites: Array<Sprite | null> = [];
  private glows: Array<Sprite | null> = [];
  private gates: Array<Graphics | null> = [];
  private gateOpen: number[] = [];
  private time = 0;

  constructor(
    renderer: Renderer,
    private readonly textures: BakedTextures,
  ) {
    this.tex = bakePuzzleTextures(renderer);
    this.root.addChild(this.ground, this.pieces);
  }

  private glow(tint: number, scale: number): Sprite {
    const s = new Sprite(this.textures.softGlow);
    s.anchor.set(0.5);
    s.tint = tint;
    s.scale.set(scale);
    s.alpha = 0;
    s.blendMode = 'add';
    this.pieces.addChild(s);
    return s;
  }

  /** Builds the room's pieces; runs once per room, never per frame. */
  private build(p: PuzzleState): void {
    this.ground.clear();
    for (const child of this.pieces.removeChildren()) child.destroy();
    this.sprites = new Array(p.count).fill(null);
    this.glows = new Array(p.count).fill(null);
    this.gates = new Array(p.count).fill(null);
    this.gateOpen = new Array(p.count).fill(0);
    const g = this.ground;
    const r = PUZZLE_TUNING.pieceRadiusPx;
    const pad = PUZZLE_TUNING.padHalfPx;
    // Drops first, so everything else sits on top of the ground. Ink outlines go under all
    // fills, so touching drops merge into one seamless pit.
    const drops = p.def.elements.filter((e) => e.kind === 'chasm');
    for (const e of drops) g.roundRect(e.x, e.y, e.w, e.h, 8).stroke({ color: INK, width: 12 });
    for (const e of drops) g.roundRect(e.x, e.y, e.w, e.h, 8).fill({ color: ABYSS });
    for (const e of drops) {
      // The far cliff face catches a little light, only where no other drop continues above.
      const covered = drops.some(
        (o) => o !== e && Math.abs(o.y + o.h - e.y) < 1 && o.x < e.x + e.w && o.x + o.w > e.x,
      );
      if (!covered) {
        g.rect(e.x + 2, e.y + 2, e.w - 4, Math.min(22, e.h * 0.3)).fill({
          color: 0x5a3f73,
          alpha: 0.7,
        });
      }
      const rand = scatterRandom(Math.round(e.x * 13 + e.y * 7));
      const motes = Math.round((e.w * e.h) / 9000);
      for (let i = 0; i < motes; i++) {
        g.circle(
          e.x + 14 + rand() * (e.w - 28),
          e.y + 30 + rand() * (e.h - 44),
          1.5 + rand() * 2,
        ).fill({ color: 0xd8c4ff, alpha: 0.25 + rand() * 0.35 });
      }
    }
    p.def.elements.forEach((e, i) => {
      const order = p.order[i] as number;
      switch (e.kind) {
        case 'plate':
          g.roundRect(e.x - pad, e.y - pad, pad * 2, pad * 2, 10)
            .fill({ color: SLAB })
            .stroke({ color: INK, width: 4 });
          g.roundRect(e.x - pad + 8, e.y - pad + 8, pad * 2 - 16, pad * 2 - 16, 6).stroke({
            color: BRASS,
            width: 3,
          });
          this.glows[i] = this.glow(PLATE_ON, 0.9);
          break;
        case 'rune':
          g.circle(e.x, e.y, pad).fill({ color: SLAB }).stroke({ color: INK, width: 4 });
          g.moveTo(e.x - pad * 0.45, e.y + pad * 0.3)
            .lineTo(e.x, e.y - pad * 0.5)
            .lineTo(e.x + pad * 0.45, e.y + pad * 0.3)
            .stroke({ color: BRASS, width: 3.5, cap: 'round', join: 'round' });
          if (order > 0) pips(g, e.x, e.y + pad * 0.62, order, 0xfff8ec);
          this.glows[i] = this.glow(RUNE_ON, 1.1);
          break;
        case 'brazier': {
          g.ellipse(e.x + 3, e.y + 10, r, r * 0.6).fill({ color: 0x000000, alpha: 0.2 });
          g.moveTo(e.x - r, e.y - 6)
            .lineTo(e.x + r, e.y - 6)
            .lineTo(e.x + r * 0.6, e.y + r * 0.7)
            .lineTo(e.x - r * 0.6, e.y + r * 0.7)
            .closePath()
            .fill({ color: BRASS })
            .stroke({ color: INK, width: 4, join: 'round' });
          g.ellipse(e.x, e.y - 6, r, 6)
            .fill({ color: 0x4a2f22 })
            .stroke({ color: INK, width: 3 });
          if (order > 0) pips(g, e.x, e.y + r + 10, order, 0xfff1d6);
          const flame = new Sprite(this.tex.flame);
          flame.anchor.set(0.5, 0.75);
          flame.position.set(e.x, e.y - 6);
          flame.visible = false;
          this.glows[i] = this.glow(0xff9a4a, 1.6);
          this.pieces.addChild(flame);
          this.sprites[i] = flame;
          break;
        }
        case 'crystal': {
          g.ellipse(e.x + 2, e.y + 26, 14, 5).fill({ color: 0x000000, alpha: 0.25 });
          this.glows[i] = this.glow(CRYSTAL_ON, 1.4);
          const crystal = new Sprite(this.tex.crystal);
          crystal.anchor.set(0.5);
          crystal.position.set(e.x, e.y);
          crystal.tint = CRYSTAL_OFF;
          this.pieces.addChild(crystal);
          this.sprites[i] = crystal;
          break;
        }
        case 'reset':
          g.circle(e.x + 2, e.y + 6, r).fill({ color: 0x000000, alpha: 0.2 });
          g.circle(e.x, e.y, r).fill({ color: 0x7d8aa0 }).stroke({ color: INK, width: 4 });
          // Start the arc explicitly, else it joins up with the last point drawn.
          g.moveTo(e.x + Math.cos(-2.6) * r * 0.5, e.y + Math.sin(-2.6) * r * 0.5)
            .arc(e.x, e.y, r * 0.5, -2.6, 1.6)
            .stroke({ color: 0xfff1d6, width: 3.5, cap: 'round' });
          g.poly([e.x - 9, e.y - 12, e.x - 1, e.y - 7, e.x - 9, e.y - 2]).fill({ color: 0xfff1d6 });
          break;
        case 'gate': {
          // Posts stay; the bars slide down into the floor when the gate opens.
          const vertical = e.h > e.w;
          const post = 10;
          if (vertical) {
            g.roundRect(e.x - 4, e.y - post, e.w + 8, post * 2, 4)
              .fill({ color: STONE_DARK })
              .stroke({ color: INK, width: 3 });
            g.roundRect(e.x - 4, e.y + e.h - post, e.w + 8, post * 2, 4)
              .fill({ color: STONE_DARK })
              .stroke({ color: INK, width: 3 });
          } else {
            g.roundRect(e.x - post, e.y - 4, post * 2, e.h + 8, 4)
              .fill({ color: STONE_DARK })
              .stroke({ color: INK, width: 3 });
            g.roundRect(e.x + e.w - post, e.y - 4, post * 2, e.h + 8, 4)
              .fill({ color: STONE_DARK })
              .stroke({ color: INK, width: 3 });
          }
          const bars = new Graphics();
          const span = vertical ? e.h : e.w;
          const count = Math.max(2, Math.round(span / 22));
          for (let k = 0; k < count; k++) {
            const t = (k + 0.5) / count;
            if (vertical) {
              bars.roundRect(0, t * e.h - 4, e.w, 8, 4);
            } else {
              bars.roundRect(t * e.w - 4, 0, 8, e.h, 4);
            }
          }
          bars.fill({ color: 0x5b4a63 }).stroke({ color: INK, width: 3 });
          if (vertical) bars.rect(e.w / 2 - 3, 0, 6, e.h).fill({ color: 0x5b4a63 });
          else bars.rect(0, e.h / 2 - 3, e.w, 6).fill({ color: 0x5b4a63 });
          bars.position.set(e.x, e.y);
          this.pieces.addChild(bars);
          this.gates[i] = bars;
          break;
        }
        case 'block': {
          const block = new Sprite(this.tex.block);
          block.anchor.set(0.5);
          this.pieces.addChild(block);
          this.sprites[i] = block;
          break;
        }
        case 'chasm':
          break;
      }
    });
  }

  sync(puzzle: PuzzleState | null, dtSec: number): void {
    this.time += dtSec;
    this.root.visible = puzzle !== null;
    if (!puzzle) {
      this.shown = null;
      return;
    }
    if (puzzle !== this.shown) {
      this.shown = puzzle;
      this.build(puzzle);
    }
    const p = puzzle;
    for (let i = 0; i < p.count; i++) {
      const kind = p.kind[i] as number;
      const on = p.active[i] === 1;
      const sprite = this.sprites[i];
      const glow = this.glows[i];
      const x = p.x[i] as number;
      const y = p.y[i] as number;
      if (kind === PieceCode.Brazier && sprite && glow) {
        sprite.visible = on;
        const flicker = 1 + Math.sin(this.time * 13 + i * 2.1) * 0.08;
        sprite.scale.set(flicker, 1 / flicker);
        glow.position.set(x, y - 14);
        glow.alpha = on ? 0.55 + Math.sin(this.time * 7 + i) * 0.08 : 0;
      } else if (kind === PieceCode.Crystal && sprite && glow) {
        const bob = Math.sin(this.time * 2.4 + i) * 4;
        sprite.position.set(x, y + bob);
        sprite.tint = on ? CRYSTAL_ON : CRYSTAL_OFF;
        // A timed crystal blinks faster as its last second runs out.
        const left = (p.holdTicks[i] as number) / TICK_RATE_HZ;
        const blink = left > 0 && left < 1.5 ? 0.5 + 0.5 * Math.sin(this.time * 24) : 1;
        glow.position.set(x, y + bob);
        glow.alpha = on ? 0.6 * blink : 0;
      } else if ((kind === PieceCode.Plate || kind === PieceCode.Rune) && glow) {
        glow.position.set(x, y);
        glow.alpha = on ? 0.5 : 0;
      } else if (kind === PieceCode.Block && sprite) {
        sprite.position.set(x, y);
      } else if (kind === PieceCode.Gate) {
        const bars = this.gates[i];
        const e = p.def.elements[i];
        if (!bars || e?.kind !== 'gate') continue;
        const target = this.isGateOpen(p, i) ? 1 : 0;
        const k = this.gateOpen[i] as number;
        const next = k + Math.sign(target - k) * Math.min(Math.abs(target - k), dtSec * 5);
        this.gateOpen[i] = next;
        // Bars sink into the floor: squash towards the far edge.
        if (e.h > e.w) bars.scale.set(1 - next * 0.85, 1);
        else bars.scale.set(1, 1 - next * 0.85);
        bars.alpha = 1 - next * 0.5;
      }
    }
  }

  private isGateOpen(p: PuzzleState, i: number): boolean {
    const g = p.opens[i] as number;
    return p.groupActive[g] === 1 || (p.solved && g === p.goalGroup);
  }
}
