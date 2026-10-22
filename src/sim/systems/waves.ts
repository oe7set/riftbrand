import { ENEMIES } from '../../content/enemies';
import { TUNING } from '../../content/tuning';
import { killEnemy } from '../combat/damage';
import { C } from '../ecs/components';
import { Ev, pushEvent } from '../events';
import { nextFloat, nextInt, nextRange } from '../rng/rng';
import { overlapsObstacle } from '../room';
import { type SimState, spawnEnemy } from '../sim';
import { secondsToTicks } from '../time';

export const WavePhase = {
  Intermission: 0,
  Active: 1,
} as const;

const MAX_PENDING = 64;
const SPAWN_MARGIN_PX = 60;
const SPAWN_POSITION_TRIES = 16;
const SPAWN_POINT_JITTER_PX = 50;
const EXIT_RADIUS_PX = 40;

/** Spawning for all room modes: endless arena, fixed encounter waves, timed horde. */
export interface WaveState {
  wave: number;
  phase: (typeof WavePhase)[keyof typeof WavePhase];
  timerTicks: number;
  readonly pendingType: Uint8Array;
  readonly pendingX: Float64Array;
  readonly pendingY: Float64Array;
  readonly pendingTicks: Int32Array;
  pendingCount: number;
}

export function createWaveState(): WaveState {
  return {
    wave: 0,
    phase: WavePhase.Intermission,
    timerTicks: 0,
    pendingType: new Uint8Array(MAX_PENDING),
    pendingX: new Float64Array(MAX_PENDING),
    pendingY: new Float64Array(MAX_PENDING),
    pendingTicks: new Int32Array(MAX_PENDING),
    pendingCount: 0,
  };
}

const spot = { x: 0, y: 0 };

/** Picks a spawn position away from the player and outside obstacles (GDD §4.6 rule 3). */
function pickSpawnSpot(state: SimState, radius: number): void {
  const c = state.c;
  const px = c.posX[state.playerEid] as number;
  const py = c.posY[state.playerEid] as number;
  const rng = state.rng.spawn;
  const room = state.room;
  let bestDist = -1;
  for (let i = 0; i < SPAWN_POSITION_TRIES; i++) {
    let cx: number;
    let cy: number;
    if (room.spawnPointCount > 0 && i < SPAWN_POSITION_TRIES / 2) {
      const k = nextInt(rng, 0, room.spawnPointCount);
      cx =
        (room.spawnPoints[k * 2] as number) +
        nextRange(rng, -SPAWN_POINT_JITTER_PX, SPAWN_POINT_JITTER_PX);
      cy =
        (room.spawnPoints[k * 2 + 1] as number) +
        nextRange(rng, -SPAWN_POINT_JITTER_PX, SPAWN_POINT_JITTER_PX);
    } else {
      cx = nextRange(rng, SPAWN_MARGIN_PX, state.arenaWidthPx - SPAWN_MARGIN_PX);
      cy = nextRange(rng, SPAWN_MARGIN_PX, state.arenaHeightPx - SPAWN_MARGIN_PX);
    }
    if (overlapsObstacle(room, cx, cy, radius)) continue;
    const d = Math.hypot(cx - px, cy - py);
    if (d > bestDist) {
      bestDist = d;
      spot.x = cx;
      spot.y = cy;
    }
    if (d >= TUNING.spawnMinDistPx) return;
  }
  if (bestDist < 0) {
    // Everything collided (shouldn't happen with sane layouts): fall back to a free corner.
    spot.x = SPAWN_MARGIN_PX;
    spot.y = SPAWN_MARGIN_PX;
  }
}

/** Opens a spawn portal; the enemy appears after the warning time. */
export function scheduleSpawn(state: SimState, type: number, delaySec: number): boolean {
  const w = state.waves;
  if (w.pendingCount >= MAX_PENDING) return false;
  pickSpawnSpot(state, ENEMIES[type]?.radiusPx ?? 20);
  const i = w.pendingCount++;
  w.pendingType[i] = type;
  w.pendingX[i] = spot.x;
  w.pendingY[i] = spot.y;
  w.pendingTicks[i] = Math.max(1, secondsToTicks(delaySec));
  const e = pushEvent(state.events, Ev.SpawnWarn, spot.x, spot.y);
  if (e) {
    e.value = type;
    e.amount = delaySec;
  }
  return true;
}

function spawnList(state: SimState, types: readonly number[]): void {
  for (let i = 0; i < types.length; i++) {
    scheduleSpawn(state, types[i] as number, TUNING.spawnPortalSec + i * TUNING.spawnStaggerSec);
  }
}

/** Endless arena: budget grows each wave. */
function composeArenaWave(state: SimState, wave: number): void {
  let budget = TUNING.waveBaseBudget + (wave - 1) * TUNING.waveBudgetPerWave;
  let spawned = 0;
  const rng = state.rng.spawn;
  while (budget > 0) {
    let eligible = 0;
    for (const def of ENEMIES) if (def.minWave <= wave && def.waveCost <= budget) eligible++;
    if (eligible === 0) break;
    let pick = Math.floor(nextFloat(rng) * eligible);
    for (let type = 0; type < ENEMIES.length; type++) {
      const def = ENEMIES[type];
      if (!def || def.minWave > wave || def.waveCost > budget) continue;
      if (pick-- > 0) continue;
      if (!scheduleSpawn(state, type, TUNING.spawnPortalSec + spawned * TUNING.spawnStaggerSec)) {
        budget = 0;
        break;
      }
      budget -= def.waveCost;
      spawned++;
      break;
    }
  }
}

export function startWave(state: SimState): void {
  const w = state.waves;
  const room = state.room;
  w.wave++;
  w.phase = WavePhase.Active;
  if (room.mode === 'waves') {
    room.waveIndex++;
    spawnList(state, room.waves[room.waveIndex] ?? []);
  } else if (room.mode === 'arena') {
    composeArenaWave(state, w.wave);
  }
  const e = pushEvent(state.events, Ev.WaveStart, 0, 0);
  if (e) {
    e.value = w.wave;
    e.amount = room.mode === 'waves' ? room.waves.length : 0;
  }
}

function clearRoom(state: SimState): void {
  const room = state.room;
  if (room.cleared) return;
  room.cleared = true;
  room.exitOpen = true;
  const e = pushEvent(state.events, Ev.RoomCleared, room.exitX, room.exitY);
  if (e) e.value = state.waves.wave;
}

function processPending(state: SimState): void {
  const w = state.waves;
  for (let i = 0; i < w.pendingCount; ) {
    const t = (w.pendingTicks[i] as number) - 1;
    w.pendingTicks[i] = t;
    if (t > 0) {
      i++;
      continue;
    }
    spawnEnemy(state, w.pendingType[i] as number, w.pendingX[i] as number, w.pendingY[i] as number);
    // Swap-remove keeps the arrays dense; order stays deterministic.
    const last = --w.pendingCount;
    w.pendingType[i] = w.pendingType[last] as number;
    w.pendingX[i] = w.pendingX[last] as number;
    w.pendingY[i] = w.pendingY[last] as number;
    w.pendingTicks[i] = w.pendingTicks[last] as number;
  }
}

function hordeSystem(state: SimState): void {
  const room = state.room;
  const w = state.waves;
  if (room.cleared) return;
  if (w.phase === WavePhase.Intermission) {
    w.timerTicks--;
    if (w.timerTicks <= 0) startWave(state);
    return;
  }
  room.hordeTicksLeft--;
  if (room.hordeTicksLeft <= 0) {
    // Survived: every remaining enemy burns away at once, the payoff of a horde room.
    w.pendingCount = 0;
    for (let eid = 0; eid < state.world.highWater; eid++) {
      if (((state.world.masks[eid] as number) & C.Enemy) !== 0) killEnemy(state, eid, 0, -1, false);
    }
    clearRoom(state);
    return;
  }
  room.hordeSpawnTicks--;
  if (room.hordeSpawnTicks > 0 || room.hordePool.length === 0) return;
  room.hordeSpawnTicks = room.hordeSpawnIntervalTicks;
  // Pressure rises over the duration: one enemy at first, up to three near the end.
  const total = room.hordeTicksLeft + room.elapsedTicks;
  const progress = total > 0 ? room.elapsedTicks / total : 0;
  const count = 1 + Math.floor(progress * 2.99);
  for (let i = 0; i < count; i++) {
    const type = room.hordePool[nextInt(state.rng.spawn, 0, room.hordePool.length)] as number;
    scheduleSpawn(state, type, TUNING.spawnPortalSec + i * TUNING.spawnStaggerSec);
  }
}

function encounterSystem(state: SimState): void {
  const w = state.waves;
  const room = state.room;
  if (room.cleared) return;
  if (w.phase === WavePhase.Active) {
    if (state.enemiesAlive > 0 || w.pendingCount > 0) return;
    if (room.waveIndex >= room.waves.length - 1) {
      clearRoom(state);
      return;
    }
    w.phase = WavePhase.Intermission;
    w.timerTicks = secondsToTicks(TUNING.encounterWaveGapSec);
    return;
  }
  if (!state.debug.wavesEnabled) return;
  w.timerTicks--;
  if (w.timerTicks <= 0) startWave(state);
}

function arenaSystem(state: SimState): void {
  const w = state.waves;
  if (w.phase === WavePhase.Active) {
    if (state.enemiesAlive <= 0 && w.pendingCount === 0) {
      w.phase = WavePhase.Intermission;
      w.timerTicks = secondsToTicks(TUNING.waveIntermissionSec);
      const c = state.c;
      const e = pushEvent(
        state.events,
        Ev.WaveCleared,
        c.posX[state.playerEid] as number,
        c.posY[state.playerEid] as number,
      );
      if (e) e.value = w.wave;
    }
    return;
  }
  if (!state.debug.wavesEnabled) return;
  w.timerTicks--;
  if (w.timerTicks <= 0) startWave(state);
}

function exitSystem(state: SimState): void {
  const room = state.room;
  if (!room.exitOpen || room.exitReached) return;
  const c = state.c;
  const dx = (c.posX[state.playerEid] as number) - room.exitX;
  const dy = (c.posY[state.playerEid] as number) - room.exitY;
  const reach = EXIT_RADIUS_PX + (c.radius[state.playerEid] as number);
  if (dx * dx + dy * dy > reach * reach) return;
  room.exitReached = true;
  pushEvent(state.events, Ev.ExitReached, room.exitX, room.exitY);
}

export function waveSystem(state: SimState): void {
  processPending(state);
  if (state.gameOver) return;
  state.room.elapsedTicks++;
  if (state.room.mode === 'arena') arenaSystem(state);
  else if (state.room.mode === 'horde') hordeSystem(state);
  else encounterSystem(state);
  exitSystem(state);
}

/** Debug: finish the current room immediately. */
export function forceClearRoom(state: SimState): void {
  const room = state.room;
  state.waves.pendingCount = 0;
  for (let eid = 0; eid < state.world.highWater; eid++) {
    if (((state.world.masks[eid] as number) & C.Enemy) !== 0) killEnemy(state, eid, 0, -1, false);
  }
  if (room.mode === 'arena') return;
  if (room.mode === 'waves') {
    room.waveIndex = room.waves.length - 1;
    state.waves.phase = WavePhase.Active;
  } else {
    room.hordeTicksLeft = 1;
    state.waves.phase = WavePhase.Active;
  }
}
