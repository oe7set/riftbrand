import type { ObstacleDef } from '../content/schema';
import type { PuzzleState } from './puzzle';
import type { Encounter } from './run/encounter';

export type RoomMode = 'arena' | 'waves' | 'horde';

const MAX_RECTS = 64;
const MAX_CIRCLES = 64;
const MAX_SPAWN_POINTS = 16;
const MAX_DOORS = 4;

/** Static room geometry and encounter progress, kept in typed arrays like the rest of the sim. */
export interface RoomState {
  mode: RoomMode;
  /** x, y, w, h per rect. */
  readonly rects: Float64Array;
  rectCount: number;
  /** Rects and circles from the template; puzzle pieces are appended after them. */
  staticRectCount: number;
  staticCircleCount: number;
  /** x, y, r per circle. */
  readonly circles: Float64Array;
  circleCount: number;
  /** x, y per preferred spawn point. */
  readonly spawnPoints: Float64Array;
  spawnPointCount: number;
  exitX: number;
  exitY: number;
  exitOpen: boolean;
  exitReached: boolean;
  cleared: boolean;
  /** Encounter waves as enemy type lists (empty in arena/horde mode). */
  waves: number[][];
  waveIndex: number;
  hordeTicksLeft: number;
  hordeSpawnIntervalTicks: number;
  hordeSpawnTicks: number;
  hordePool: number[];
  /** Ticks spent in this room, for run stats. */
  elapsedTicks: number;
  killsAtStart: number;
  /** Puzzle pieces (ROADMAP M6.0); null outside puzzle rooms. */
  puzzle: PuzzleState | null;
  /**
   * Doors of a room net (ROADMAP M6.0b), up to one per side; 0 = the single exit portal.
   * A door is an exit once the room is cleared (or never had a fight); locked doors take a key.
   */
  doorCount: number;
  readonly doorX: Float64Array;
  readonly doorY: Float64Array;
  /** Direction per door (net Dir: 0 N, 1 E, 2 S, 3 W). */
  readonly doorDir: Int8Array;
  readonly doorLocked: Uint8Array;
  /** A door only counts once the player has stepped away from it (no instant re-exit). */
  readonly doorArmed: Uint8Array;
  /** Doors stay open even before the room is cleared (puzzle rooms you may leave unsolved). */
  doorsAlwaysOpen: boolean;
  /** Index of the door the player left by, -1 while inside. */
  exitDoor: number;
  /** Keys carried into the room, and keys spent on doors here. */
  keys: number;
  keysUsed: number;
}

export function createRoomState(): RoomState {
  return {
    mode: 'arena',
    rects: new Float64Array(MAX_RECTS * 4),
    rectCount: 0,
    staticRectCount: 0,
    staticCircleCount: 0,
    circles: new Float64Array(MAX_CIRCLES * 3),
    circleCount: 0,
    spawnPoints: new Float64Array(MAX_SPAWN_POINTS * 2),
    spawnPointCount: 0,
    exitX: 0,
    exitY: 0,
    exitOpen: false,
    exitReached: false,
    cleared: false,
    waves: [],
    waveIndex: -1,
    hordeTicksLeft: 0,
    hordeSpawnIntervalTicks: 0,
    hordeSpawnTicks: 0,
    hordePool: [],
    elapsedTicks: 0,
    killsAtStart: 0,
    puzzle: null,
    doorCount: 0,
    doorX: new Float64Array(MAX_DOORS),
    doorY: new Float64Array(MAX_DOORS),
    doorDir: new Int8Array(MAX_DOORS),
    doorLocked: new Uint8Array(MAX_DOORS),
    doorArmed: new Uint8Array(MAX_DOORS),
    doorsAlwaysOpen: false,
    exitDoor: -1,
    keys: 0,
    keysUsed: 0,
  };
}

export function loadObstacles(room: RoomState, obstacles: readonly ObstacleDef[]): void {
  room.rectCount = 0;
  room.circleCount = 0;
  for (const o of obstacles) {
    if (o.kind === 'rect' && room.rectCount < MAX_RECTS) {
      const i = room.rectCount++ * 4;
      room.rects[i] = o.x;
      room.rects[i + 1] = o.y;
      room.rects[i + 2] = o.w;
      room.rects[i + 3] = o.h;
    } else if (o.kind === 'circle' && room.circleCount < MAX_CIRCLES) {
      const i = room.circleCount++ * 3;
      room.circles[i] = o.x;
      room.circles[i + 1] = o.y;
      room.circles[i + 2] = o.r;
    }
  }
  room.staticRectCount = room.rectCount;
  room.staticCircleCount = room.circleCount;
}

export interface DoorSetup {
  dir: number;
  x: number;
  y: number;
  locked: boolean;
}

export function loadDoors(room: RoomState, doors: readonly DoorSetup[], keys: number): void {
  room.doorCount = Math.min(doors.length, MAX_DOORS);
  for (let i = 0; i < room.doorCount; i++) {
    const d = doors[i] as DoorSetup;
    room.doorX[i] = d.x;
    room.doorY[i] = d.y;
    room.doorDir[i] = d.dir;
    room.doorLocked[i] = d.locked ? 1 : 0;
    room.doorArmed[i] = 0;
  }
  room.keys = keys;
  room.keysUsed = 0;
  room.exitDoor = -1;
}

export function loadSpawnPoints(
  room: RoomState,
  points: ReadonlyArray<{ x: number; y: number }>,
): void {
  room.spawnPointCount = Math.min(points.length, MAX_SPAWN_POINTS);
  for (let i = 0; i < room.spawnPointCount; i++) {
    room.spawnPoints[i * 2] = points[i]?.x ?? 0;
    room.spawnPoints[i * 2 + 1] = points[i]?.y ?? 0;
  }
}

export function loadEncounter(room: RoomState, encounter: Encounter, ticksPerSec: number): void {
  if (encounter.kind === 'waves') {
    room.mode = 'waves';
    room.waves = encounter.waves.map((w) => [...w]);
  } else if (encounter.kind === 'horde') {
    room.mode = 'horde';
    room.hordeTicksLeft = Math.round(encounter.durationSec * ticksPerSec);
    room.hordeSpawnIntervalTicks = Math.max(
      1,
      Math.round(encounter.spawnIntervalSec * ticksPerSec),
    );
    room.hordePool = [...encounter.pool];
  } else {
    room.mode = 'waves';
    room.waves = [];
  }
}

/** Shared scratch output for pushOutOfObstacles, avoiding allocation in hot loops. */
export const pushOut = { x: 0, y: 0, hit: false };

/**
 * Moves a circle (x, y, r) out of every obstacle it overlaps. Result in `pushOut`.
 * Circle-vs-rect uses the closest point on the rect; a centre inside a rect exits via the
 * nearest edge.
 */
export function pushOutOfObstacles(room: RoomState, x: number, y: number, r: number): void {
  let px = x;
  let py = y;
  let hit = false;
  for (let i = 0; i < room.rectCount; i++) {
    const rx = room.rects[i * 4] as number;
    const ry = room.rects[i * 4 + 1] as number;
    const rw = room.rects[i * 4 + 2] as number;
    const rh = room.rects[i * 4 + 3] as number;
    const cx = Math.max(rx, Math.min(px, rx + rw));
    const cy = Math.max(ry, Math.min(py, ry + rh));
    let dx = px - cx;
    let dy = py - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    hit = true;
    if (d2 > 0) {
      const d = Math.sqrt(d2);
      px = cx + (dx / d) * r;
      py = cy + (dy / d) * r;
      continue;
    }
    // Centre inside the rect: leave through the closest side.
    const left = px - rx;
    const right = rx + rw - px;
    const top = py - ry;
    const bottom = ry + rh - py;
    const m = Math.min(left, right, top, bottom);
    dx = m === left ? -1 : m === right ? 1 : 0;
    dy = m === top ? -1 : m === bottom ? 1 : 0;
    if (dx !== 0) px = dx < 0 ? rx - r : rx + rw + r;
    else py = dy < 0 ? ry - r : ry + rh + r;
  }
  for (let i = 0; i < room.circleCount; i++) {
    const ox = room.circles[i * 3] as number;
    const oy = room.circles[i * 3 + 1] as number;
    const minDist = (room.circles[i * 3 + 2] as number) + r;
    const dx = px - ox;
    const dy = py - oy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= minDist * minDist) continue;
    hit = true;
    const d = Math.sqrt(d2);
    if (d === 0) {
      py = oy - minDist;
      continue;
    }
    px = ox + (dx / d) * minDist;
    py = oy + (dy / d) * minDist;
  }
  pushOut.x = px;
  pushOut.y = py;
  pushOut.hit = hit;
}

/** True if a point (with radius) lies inside any obstacle. */
export function overlapsObstacle(room: RoomState, x: number, y: number, r: number): boolean {
  pushOutOfObstacles(room, x, y, r);
  return pushOut.hit;
}
