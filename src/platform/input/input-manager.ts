import { TUNING } from '../../content/tuning';
import type { ButtonBit, InputFrame } from '../../shared/input-frame';
import { type Vec2, vec2 } from '../../shared/math/vec2';
import { type AppAction, DEFAULT_KEY_BINDINGS, type GamepadFamily } from './bindings';
import { GamepadInput } from './gamepad';
import { type DeviceSink, KeyboardMouseInput } from './keyboard-mouse';
import { TouchInput } from './touch';

export type InputDevice = 'keyboardMouse' | 'gamepad' | 'touch';

/** Minimum cursor distance from the player before mouse aim counts, in CSS pixels. */
const MOUSE_AIM_MIN_DIST_PX = 4;

/**
 * Merges all devices into one InputFrame per sim tick. Presses are latched until the next tick
 * samples them, so a tap between ticks (120 Hz rendering, 60 Hz sim) is never lost.
 */
export class InputManager implements DeviceSink {
  readonly keyboardMouse: KeyboardMouseInput;
  readonly gamepad: GamepadInput;
  readonly touch: TouchInput;
  lastDevice: InputDevice;
  private latchedPressed = 0;
  private readonly appActions = new Set<AppAction>();
  private readonly moveScratch = vec2();
  private readonly playerScreen = vec2();
  private playerScreenProvider: ((out: Vec2) => void) | null = null;
  private readonly deviceListeners = new Set<(device: InputDevice) => void>();

  constructor(canvas: HTMLElement, hasTouchScreen: boolean) {
    this.keyboardMouse = new KeyboardMouseInput(canvas, DEFAULT_KEY_BINDINGS, this);
    this.gamepad = new GamepadInput(this);
    this.touch = new TouchInput(canvas, this);
    this.lastDevice = hasTouchScreen ? 'touch' : 'keyboardMouse';
  }

  // DeviceSink
  pressed(bit: ButtonBit): void {
    this.latchedPressed |= bit;
  }

  appAction(action: AppAction): void {
    this.appActions.add(action);
  }

  used(device: InputDevice): void {
    if (device === this.lastDevice) return;
    this.lastDevice = device;
    for (const listener of this.deviceListeners) listener(device);
  }

  onDeviceChange(listener: (device: InputDevice) => void): () => void {
    this.deviceListeners.add(listener);
    return () => this.deviceListeners.delete(listener);
  }

  get gamepadFamily(): GamepadFamily {
    return this.gamepad.family;
  }

  /** Needed to turn the mouse cursor into an aim direction. */
  setPlayerScreenProvider(provider: (out: Vec2) => void): void {
    this.playerScreenProvider = provider;
  }

  resize(width: number, height: number): void {
    this.touch.resize(width, height);
  }

  /** Once per rendered frame. */
  poll(): void {
    this.gamepad.poll();
  }

  consumeAppAction(action: AppAction): boolean {
    return this.appActions.delete(action);
  }

  /** Menus own the keyboard while gameplay input is off. */
  setGameplayEnabled(enabled: boolean): void {
    if (this.keyboardMouse.gameplayEnabled === enabled) return;
    this.keyboardMouse.gameplayEnabled = enabled;
    this.releaseAll();
  }

  consumeMenuActions(): number {
    return this.gamepad.consumeMenu();
  }

  /** Drops held state, e.g. when the game pauses, so nothing stays "stuck". */
  releaseAll(): void {
    this.keyboardMouse.releaseAll();
    this.touch.releaseAll();
    this.latchedPressed = 0;
  }

  /** Once per sim tick. */
  sampleFrame(out: InputFrame): InputFrame {
    out.pressed = this.latchedPressed;
    this.latchedPressed = 0;
    out.held = this.keyboardMouse.heldMask | this.gamepad.heldMask | this.touch.heldMask;

    // Strongest stick wins so a resting device never cancels an active one.
    out.moveX = 0;
    out.moveY = 0;
    this.considerMove(out, this.keyboardMouse.readMove(this.moveScratch));
    this.considerMove(out, this.gamepad.readMove(this.moveScratch));
    this.considerMove(out, this.touch.readMove(this.moveScratch));

    out.hasAim = false;
    // Untargeted taps and move-direction attacks get the generous cone (GDD §4.4).
    out.assistDeg = TUNING.aimAssistTouchDeg;
    if (this.touch.releaseAimPending && this.lastDevice === 'touch') {
      // An aimed cast was just released: it fires exactly where the thumb pointed.
      this.touch.releaseAimPending = false;
      this.setAim(out, this.touch.castAim.x, this.touch.castAim.y);
      out.assistDeg = TUNING.aimAssistStickDeg;
    } else if (this.touch.hasAim && this.lastDevice === 'touch') {
      this.setAim(out, this.touch.aim.x, this.touch.aim.y);
      out.assistDeg = TUNING.aimAssistStickDeg;
    } else if (this.gamepad.hasAim && this.lastDevice === 'gamepad') {
      this.setAim(out, this.gamepad.aim.x, this.gamepad.aim.y);
      out.assistDeg = TUNING.aimAssistStickDeg;
    } else if (this.lastDevice === 'keyboardMouse' && this.keyboardMouse.pointer.inside) {
      out.assistDeg = TUNING.aimAssistMouseDeg;
      const provider = this.playerScreenProvider;
      if (provider) {
        provider(this.playerScreen);
        const dx = this.keyboardMouse.pointer.x - this.playerScreen.x;
        const dy = this.keyboardMouse.pointer.y - this.playerScreen.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > MOUSE_AIM_MIN_DIST_PX) this.setAim(out, dx / dist, dy / dist);
      }
    }
    return out;
  }

  private considerMove(out: InputFrame, v: Vec2): void {
    if (v.x * v.x + v.y * v.y > out.moveX * out.moveX + out.moveY * out.moveY) {
      out.moveX = v.x;
      out.moveY = v.y;
    }
  }

  private setAim(out: InputFrame, x: number, y: number): void {
    out.hasAim = true;
    out.aimX = x;
    out.aimY = y;
  }

  destroy(): void {
    this.keyboardMouse.destroy();
    this.touch.destroy();
  }
}
