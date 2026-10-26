import { registerTunables } from '../tunables';

/** Feel of puzzle rooms (ROADMAP M6.0). Sizes are in pixels, times in seconds. */
export const PUZZLE_TUNING = {
  /** Hit radius of braziers, crystals and reset stones (also their solid radius). */
  pieceRadiusPx: 22,
  /** Half the side of a pressure plate or floor rune. */
  padHalfPx: 30,
  /** Blocks are squares of this size and move one block length per push. */
  blockSizePx: 64,
  /** How long the player leans into a block before it moves (no accidental pushes). */
  pushDelaySec: 0.2,
  blockSlideSec: 0.16,
  /** Damage for falling into a chasm; it never kills. */
  fallDamage: 6,
  /** Iskra's hint shows after this many wrong orders, or after this long without progress. */
  hintAfterFails: 2,
  hintAfterSec: 40,
};

registerTunables('puzzles', 'src/content/puzzles/tuning.ts', PUZZLE_TUNING);
