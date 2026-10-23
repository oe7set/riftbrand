import { Button, type ButtonBit } from '../../shared/input-frame';

export type TouchButtonId = 'attack' | 'dash' | 'special' | 'cast' | 'ultimate' | 'pause';

/** A player's adjustment of one button: position as a fraction of the screen, size factor. */
export interface TouchButtonOverride {
  x: number;
  y: number;
  scale: number;
}

/** Layout editor result (GDD §10.1): one profile per orientation. */
export interface TouchLayoutOverrides {
  portrait: Partial<Record<TouchButtonId, TouchButtonOverride>>;
  landscape: Partial<Record<TouchButtonId, TouchButtonOverride>>;
}

export const MIN_BUTTON_SCALE = 0.6;
export const MAX_BUTTON_SCALE = 1.8;

export interface TouchButtonLayout {
  id: TouchButtonId;
  /** Pause is an app action, not a sim button. */
  bit: ButtonBit | 0;
  x: number;
  y: number;
  radius: number;
  /** Dragging from this button aims manually (GDD §4.4). */
  aimDrag: boolean;
  /**
   * Fires when the thumb lifts instead of on touch, so a drag can aim first (cast). A tap
   * still fires with aim assist.
   */
  fireOnRelease: boolean;
}

export interface TouchLayout {
  orientation: 'landscape' | 'portrait';
  /** Joystick may spawn anywhere inside this rect. */
  joystickZone: { x: number; y: number; width: number; height: number };
  buttons: TouchButtonLayout[];
}

/**
 * Default thumb-friendly layout in CSS pixels: attack button in the bottom-right corner,
 * dash/special/cast/ultimate on an arc around it. Portrait keeps everything in the lower third.
 */
export function computeTouchLayout(
  width: number,
  height: number,
  overrides?: TouchLayoutOverrides,
): TouchLayout {
  const portrait = height > width;
  const short = Math.min(width, height);
  // Scale with the short screen edge, clamped so buttons stay finger-sized.
  const unit = Math.max(0.8, Math.min(1.4, short / 400));
  const margin = 28 * unit;
  const attackR = 46 * unit;
  const smallR = 30 * unit;
  const ax = width - margin - attackR;
  const ay = height - margin - attackR;
  const arc = attackR + smallR + 18 * unit;

  const onArc = (deg: number, r: number) => {
    const rad = (deg * Math.PI) / 180;
    return { x: ax - Math.cos(rad) * r, y: ay - Math.sin(rad) * r };
  };
  const dash = onArc(5, arc);
  const special = onArc(50, arc);
  const cast = onArc(95, arc);
  const ultimate = onArc(50, arc + smallR * 2 + 10 * unit);

  const buttons: TouchButtonLayout[] = [
    {
      id: 'attack',
      bit: Button.Attack,
      x: ax,
      y: ay,
      radius: attackR,
      aimDrag: true,
      fireOnRelease: false,
    },
    {
      id: 'dash',
      bit: Button.Dash,
      ...dash,
      radius: smallR * 1.15,
      aimDrag: false,
      fireOnRelease: false,
    },
    {
      id: 'special',
      bit: Button.Special,
      ...special,
      radius: smallR,
      aimDrag: false,
      fireOnRelease: false,
    },
    { id: 'cast', bit: Button.Cast, ...cast, radius: smallR, aimDrag: true, fireOnRelease: true },
    {
      id: 'ultimate',
      bit: Button.Ultimate,
      ...ultimate,
      radius: smallR * 0.9,
      aimDrag: false,
      fireOnRelease: false,
    },
    {
      id: 'pause',
      bit: 0,
      x: width - 30 * unit,
      y: 30 * unit,
      radius: 20 * unit,
      aimDrag: false,
      fireOnRelease: false,
    },
  ];

  const joystickZone = portrait
    ? { x: 0, y: height * 0.55, width: width * 0.55, height: height * 0.45 }
    : { x: 0, y: height * 0.25, width: width * 0.5, height: height * 0.75 };

  const orientation = portrait ? 'portrait' : 'landscape';
  const custom = overrides?.[orientation];
  if (custom) {
    for (const b of buttons) {
      const o = custom[b.id];
      if (!o) continue;
      b.radius *= Math.min(MAX_BUTTON_SCALE, Math.max(MIN_BUTTON_SCALE, o.scale));
      // Keep every button fully on screen whatever the stored fractions say.
      b.x = Math.min(width - b.radius, Math.max(b.radius, o.x * width));
      b.y = Math.min(height - b.radius, Math.max(b.radius, o.y * height));
    }
  }
  return { orientation, joystickZone, buttons };
}

/** Topmost button under the point, with a small grace radius for imprecise thumbs. */
export function hitTestButton(
  layout: TouchLayout,
  x: number,
  y: number,
  grace = 1.15,
): TouchButtonLayout | null {
  let best: TouchButtonLayout | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const b of layout.buttons) {
    const dx = x - b.x;
    const dy = y - b.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= b.radius * grace && dist / b.radius < bestDist) {
      best = b;
      bestDist = dist / b.radius;
    }
  }
  return best;
}
