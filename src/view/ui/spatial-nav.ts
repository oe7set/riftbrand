export type NavDirection = 'up' | 'down' | 'left' | 'right';

export interface NavRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Picks the best target in a direction for D-pad/stick/arrow-key menu navigation: candidates
 * must lie in that half-plane; closeness along the axis counts more than sideways offset.
 * Returns the index into `candidates`, or -1.
 */
export function pickInDirection(
  from: NavRect,
  candidates: readonly NavRect[],
  dir: NavDirection,
): number {
  const fx = from.x + from.width / 2;
  const fy = from.y + from.height / 2;
  let best = -1;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i] as NavRect;
    const cx = c.x + c.width / 2;
    const cy = c.y + c.height / 2;
    const dx = cx - fx;
    const dy = cy - fy;
    let along: number;
    let across: number;
    if (dir === 'up') [along, across] = [-dy, dx];
    else if (dir === 'down') [along, across] = [dy, dx];
    else if (dir === 'left') [along, across] = [-dx, dy];
    else [along, across] = [dx, dy];
    if (along <= 1) continue;
    const score = along + Math.abs(across) * 2.5;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>('button:not([disabled]), input, select, [data-nav]'),
  ).filter((el) => el.offsetParent !== null);
}

/** Moves DOM focus inside `root`; focuses the first element if nothing in `root` has focus. */
export function navigate(root: HTMLElement, dir: NavDirection): void {
  const items = focusables(root);
  if (items.length === 0) return;
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || !root.contains(active)) {
    (root.querySelector<HTMLElement>('[data-autofocus]') ?? items[0])?.focus();
    return;
  }
  const others = items.filter((el) => el !== active);
  const index = pickInDirection(
    active.getBoundingClientRect(),
    others.map((el) => el.getBoundingClientRect()),
    dir,
  );
  const target = others[index];
  if (target) {
    target.focus();
    target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}
