import { setVec2, type Vec2 } from '../../shared/math/vec2';

export interface Camera {
  /** World position at the screen center. */
  x: number;
  y: number;
  /** Screen CSS pixels per world pixel. */
  zoom: number;
  viewWidth: number;
  viewHeight: number;
}

export function createCamera(): Camera {
  return { x: 0, y: 0, zoom: 1, viewWidth: 1, viewHeight: 1 };
}

/**
 * Zoom so the visible world area stays constant across aspect ratios and orientations:
 * a portrait phone sees as much arena as a landscape one, just taller instead of wider.
 */
export function computeZoom(
  screenWidth: number,
  screenHeight: number,
  areaWidth: number,
  areaHeight: number,
): number {
  return Math.sqrt((screenWidth * screenHeight) / (areaWidth * areaHeight));
}

function clampAxis(center: number, halfView: number, arenaSize: number): number {
  // Arena smaller than the view: keep it centered instead of jittering against both edges.
  if (arenaSize <= halfView * 2) return arenaSize / 2;
  return Math.min(Math.max(center, halfView), arenaSize - halfView);
}

export interface CameraFollowParams {
  targetX: number;
  targetY: number;
  /** Look-ahead direction (unit or zero) and distance in world pixels. */
  lookX: number;
  lookY: number;
  lookaheadPx: number;
  sharpness: number;
  dtSec: number;
  arenaWidth: number;
  arenaHeight: number;
}

/** Frame-rate independent exponential follow, so 60 Hz and 120 Hz screens feel identical. */
export function updateCamera(cam: Camera, p: CameraFollowParams): void {
  const desiredX = p.targetX + p.lookX * p.lookaheadPx;
  const desiredY = p.targetY + p.lookY * p.lookaheadPx;
  const t = 1 - Math.exp(-p.sharpness * p.dtSec);
  cam.x += (desiredX - cam.x) * t;
  cam.y += (desiredY - cam.y) * t;
  cam.x = clampAxis(cam.x, cam.viewWidth / cam.zoom / 2, p.arenaWidth);
  cam.y = clampAxis(cam.y, cam.viewHeight / cam.zoom / 2, p.arenaHeight);
}

export function snapCamera(cam: Camera, x: number, y: number): void {
  cam.x = x;
  cam.y = y;
}

export function worldToScreen(cam: Camera, wx: number, wy: number, out: Vec2): Vec2 {
  return setVec2(
    out,
    (wx - cam.x) * cam.zoom + cam.viewWidth / 2,
    (wy - cam.y) * cam.zoom + cam.viewHeight / 2,
  );
}
