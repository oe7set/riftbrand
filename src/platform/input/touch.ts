import { TUNING } from '../../content/tuning';
import { setVec2, type Vec2, vec2 } from '../../shared/math/vec2';
import type { DeviceSink } from './keyboard-mouse';
import { applyRadialDeadzone } from './stick';
import {
  computeTouchLayout,
  hitTestButton,
  type TouchButtonLayout,
  type TouchLayout,
} from './touch-layout';

interface ButtonPointer {
  button: TouchButtonLayout;
  startX: number;
  startY: number;
}

/** Floating joystick + button arc (GDD §10.1). Coordinates are CSS pixels relative to the canvas. */
export class TouchInput {
  layout: TouchLayout;
  /** Joystick visual state, read by the HUD. */
  readonly joystick = { active: false, originX: 0, originY: 0, knobX: 0, knobY: 0 };
  readonly move = vec2();
  readonly aim = vec2();
  hasAim = false;
  heldMask = 0;
  /** Bitmask of layout indices currently pressed, for button highlighting. */
  pressedButtons = 0;
  private joystickPointer = -1;
  private readonly buttonPointers = new Map<number, ButtonPointer>();
  private readonly activePointers = new Set<number>();
  private readonly cleanup: Array<() => void> = [];

  constructor(
    private readonly canvas: HTMLElement,
    private readonly sink: DeviceSink,
  ) {
    this.layout = computeTouchLayout(1, 1);
    this.listen(canvas, 'pointerdown', (e) => this.onDown(e as PointerEvent));
    this.listen(canvas, 'pointermove', (e) => this.onMove(e as PointerEvent));
    this.listen(canvas, 'pointerup', (e) => this.onUp(e as PointerEvent));
    this.listen(canvas, 'pointercancel', (e) => this.onUp(e as PointerEvent));
  }

  private listen(target: EventTarget, type: string, handler: (e: Event) => void): void {
    target.addEventListener(type, handler, { passive: false });
    this.cleanup.push(() => target.removeEventListener(type, handler));
  }

  resize(width: number, height: number): void {
    this.layout = computeTouchLayout(width, height);
  }

  private local(e: PointerEvent, out: Vec2): Vec2 {
    const rect = this.canvas.getBoundingClientRect();
    return setVec2(out, e.clientX - rect.left, e.clientY - rect.top);
  }

  private readonly p = vec2();

  private onDown(e: PointerEvent): void {
    if (e.pointerType === 'mouse') return;
    e.preventDefault();
    this.canvas.setPointerCapture?.(e.pointerId);
    this.sink.used('touch');
    this.activePointers.add(e.pointerId);
    if (this.activePointers.size === 3) this.sink.appAction('debug');

    const { x, y } = this.local(e, this.p);
    const button = hitTestButton(this.layout, x, y);
    if (button) {
      this.buttonPointers.set(e.pointerId, { button, startX: x, startY: y });
      if (button.id === 'pause') this.sink.appAction('pause');
      else this.sink.pressed(button.bit as Exclude<typeof button.bit, 0>);
      this.recomputeButtons();
      return;
    }
    const zone = this.layout.joystickZone;
    const inZone =
      x >= zone.x && x <= zone.x + zone.width && y >= zone.y && y <= zone.y + zone.height;
    // Outside the zone the left half still works, so a slightly-off thumb never misses.
    if (this.joystickPointer === -1 && (inZone || x < this.canvas.clientWidth / 2)) {
      this.joystickPointer = e.pointerId;
      const j = this.joystick;
      j.active = true;
      j.originX = j.knobX = x;
      j.originY = j.knobY = y;
      setVec2(this.move, 0, 0);
    }
  }

  private onMove(e: PointerEvent): void {
    if (e.pointerType === 'mouse') return;
    const { x, y } = this.local(e, this.p);
    if (e.pointerId === this.joystickPointer) {
      this.updateJoystick(x, y);
      return;
    }
    const bp = this.buttonPointers.get(e.pointerId);
    if (bp?.button.aimDrag) {
      const dx = x - bp.startX;
      const dy = y - bp.startY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist >= TUNING.touchAimDragThresholdPx) {
        this.hasAim = true;
        setVec2(this.aim, dx / dist, dy / dist);
      }
    }
  }

  private updateJoystick(x: number, y: number): void {
    const j = this.joystick;
    const radius = TUNING.touchJoystickRadiusPx;
    let dx = x - j.originX;
    let dy = y - j.originY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > radius) {
      // Drag the base along so reversing direction responds instantly.
      j.originX = x - (dx / dist) * radius;
      j.originY = y - (dy / dist) * radius;
      dx = x - j.originX;
      dy = y - j.originY;
    }
    j.knobX = x;
    j.knobY = y;
    applyRadialDeadzone(this.move, dx / radius, dy / radius, TUNING.touchJoystickDeadzone);
  }

  private onUp(e: PointerEvent): void {
    if (e.pointerType === 'mouse') return;
    this.activePointers.delete(e.pointerId);
    if (e.pointerId === this.joystickPointer) {
      this.joystickPointer = -1;
      this.joystick.active = false;
      setVec2(this.move, 0, 0);
      return;
    }
    const bp = this.buttonPointers.get(e.pointerId);
    if (bp) {
      this.buttonPointers.delete(e.pointerId);
      if (bp.button.aimDrag) this.hasAim = false;
      this.recomputeButtons();
    }
  }

  private recomputeButtons(): void {
    let held = 0;
    let pressed = 0;
    for (const { button } of this.buttonPointers.values()) {
      held |= button.bit;
      pressed |= 1 << this.layout.buttons.indexOf(button);
    }
    this.heldMask = held;
    this.pressedButtons = pressed;
  }

  releaseAll(): void {
    this.buttonPointers.clear();
    this.activePointers.clear();
    this.joystickPointer = -1;
    this.joystick.active = false;
    this.hasAim = false;
    setVec2(this.move, 0, 0);
    this.recomputeButtons();
  }

  readMove(out: Vec2): Vec2 {
    return setVec2(out, this.move.x, this.move.y);
  }

  destroy(): void {
    for (const fn of this.cleanup) fn();
  }
}
