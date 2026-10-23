/**
 * Shared shapes of spell visuals (ROADMAP M4.4), so the entity view (meteor head) and the
 * feedback director (its trail) agree on where things are.
 */

/** The meteor falls in from the upper left onto its mark. */
const METEOR_FALL_DIR_X = -0.55;
const METEOR_FALL_DIR_Y = -1;
export const METEOR_FALL_PX = 180;

/**
 * Offset of the falling meteor's head from its impact point; `progress` runs from 0 (marked)
 * to 1 (impact). It accelerates towards the ground.
 */
export function meteorHeadOffset(progress: number, out: { x: number; y: number }): void {
  const left = (1 - Math.min(1, Math.max(0, progress))) ** 1.7;
  out.x = METEOR_FALL_DIR_X * METEOR_FALL_PX * left;
  out.y = METEOR_FALL_DIR_Y * METEOR_FALL_PX * left;
}

/** Direction the meteor travels in (unit length). */
export const METEOR_TRAVEL_X =
  -METEOR_FALL_DIR_X / Math.hypot(METEOR_FALL_DIR_X, METEOR_FALL_DIR_Y);
export const METEOR_TRAVEL_Y =
  -METEOR_FALL_DIR_Y / Math.hypot(METEOR_FALL_DIR_X, METEOR_FALL_DIR_Y);
