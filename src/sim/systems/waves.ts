import { ENEMIES } from '../../content/enemies';
import { TUNING } from '../../content/tuning';
import { Ev, pushEvent } from '../events';
import { nextFloat, nextRange } from '../rng/rng';
import { type SimState, spawnEnemy } from '../sim';
import { secondsToTicks } from '../time';

export const WavePhase = {
  Intermission: 0,
  Active: 1,
} as const;

const MAX_PENDING = 64;
const SPAWN_MARGIN_PX = 60;
const SPAWN_POSITION_TRIES = 12;

/** Endless arena mode for the prototype: waves grow by budget (ROADMAP M1). */
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

/** Opens a spawn portal; the enemy appears after the warning time (GDD §4.6 rule 3). */
export function scheduleSpawn(state: SimState, type: number, delaySec: number): boolean {
  const w = state.waves;
  if (w.pendingCount >= MAX_PENDING) return false;
  const c = state.c;
  const px = c.posX[state.playerEid] as number;
  const py = c.posY[state.playerEid] as number;
  const rng = state.rng.spawn;
  let x = 0;
  let y = 0;
  let bestDist = -1;
  for (let i = 0; i < SPAWN_POSITION_TRIES; i++) {
    const cx = nextRange(rng, SPAWN_MARGIN_PX, state.arenaWidthPx - SPAWN_MARGIN_PX);
    const cy = nextRange(rng, SPAWN_MARGIN_PX, state.arenaHeightPx - SPAWN_MARGIN_PX);
    const d = Math.hypot(cx - px, cy - py);
    if (d > bestDist) {
      bestDist = d;
      x = cx;
      y = cy;
    }
    if (d >= TUNING.spawnMinDistPx) break;
  }
  const i = w.pendingCount++;
  w.pendingType[i] = type;
  w.pendingX[i] = x;
  w.pendingY[i] = y;
  w.pendingTicks[i] = Math.max(1, secondsToTicks(delaySec));
  const e = pushEvent(state.events, Ev.SpawnWarn, x, y);
  if (e) {
    e.value = type;
    e.amount = delaySec;
  }
  return true;
}

export function startWave(state: SimState): void {
  const w = state.waves;
  w.wave++;
  w.phase = WavePhase.Active;
  let budget = TUNING.waveBaseBudget + (w.wave - 1) * TUNING.waveBudgetPerWave;
  let spawned = 0;
  const rng = state.rng.spawn;
  while (budget > 0) {
    let eligible = 0;
    for (const def of ENEMIES) if (def.minWave <= w.wave && def.waveCost <= budget) eligible++;
    if (eligible === 0) break;
    let pick = Math.floor(nextFloat(rng) * eligible);
    for (let type = 0; type < ENEMIES.length; type++) {
      const def = ENEMIES[type];
      if (!def || def.minWave > w.wave || def.waveCost > budget) continue;
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
  const e = pushEvent(state.events, Ev.WaveStart, 0, 0);
  if (e) e.value = w.wave;
}

export function waveSystem(state: SimState): void {
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
  if (state.gameOver) return;

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
