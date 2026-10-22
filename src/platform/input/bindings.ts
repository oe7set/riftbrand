import { Button, type ButtonBit } from '../../shared/input-frame';

export type MoveDirection = 'up' | 'down' | 'left' | 'right';

/** App-level actions handled outside the sim (they work while paused). */
export type AppAction = 'pause' | 'debug';

export interface KeyBindings {
  move: Record<string, MoveDirection>;
  buttons: Record<string, ButtonBit>;
  app: Record<string, AppAction>;
  mouseButtons: Record<number, ButtonBit>;
}

/** Defaults from GDD §10.2. Keys are KeyboardEvent.code so layouts (QWERTZ/AZERTY) map physically. */
export const DEFAULT_KEY_BINDINGS: KeyBindings = {
  move: {
    KeyW: 'up',
    KeyS: 'down',
    KeyA: 'left',
    KeyD: 'right',
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
  },
  buttons: {
    KeyJ: Button.Attack,
    KeyK: Button.Special,
    Space: Button.Dash,
    ShiftLeft: Button.Dash,
    KeyQ: Button.Cast,
    KeyL: Button.Cast,
    KeyR: Button.Ultimate,
    KeyE: Button.Interact,
    KeyF: Button.Interact,
  },
  app: {
    Escape: 'pause',
    Tab: 'pause',
    Backquote: 'debug',
    F2: 'debug',
  },
  mouseButtons: {
    0: Button.Attack,
    2: Button.Special,
  },
};

/** Standard Gamepad API mapping indices. */
export const GAMEPAD_BUTTON = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  Select: 8,
  Start: 9,
  DpadUp: 12,
  DpadDown: 13,
  DpadLeft: 14,
  DpadRight: 15,
} as const;

/** Menu navigation actions, independent of the device. */
export const MenuAction = {
  Up: 1 << 0,
  Down: 1 << 1,
  Left: 1 << 2,
  Right: 1 << 3,
  Confirm: 1 << 4,
  Back: 1 << 5,
} as const;

export const DEFAULT_GAMEPAD_BINDINGS: Record<number, ButtonBit> = {
  [GAMEPAD_BUTTON.A]: Button.Dash,
  [GAMEPAD_BUTTON.X]: Button.Attack,
  [GAMEPAD_BUTTON.Y]: Button.Special,
  [GAMEPAD_BUTTON.B]: Button.Cast,
  [GAMEPAD_BUTTON.RT]: Button.Ultimate,
  [GAMEPAD_BUTTON.LB]: Button.Interact,
};

export type GamepadFamily = 'xbox' | 'playstation' | 'generic';

export function detectGamepadFamily(id: string): GamepadFamily {
  const lower = id.toLowerCase();
  if (/xbox|xinput|045e/.test(lower)) return 'xbox';
  if (/playstation|dualsense|dualshock|054c|wireless controller/.test(lower)) return 'playstation';
  return 'generic';
}
