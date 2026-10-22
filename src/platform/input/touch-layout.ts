import { Button, type ButtonBit } from '../../shared/input-frame';

export interface TouchButtonLayout {
  id: 'attack' | 'dash' | 'special' | 'cast' | 'ultimate' | 'pause';
  /** Pause is an app action, not a sim button. */
  bit: ButtonBit | 0;
  x: number;
  y: number;
  radius: number;
  /** Dragging from this button aims manually (GDD §4.4). */
  aimDrag: boolean;
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
export function computeTouchLayout(width: number, height: number): TouchLayout {
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
    { id: 'attack', bit: Button.Attack, x: ax, y: ay, radius: attackR, aimDrag: true },
    { id: 'dash', bit: Button.Dash, ...dash, radius: smallR * 1.15, aimDrag: false },
    { id: 'special', bit: Button.Special, ...special, radius: smallR, aimDrag: false },
    { id: 'cast', bit: Button.Cast, ...cast, radius: smallR, aimDrag: true },
    { id: 'ultimate', bit: Button.Ultimate, ...ultimate, radius: smallR * 0.9, aimDrag: false },
    {
      id: 'pause',
      bit: 0,
      x: width - 30 * unit,
      y: 30 * unit,
      radius: 20 * unit,
      aimDrag: false,
    },
  ];

  const joystickZone = portrait
    ? { x: 0, y: height * 0.55, width: width * 0.55, height: height * 0.45 }
    : { x: 0, y: height * 0.25, width: width * 0.5, height: height * 0.75 };

  return { orientation: portrait ? 'portrait' : 'landscape', joystickZone, buttons };
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
