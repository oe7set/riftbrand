import { definePuzzle, type PuzzleDef } from '../schema';

/**
 * Puzzle rooms (ROADMAP M6.0). Every one is solvable with the starting kit: blade, dash and
 * rift shot. Names and Iskra's hints live in the locales as `puzzle.<id>.name` and `.hint`.
 * Ordered pieces show their order as pips, so no puzzle needs trial and error.
 */
const W = 1000;
const H = 1000;
const start = { x: W / 2, y: H - 100 };
const exit = { x: W / 2, y: 80 };

export const PUZZLES: readonly PuzzleDef[] = [
  // Teaches order: four bowls, pips tell the sequence.
  definePuzzle({
    id: 'four_bowls',
    widthPx: W,
    heightPx: H,
    obstacles: [
      { kind: 'circle', x: 150, y: 200, r: 40 },
      { kind: 'circle', x: 850, y: 200, r: 40 },
    ],
    playerStart: start,
    exit,
    elements: [
      { kind: 'brazier', x: 260, y: 500, group: 'fire', order: 1 },
      { kind: 'brazier', x: 500, y: 700, group: 'fire', order: 2 },
      { kind: 'brazier', x: 740, y: 500, group: 'fire', order: 3 },
      { kind: 'brazier', x: 500, y: 300, group: 'fire', order: 4 },
    ],
    goal: 'fire',
    worlds: [],
  }),
  // Teaches stepping: a path of floor runes, walked in order.
  definePuzzle({
    id: 'rune_path',
    widthPx: W,
    heightPx: H,
    obstacles: [
      { kind: 'circle', x: 150, y: 560, r: 36 },
      { kind: 'circle', x: 850, y: 480, r: 36 },
      { kind: 'circle', x: 500, y: 640, r: 30 },
    ],
    playerStart: start,
    exit,
    elements: [
      { kind: 'rune', x: 250, y: 760, group: 'runes', order: 1 },
      { kind: 'rune', x: 750, y: 720, group: 'runes', order: 2 },
      { kind: 'rune', x: 500, y: 520, group: 'runes', order: 3 },
      { kind: 'rune', x: 250, y: 330, group: 'runes', order: 4 },
      { kind: 'rune', x: 750, y: 280, group: 'runes', order: 5 },
    ],
    goal: 'runes',
    worlds: [],
  }),
  // Teaches the dash over a drop and a crystal on a timer: hit it, then hurry to the gate.
  definePuzzle({
    id: 'ember_switch',
    widthPx: W,
    heightPx: H,
    obstacles: [
      { kind: 'rect', x: 0, y: 170, w: 400, h: 40 },
      { kind: 'rect', x: 600, y: 170, w: 400, h: 40 },
    ],
    playerStart: start,
    exit,
    elements: [
      { kind: 'chasm', x: 0, y: 420, w: W, h: 110 },
      { kind: 'gate', x: 400, y: 170, w: 200, h: 40, opens: 'beam' },
      { kind: 'crystal', x: 120, y: 860, group: 'beam', holdSec: 6 },
      { kind: 'brazier', x: 300, y: 100, group: 'goal' },
    ],
    goal: 'goal',
    worlds: [],
  }),
  // Teaches the rift shot: the crystal floats on an island no dash can reach.
  definePuzzle({
    id: 'crystal_island',
    widthPx: W,
    heightPx: H,
    obstacles: [],
    playerStart: start,
    exit,
    elements: [
      { kind: 'chasm', x: 240, y: 210, w: 520, h: 200 },
      { kind: 'chasm', x: 240, y: 490, w: 520, h: 200 },
      { kind: 'chasm', x: 240, y: 410, w: 220, h: 80 },
      { kind: 'chasm', x: 540, y: 410, w: 220, h: 80 },
      { kind: 'crystal', x: 500, y: 450, group: 'light' },
    ],
    goal: 'light',
    worlds: [],
  }),
  // Teaches blocks: two stones onto two plates open the way out.
  definePuzzle({
    id: 'stone_plates',
    widthPx: W,
    heightPx: H,
    obstacles: [
      { kind: 'rect', x: 0, y: 180, w: 420, h: 40 },
      { kind: 'rect', x: 580, y: 180, w: 420, h: 40 },
    ],
    playerStart: start,
    exit,
    elements: [
      { kind: 'block', x: 372, y: 628 },
      { kind: 'block', x: 628, y: 628 },
      { kind: 'plate', x: 372, y: 372, group: 'plates' },
      { kind: 'plate', x: 820, y: 628, group: 'plates' },
      { kind: 'gate', x: 420, y: 180, w: 160, h: 40, opens: 'plates' },
      { kind: 'reset', x: 900, y: 900 },
    ],
    goal: 'plates',
    worlds: [],
  }),
  // Everything together: a block holds one gate, a floating crystal opens the other.
  definePuzzle({
    id: 'twin_fires',
    widthPx: W,
    heightPx: H,
    obstacles: [
      { kind: 'rect', x: 300, y: 0, w: 40, h: 340 },
      { kind: 'rect', x: 0, y: 300, w: 100, h: 40 },
      { kind: 'rect', x: 220, y: 300, w: 80, h: 40 },
      { kind: 'rect', x: 660, y: 0, w: 40, h: 340 },
      { kind: 'rect', x: 700, y: 300, w: 80, h: 40 },
      { kind: 'rect', x: 900, y: 300, w: 100, h: 40 },
    ],
    playerStart: start,
    exit,
    elements: [
      { kind: 'gate', x: 100, y: 300, w: 120, h: 40, opens: 'held' },
      { kind: 'gate', x: 780, y: 300, w: 120, h: 40, opens: 'spark' },
      { kind: 'brazier', x: 160, y: 140, group: 'twin' },
      { kind: 'brazier', x: 840, y: 140, group: 'twin' },
      { kind: 'block', x: 628, y: 620 },
      { kind: 'plate', x: 500, y: 620, group: 'held' },
      { kind: 'chasm', x: 700, y: 520, w: 300, h: 200 },
      { kind: 'crystal', x: 900, y: 620, group: 'spark' },
      { kind: 'reset', x: 80, y: 900 },
    ],
    goal: 'twin',
    worlds: [],
  }),
];

export function puzzleById(id: string): PuzzleDef | undefined {
  return PUZZLES.find((p) => p.id === id);
}
