import type { StatusId } from '../content/schema';
import { type StatusIndex, statusIndex } from '../content/statuses';
import { killEnemy } from './combat/damage';
import { C } from './ecs/components';
import { applyStatus } from './effects/status';
import type { SimState } from './sim';
import { forceClearRoom, scheduleSpawn, startWave, WavePhase } from './systems/waves';

/** Debug-menu actions. They mutate the sim like inputs do, so they stay deterministic. */
/** `code` is a packed enemy (type + elite modifier, see enemy-code). */
export function debugSpawnEnemy(state: SimState, code: number): void {
  scheduleSpawn(state, code, 0.4);
}

export function debugKillAllEnemies(state: SimState): void {
  for (let eid = 0; eid < state.world.highWater; eid++) {
    if (((state.world.masks[eid] as number) & C.Enemy) !== 0) killEnemy(state, eid, 0, -1, false);
  }
}

/** Puts every enemy on a ring around the player, for looking at bodies up close (ROADMAP M4). */
export function debugGatherEnemies(state: SimState, radiusPx: number): void {
  const { c } = state;
  const px = c.posX[state.playerEid] as number;
  const py = c.posY[state.playerEid] as number;
  let n = 0;
  for (let eid = 0; eid < state.world.highWater; eid++) {
    if (((state.world.masks[eid] as number) & C.Enemy) !== 0) n++;
  }
  let i = 0;
  for (let eid = 0; eid < state.world.highWater; eid++) {
    if (((state.world.masks[eid] as number) & C.Enemy) === 0) continue;
    const a = (i++ / Math.max(1, n)) * Math.PI * 2;
    c.posX[eid] = px + Math.cos(a) * radiusPx;
    c.posY[eid] = py + Math.sin(a) * radiusPx;
    c.prevX[eid] = c.posX[eid] as number;
    c.prevY[eid] = c.posY[eid] as number;
  }
}

export function debugApplyStatus(state: SimState, id: StatusId, stacks: number): void {
  const status: StatusIndex = statusIndex(id);
  for (let eid = 0; eid < state.world.highWater; eid++) {
    if (((state.world.masks[eid] as number) & C.Enemy) !== 0)
      applyStatus(state, eid, status, stacks);
  }
}

export function debugNextWave(state: SimState): void {
  if (state.waves.phase === WavePhase.Intermission && !state.gameOver) startWave(state);
}

export function debugClearRoom(state: SimState): void {
  forceClearRoom(state);
}

/** Puts the player onto the exit portal (if open), skipping the walk. */
export function debugWarpToExit(state: SimState): void {
  if (!state.room.exitOpen) return;
  const p = state.playerEid;
  state.c.posX[p] = state.room.exitX;
  state.c.posY[p] = state.room.exitY;
  state.c.prevX[p] = state.room.exitX;
  state.c.prevY[p] = state.room.exitY;
}
