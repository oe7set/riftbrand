import { Container, Graphics } from 'pixi.js';
import { TUNING } from '../../content/tuning';
import type { TouchInput } from '../../platform/input/touch';
import type { TouchButtonLayout, TouchLayout } from '../../platform/input/touch-layout';
import { PALETTE } from '../render/palette';

const IDLE_ALPHA = 0.35;
const PRESSED_ALPHA = 0.85;

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

  constructor() {
    this.root.addChild(this.buttons, this.joystickBase, this.joystickKnob);
  }

  private rebuild(layout: TouchLayout): void {
    this.layout = layout;
    for (const child of this.buttons.removeChildren()) child.destroy();
    for (const b of layout.buttons) {
      const g = new Graphics();
      g.circle(0, 0, b.radius).fill({ color: PALETTE.touchBase, alpha: 0.08 });
      g.circle(0, 0, b.radius).stroke({ color: PALETTE.touchBase, width: 2, alpha: 0.6 });
      drawIcon(g, b);
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

  sync(touch: TouchInput, visible: boolean): void {
    this.root.visible = visible;
    if (!visible) return;
    if (touch.layout !== this.layout) this.rebuild(touch.layout);
    if (TUNING.touchJoystickRadiusPx !== this.joystickRadius) {
      this.rebuildJoystick(TUNING.touchJoystickRadiusPx);
    }
    const children = this.buttons.children;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child) child.alpha = (touch.pressedButtons & (1 << i)) !== 0 ? PRESSED_ALPHA : IDLE_ALPHA;
    }
    const j = touch.joystick;
    this.joystickBase.visible = j.active;
    this.joystickKnob.visible = j.active;
    if (j.active) {
      this.joystickBase.position.set(j.originX, j.originY);
      this.joystickKnob.position.set(j.knobX, j.knobY);
    }
  }
}
