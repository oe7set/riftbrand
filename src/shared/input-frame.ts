/** Abstract player actions, independent of the input device. */
export const Button = {
  Attack: 1 << 0,
  Special: 1 << 1,
  Dash: 1 << 2,
  Cast: 1 << 3,
  Ultimate: 1 << 4,
  Interact: 1 << 5,
  Spell: 1 << 6,
} as const;

export type ButtonBit = (typeof Button)[keyof typeof Button];

/**
 * Everything the simulation learns from the player in one tick.
 * Kept flat and numeric so it can be recorded for replays and run logs.
 */
export interface InputFrame {
  /** Movement intent, length 0..1. */
  moveX: number;
  moveY: number;
  /** Unit aim direction; only meaningful when `hasAim` is true. */
  aimX: number;
  aimY: number;
  hasAim: boolean;
  /** Aim-assist half-angle in degrees; depends on the device (mouse aims precisely, touch taps don't). */
  assistDeg: number;
  /** Buttons currently held. */
  held: number;
  /** Buttons pressed since the previous tick (edge-triggered). */
  pressed: number;
}

export function createInputFrame(): InputFrame {
  return {
    moveX: 0,
    moveY: 0,
    aimX: 0,
    aimY: 0,
    hasAim: false,
    assistDeg: 30,
    held: 0,
    pressed: 0,
  };
}

export function copyInputFrame(out: InputFrame, src: InputFrame): InputFrame {
  out.moveX = src.moveX;
  out.moveY = src.moveY;
  out.aimX = src.aimX;
  out.aimY = src.aimY;
  out.hasAim = src.hasAim;
  out.assistDeg = src.assistDeg;
  out.held = src.held;
  out.pressed = src.pressed;
  return out;
}
