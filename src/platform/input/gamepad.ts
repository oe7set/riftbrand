import { TUNING } from '../../content/tuning';
import { setVec2, type Vec2, vec2 } from '../../shared/math/vec2';
import {
  DEFAULT_GAMEPAD_BINDINGS,
  detectGamepadFamily,
  GAMEPAD_BUTTON,
  type GamepadFamily,
} from './bindings';
import type { DeviceSink } from './keyboard-mouse';
import { applyRadialDeadzone } from './stick';

const MAX_BUTTONS = 20;
const TRIGGER_THRESHOLD = 0.5;

/** Polled once per rendered frame via the Gamepad API. */
export class GamepadInput {
  readonly move = vec2();
  readonly aim = vec2();
  hasAim = false;
  heldMask = 0;
  connected = false;
  family: GamepadFamily = 'generic';
  private readonly prevDown = new Uint8Array(MAX_BUTTONS);
  private readonly scratch = vec2();

  constructor(private readonly sink: DeviceSink) {}

  poll(): void {
    const pad = this.pickGamepad();
    if (!pad) {
      if (this.connected) this.reset();
      return;
    }
    this.connected = true;
    this.family = detectGamepadFamily(pad.id);
    const dz = TUNING.gamepadDeadzone;
    let active = false;

    applyRadialDeadzone(this.move, pad.axes[0] ?? 0, pad.axes[1] ?? 0, dz);
    if (this.move.x !== 0 || this.move.y !== 0) active = true;

    applyRadialDeadzone(this.scratch, pad.axes[2] ?? 0, pad.axes[3] ?? 0, dz);
    const aimLen = Math.sqrt(this.scratch.x ** 2 + this.scratch.y ** 2);
    this.hasAim = aimLen > 0;
    if (this.hasAim) {
      setVec2(this.aim, this.scratch.x / aimLen, this.scratch.y / aimLen);
      active = true;
    }

    let held = 0;
    const count = Math.min(pad.buttons.length, MAX_BUTTONS);
    for (let i = 0; i < count; i++) {
      const button = pad.buttons[i];
      const down = button !== undefined && (button.pressed || button.value > TRIGGER_THRESHOLD);
      const wasDown = this.prevDown[i] === 1;
      this.prevDown[i] = down ? 1 : 0;
      if (!down) continue;
      active = true;
      const bit = DEFAULT_GAMEPAD_BINDINGS[i];
      if (bit !== undefined) held |= bit;
      if (wasDown) continue;
      if (bit !== undefined) this.sink.pressed(bit);
      if (i === GAMEPAD_BUTTON.Start) this.sink.appAction('pause');
      if (i === GAMEPAD_BUTTON.Select) this.sink.appAction('debug');
    }
    this.heldMask = held;
    if (active) this.sink.used('gamepad');
  }

  private pickGamepad(): Gamepad | null {
    if (typeof navigator.getGamepads !== 'function') return null;
    for (const pad of navigator.getGamepads()) {
      if (pad?.connected && pad.mapping === 'standard') return pad;
    }
    for (const pad of navigator.getGamepads()) {
      if (pad?.connected) return pad;
    }
    return null;
  }

  private reset(): void {
    this.connected = false;
    this.heldMask = 0;
    this.hasAim = false;
    setVec2(this.move, 0, 0);
    this.prevDown.fill(0);
  }

  rumble(durationMs: number, strength: number): void {
    const pad = this.pickGamepad();
    const actuator = pad?.vibrationActuator;
    if (!actuator) return;
    void actuator
      .playEffect('dual-rumble', {
        duration: durationMs,
        strongMagnitude: strength,
        weakMagnitude: strength,
      })
      .catch(() => {});
  }

  readMove(out: Vec2): Vec2 {
    return setVec2(out, this.move.x, this.move.y);
  }
}
