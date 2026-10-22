import type { ButtonBit } from '../../shared/input-frame';
import type { Vec2 } from '../../shared/math/vec2';
import type { AppAction, KeyBindings, MoveDirection } from './bindings';
import { digitalToVector } from './stick';

export interface DeviceSink {
  pressed(bit: ButtonBit): void;
  appAction(action: AppAction): void;
  used(device: 'keyboardMouse' | 'gamepad' | 'touch'): void;
}

/** Keyboard plus mouse (pointerType "mouse" only; touch is handled separately). */
export class KeyboardMouseInput {
  private readonly heldCodes = new Set<string>();
  private readonly moveHeld: Record<MoveDirection, boolean> = {
    up: false,
    down: false,
    left: false,
    right: false,
  };
  private keyHeldMask = 0;
  private mouseHeldMask = 0;
  /** Pointer position in CSS pixels relative to the canvas. */
  readonly pointer = { x: 0, y: 0, inside: false };
  private readonly cleanup: Array<() => void> = [];
  /** Off while a menu is open: keys then belong to the DOM (focus, Enter, arrows). */
  gameplayEnabled = true;

  constructor(
    private readonly canvas: HTMLElement,
    private readonly bindings: KeyBindings,
    private readonly sink: DeviceSink,
  ) {
    this.listen(window, 'keydown', (e) => this.onKeyDown(e as KeyboardEvent));
    this.listen(window, 'keyup', (e) => this.onKeyUp(e as KeyboardEvent));
    this.listen(window, 'blur', () => this.releaseAll());
    this.listen(canvas, 'pointermove', (e) => this.onPointerMove(e as PointerEvent));
    this.listen(canvas, 'pointerdown', (e) => this.onPointerDown(e as PointerEvent));
    this.listen(window, 'pointerup', (e) => this.onPointerUp(e as PointerEvent));
    this.listen(canvas, 'pointerleave', (e) => {
      if ((e as PointerEvent).pointerType === 'mouse') this.pointer.inside = false;
    });
    // Right click is "special"; never open the browser menu over the game.
    this.listen(canvas, 'contextmenu', (e) => e.preventDefault());
  }

  private listen(target: EventTarget, type: string, handler: (e: Event) => void): void {
    target.addEventListener(type, handler, { passive: false });
    this.cleanup.push(() => target.removeEventListener(type, handler));
  }

  private onKeyDown(e: KeyboardEvent): void {
    const { move, buttons, app } = this.bindings;
    const dir = move[e.code];
    const bit = buttons[e.code];
    const action = app[e.code];
    if (dir === undefined && bit === undefined && action === undefined) return;
    if (!this.gameplayEnabled) {
      // Menus and the pause screen still get app actions (Esc resumes); the rest is the DOM's.
      // Tab stays with the browser for focus navigation in menus.
      if (action !== undefined && !e.repeat && e.code !== 'Tab') {
        e.preventDefault();
        this.sink.appAction(action);
      }
      return;
    }
    // Bound keys must not scroll the page, move focus (Tab) or trigger browser shortcuts.
    e.preventDefault();
    this.sink.used('keyboardMouse');
    if (e.repeat) return;
    this.heldCodes.add(e.code);
    if (action !== undefined) this.sink.appAction(action);
    if (bit !== undefined) this.sink.pressed(bit);
    this.recompute();
  }

  private onKeyUp(e: KeyboardEvent): void {
    if (!this.heldCodes.delete(e.code)) return;
    this.recompute();
  }

  private recompute(): void {
    const { move, buttons } = this.bindings;
    this.moveHeld.up = this.moveHeld.down = this.moveHeld.left = this.moveHeld.right = false;
    let mask = 0;
    for (const code of this.heldCodes) {
      const dir = move[code];
      if (dir !== undefined) this.moveHeld[dir] = true;
      const bit = buttons[code];
      if (bit !== undefined) mask |= bit;
    }
    this.keyHeldMask = mask;
  }

  private updatePointer(e: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = e.clientX - rect.left;
    this.pointer.y = e.clientY - rect.top;
    this.pointer.inside = true;
  }

  private onPointerMove(e: PointerEvent): void {
    if (e.pointerType !== 'mouse') return;
    this.updatePointer(e);
    this.sink.used('keyboardMouse');
  }

  private onPointerDown(e: PointerEvent): void {
    if (e.pointerType !== 'mouse') return;
    this.updatePointer(e);
    this.sink.used('keyboardMouse');
    const bit = this.bindings.mouseButtons[e.button];
    if (bit === undefined) return;
    e.preventDefault();
    this.mouseHeldMask |= bit;
    this.sink.pressed(bit);
  }

  private onPointerUp(e: PointerEvent): void {
    if (e.pointerType !== 'mouse') return;
    const bit = this.bindings.mouseButtons[e.button];
    if (bit !== undefined) this.mouseHeldMask &= ~bit;
  }

  releaseAll(): void {
    this.heldCodes.clear();
    this.mouseHeldMask = 0;
    this.recompute();
  }

  readMove(out: Vec2): Vec2 {
    const m = this.moveHeld;
    return digitalToVector(out, m.left, m.right, m.up, m.down);
  }

  get heldMask(): number {
    return this.keyHeldMask | this.mouseHeldMask;
  }

  destroy(): void {
    for (const fn of this.cleanup) fn();
  }
}
