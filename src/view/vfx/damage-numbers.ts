import { BitmapFont, BitmapText, Container } from 'pixi.js';
import { PALETTE } from '../render/palette';

const FONT = 'rb-damage';
const POOL_SIZE = 48;
const LIFE_SEC = 0.7;

let fontInstalled = false;

function installFont(): void {
  if (fontInstalled) return;
  BitmapFont.install({
    name: FONT,
    style: {
      fontFamily: 'system-ui, sans-serif',
      fontSize: 32,
      fontWeight: '800',
      fill: 0xffffff,
      stroke: { color: 0x07060d, width: 5 },
    },
    chars: '0123456789!+',
    resolution: 2,
  });
  fontInstalled = true;
}

/** Floating damage numbers (GDD §4.7), pooled BitmapTexts. */
export class DamageNumbers {
  readonly root = new Container();
  enabled = true;
  private readonly texts: BitmapText[] = [];
  private readonly life = new Float32Array(POOL_SIZE);
  private readonly vy = new Float32Array(POOL_SIZE);
  private readonly baseScale = new Float32Array(POOL_SIZE);
  private next = 0;

  constructor() {
    installFont();
    for (let i = 0; i < POOL_SIZE; i++) {
      const text = new BitmapText({ text: '', style: { fontFamily: FONT, fontSize: 32 } });
      text.anchor.set(0.5);
      text.visible = false;
      this.texts.push(text);
      this.root.addChild(text);
    }
  }

  spawn(x: number, y: number, amount: number, crit: boolean): void {
    this.spawnText(
      x,
      y,
      crit ? `${Math.round(amount)}!` : String(Math.round(amount)),
      crit ? PALETTE.crit : PALETTE.damageText,
      crit ? 0.75 : 0.5,
    );
  }

  spawnText(x: number, y: number, label: string, color: number, scale: number): void {
    if (!this.enabled) return;
    const i = this.next;
    this.next = (this.next + 1) % POOL_SIZE;
    const text = this.texts[i] as BitmapText;
    text.text = label;
    text.tint = color;
    // Slight horizontal scatter so multi-hits don't overlap exactly.
    text.position.set(x + ((i % 5) - 2) * 6, y - 18);
    text.visible = true;
    this.life[i] = LIFE_SEC;
    this.vy[i] = -70;
    this.baseScale[i] = scale;
  }

  update(dtSec: number): void {
    for (let i = 0; i < POOL_SIZE; i++) {
      const life = this.life[i] as number;
      if (life <= 0) continue;
      const text = this.texts[i] as BitmapText;
      const remaining = life - dtSec;
      this.life[i] = remaining;
      if (remaining <= 0) {
        text.visible = false;
        continue;
      }
      const t = 1 - remaining / LIFE_SEC;
      text.y += (this.vy[i] as number) * dtSec;
      this.vy[i] = (this.vy[i] as number) * 0.9;
      // Pop in, then shrink and fade.
      const pop = t < 0.15 ? 1 + (0.15 - t) * 4 : 1;
      text.scale.set((this.baseScale[i] as number) * pop);
      text.alpha = t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1;
    }
  }

  clear(): void {
    this.life.fill(0);
    for (const t of this.texts) t.visible = false;
  }
}
