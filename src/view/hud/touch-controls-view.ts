import { Container, Graphics } from 'pixi.js';
import { RIFT_SHOT } from '../../content/abilities';
import { TUNING } from '../../content/tuning';
import type { TouchInput } from '../../platform/input/touch';
import type { TouchButtonLayout, TouchLayout } from '../../platform/input/touch-layout';
import type { PlayerState } from '../../sim/player-state';
import { PALETTE } from '../render/palette';

const IDLE_ALPHA = 0.35;
const PRESSED_ALPHA = 0.85;
/** Buttons whose resource is empty fade further so "not ready" reads at a glance. */
const EMPTY_ALPHA = 0.15;

function drawIcon(g: Graphics, b: TouchButtonLayout): void {
  const s = b.radius * 0.42;
  const style = { color: PALETTE.touchBase, width: Math.max(2, b.radius * 0.08), alpha: 0.9 };
  switch (b.id) {
    case 'attack':
      g.moveTo(-s, s).lineTo(s, -s).stroke(style);
      g.moveTo(-s * 0.4, -s * 0.1)
        .lineTo(s * 0.1, s * 0.4)
        .stroke(style);
      break;
    case 'dash':
      g.moveTo(-s, -s * 0.7)
        .lineTo(-s * 0.2, 0)
        .lineTo(-s, s * 0.7)
        .stroke(style);
      g.moveTo(0, -s * 0.7)
        .lineTo(s * 0.8, 0)
        .lineTo(0, s * 0.7)
        .stroke(style);
      break;
    case 'special':
      g.arc(0, 0, s * 0.85, 0.3, Math.PI * 1.7).stroke(style);
      g.circle(0, 0, s * 0.25).fill({ color: PALETTE.touchBase, alpha: 0.9 });
      break;
    case 'cast':
      g.poly([0, -s, s * 0.7, 0, 0, s, -s * 0.7, 0]).stroke(style);
      break;
    case 'ultimate':
      g.star(0, 0, 5, s, s * 0.45).stroke(style);
      break;
    case 'pause':
      g.rect(-s * 0.5, -s * 0.7, s * 0.3, s * 1.4).fill({ color: PALETTE.touchBase, alpha: 0.9 });
      g.rect(s * 0.2, -s * 0.7, s * 0.3, s * 1.4).fill({ color: PALETTE.touchBase, alpha: 0.9 });
      break;
  }
}

/** On-screen joystick and buttons. Shapes are built once per layout; frames only move/fade them. */
export class TouchControlsView {
  readonly root = new Container();
  private readonly buttons = new Container();
  private readonly joystickBase = new Graphics();
  private readonly joystickKnob = new Graphics();
  private layout: TouchLayout | null = null;
  private joystickRadius = 0;
  /** Cast charge dots and the ultimate fill disc; built with the layout, only toggled/scaled. */
  private castDots: Graphics[] = [];
  private ultFill: Graphics | null = null;
  private castIndex = -1;
  private ultIndex = -1;
  private time = 0;

  constructor() {
    this.root.addChild(this.buttons, this.joystickBase, this.joystickKnob);
  }

  private rebuild(layout: TouchLayout): void {
    this.layout = layout;
    for (const child of this.buttons.removeChildren()) child.destroy({ children: true });
    this.castDots = [];
    this.ultFill = null;
    this.castIndex = layout.buttons.findIndex((b) => b.id === 'cast');
    this.ultIndex = layout.buttons.findIndex((b) => b.id === 'ultimate');
    for (const b of layout.buttons) {
      const g = new Graphics();
      if (b.id === 'ultimate') {
        // Fill disc grows with the meter (scaled per frame, never redrawn).
        const fill = new Graphics();
        fill.circle(0, 0, b.radius).fill({ color: PALETTE.ultimate, alpha: 0.35 });
        g.addChild(fill);
        this.ultFill = fill;
      }
      g.circle(0, 0, b.radius).fill({ color: PALETTE.touchBase, alpha: 0.08 });
      g.circle(0, 0, b.radius).stroke({ color: PALETTE.touchBase, width: 2, alpha: 0.6 });
      drawIcon(g, b);
      if (b.id === 'cast') {
        for (let i = 0; i < RIFT_SHOT.charges; i++) {
          const dot = new Graphics();
          const spread = (i - (RIFT_SHOT.charges - 1) / 2) * b.radius * 0.38;
          dot.circle(spread, -b.radius * 1.22, b.radius * 0.13).fill({ color: PALETTE.riftShot });
          g.addChild(dot);
          this.castDots.push(dot);
        }
      }
      g.position.set(b.x, b.y);
      g.alpha = IDLE_ALPHA;
      this.buttons.addChild(g);
    }
  }

  private rebuildJoystick(radius: number): void {
    this.joystickRadius = radius;
    this.joystickBase.clear();
    this.joystickBase.circle(0, 0, radius).fill({ color: PALETTE.touchBase, alpha: 0.06 });
    this.joystickBase
      .circle(0, 0, radius)
      .stroke({ color: PALETTE.touchAccent, width: 2, alpha: 0.5 });
    this.joystickKnob.clear();
    this.joystickKnob
      .circle(0, 0, radius * 0.42)
      .fill({ color: PALETTE.touchAccent, alpha: 0.35 })
      .stroke({ color: PALETTE.touchAccent, width: 2, alpha: 0.9 });
  }

  sync(touch: TouchInput, visible: boolean, player: PlayerState, dtSec: number): void {
    this.root.visible = visible;
    if (!visible) return;
    this.time += dtSec;
    if (touch.layout !== this.layout) this.rebuild(touch.layout);
    if (TUNING.touchJoystickRadiusPx !== this.joystickRadius) {
      this.rebuildJoystick(TUNING.touchJoystickRadiusPx);
    }
    const children = this.buttons.children;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (!child) continue;
      const pressed = (touch.pressedButtons & (1 << i)) !== 0;
      let idle = IDLE_ALPHA;
      if (i === this.castIndex && player.castCharges < 1) idle = EMPTY_ALPHA;
      if (i === this.ultIndex) {
        // A full meter pulses to invite the press.
        idle = player.ultCharge >= 1 ? 0.6 + 0.3 * Math.sin(this.time * 6) : EMPTY_ALPHA + 0.15;
      }
      child.alpha = pressed ? PRESSED_ALPHA : idle;
    }
    for (let i = 0; i < this.castDots.length; i++) {
      const dot = this.castDots[i] as Graphics;
      dot.alpha = i < player.castCharges ? 1 : 0.15;
    }
    if (this.ultFill) this.ultFill.scale.set(Math.max(0.001, player.ultCharge));
    const j = touch.joystick;
    this.joystickBase.visible = j.active;
    this.joystickKnob.visible = j.active;
    if (j.active) {
      this.joystickBase.position.set(j.originX, j.originY);
      this.joystickKnob.position.set(j.knobX, j.knobY);
    }
  }
}
