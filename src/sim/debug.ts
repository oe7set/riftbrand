import { killEnemy } from './combat/damage';
import { C } from './ecs/components';
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
