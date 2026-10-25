export interface ViewportSize {
  /** CSS pixels. */
  width: number;
  height: number;
  devicePixelRatio: number;
}

export function readViewport(): ViewportSize {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio || 1,
  };
}

/** Calls back on resize/rotation (debounced to one call per animation frame). */
export function watchViewport(callback: (size: ViewportSize) => void): () => void {
  let scheduled = false;
  const handler = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      callback(readViewport());
    });
  };
  window.addEventListener('resize', handler);
  window.addEventListener('orientationchange', handler);
  window.visualViewport?.addEventListener('resize', handler);
  return () => {
    window.removeEventListener('resize', handler);
    window.removeEventListener('orientationchange', handler);
    window.visualViewport?.removeEventListener('resize', handler);
  };
}

/** Fires when the player switches apps/tabs or the window loses focus (auto-pause, GDD §10.1). */
export function watchFocusLoss(callback: () => void): () => void {
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') callback();
  };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('blur', callback);
  window.addEventListener('pagehide', callback);
  return () => {
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('blur', callback);
    window.removeEventListener('pagehide', callback);
  };
}

export function hasTouchScreen(): boolean {
  return navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches;
}

export function preferredLanguages(): readonly string[] {
  return navigator.languages?.length ? navigator.languages : [navigator.language];
}

export function nowMs(): number {
  return performance.now();
}

const DAY_MS = 86_400_000;
/** 1970-01-01 was a Thursday; shifting by 3 days makes weeks start on Monday. */
const MONDAY_SHIFT_DAYS = 3;

/** Index of the current calendar week (UTC, Monday to Sunday), for Nix's weekly offer. */
export function currentWeekIndex(): number {
  return Math.floor((Math.floor(Date.now() / DAY_MS) + MONDAY_SHIFT_DAYS) / 7);
}

/** Whole days until the next week starts (1–7), for the "new offer in …" hint. */
export function daysUntilNextWeek(): number {
  const day = (Math.floor(Date.now() / DAY_MS) + MONDAY_SHIFT_DAYS) % 7;
  return 7 - day;
}

/** Applies the menu look of an art style: CSS variables and a data attribute on <html>. */
export function applyUiTheme(id: string, vars: Readonly<Record<string, string>>): void {
  const rootEl = document.documentElement;
  rootEl.dataset.style = id;
  for (const [name, value] of Object.entries(vars)) rootEl.style.setProperty(name, value);
}
