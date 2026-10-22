import { defineRoom, type RoomTemplateDef } from '../schema';

/**
 * Arena layouts (ROADMAP M2: ~8 templates). Kept roughly square so they read well in portrait
 * and landscape. Obstacles give dashes something to play around without hiding threats.
 */
const W = 1100;
const H = 1100;
const center = { x: W / 2, y: H / 2 };
const start = { x: W / 2, y: H - 140 };
const exit = { x: W / 2, y: 90 };
const corners = [
  { x: 160, y: 160 },
  { x: W - 160, y: 160 },
  { x: 160, y: H - 380 },
  { x: W - 160, y: H - 380 },
];

export const ROOMS: readonly RoomTemplateDef[] = [
  defineRoom({
    id: 'open_ash',
    widthPx: W,
    heightPx: H,
    types: ['combat', 'elite', 'horde'],
    obstacles: [],
    playerStart: start,
    exit,
    spawnPoints: [...corners, center],
  }),
  defineRoom({
    id: 'four_pillars',
    widthPx: W,
    heightPx: H,
    types: ['combat', 'elite'],
    obstacles: [
      { kind: 'circle', x: 330, y: 330, r: 48 },
      { kind: 'circle', x: W - 330, y: 330, r: 48 },
      { kind: 'circle', x: 330, y: H - 400, r: 48 },
      { kind: 'circle', x: W - 330, y: H - 400, r: 48 },
    ],
    playerStart: start,
    exit,
    spawnPoints: [...corners, center],
  }),
  defineRoom({
    id: 'central_altar',
    widthPx: W,
    heightPx: H,
    types: ['combat', 'horde'],
    obstacles: [{ kind: 'rect', x: W / 2 - 110, y: H / 2 - 110, w: 220, h: 220 }],
    playerStart: start,
    exit,
    spawnPoints: corners,
  }),
  defineRoom({
    id: 'twin_walls',
    widthPx: W,
    heightPx: H,
    types: ['combat', 'elite'],
    obstacles: [
      { kind: 'rect', x: 230, y: 380, w: 60, h: 300 },
      { kind: 'rect', x: W - 290, y: 380, w: 60, h: 300 },
    ],
    playerStart: start,
    exit,
    spawnPoints: [...corners, center],
  }),
  defineRoom({
    id: 'broken_ring',
    widthPx: W,
    heightPx: H,
    types: ['combat', 'horde'],
    obstacles: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      return {
        kind: 'circle' as const,
        x: W / 2 + Math.cos(a) * 300,
        y: H / 2 - 40 + Math.sin(a) * 300,
        r: 34,
      };
    }),
    playerStart: start,
    exit,
    spawnPoints: [center, ...corners],
  }),
  defineRoom({
    id: 'scattered_slag',
    widthPx: W,
    heightPx: H,
    types: ['combat', 'elite', 'horde'],
    obstacles: [
      { kind: 'circle', x: 250, y: 520, r: 40 },
      { kind: 'circle', x: 520, y: 300, r: 30 },
      { kind: 'circle', x: 820, y: 560, r: 44 },
      { kind: 'rect', x: 420, y: 640, w: 140, h: 50 },
      { kind: 'circle', x: 760, y: 240, r: 26 },
    ],
    playerStart: start,
    exit,
    spawnPoints: [...corners, center],
  }),
  defineRoom({
    id: 'cross_halls',
    widthPx: W,
    heightPx: H,
    types: ['combat', 'elite'],
    obstacles: [
      { kind: 'rect', x: 140, y: 140, w: 240, h: 200 },
      { kind: 'rect', x: W - 380, y: 140, w: 240, h: 200 },
      { kind: 'rect', x: 140, y: H - 460, w: 240, h: 200 },
      { kind: 'rect', x: W - 380, y: H - 460, w: 240, h: 200 },
    ],
    playerStart: start,
    exit,
    spawnPoints: [
      { x: W / 2, y: 200 },
      { x: 100, y: H / 2 - 80 },
      { x: W - 100, y: H / 2 - 80 },
      center,
    ],
  }),
  defineRoom({
    id: 'ember_throne',
    widthPx: 1300,
    heightPx: 1300,
    types: ['boss'],
    obstacles: [
      { kind: 'circle', x: 260, y: 260, r: 40 },
      { kind: 'circle', x: 1040, y: 260, r: 40 },
      { kind: 'circle', x: 260, y: 900, r: 40 },
      { kind: 'circle', x: 1040, y: 900, r: 40 },
    ],
    playerStart: { x: 650, y: 1140 },
    exit: { x: 650, y: 100 },
    spawnPoints: [
      { x: 650, y: 400 },
      { x: 300, y: 500 },
      { x: 1000, y: 500 },
      { x: 650, y: 650 },
    ],
  }),
];
