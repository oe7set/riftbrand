import { killEnemy } from './combat/damage';
import { C } from './ecs/components';
import type { SimState } from './sim';
import { forceClearRoom, scheduleSpawn, startWave, WavePhase } from './systems/waves';

/** Debug-menu actions. They mutate the sim like inputs do, so they stay deterministic. */
export function debugSpawnEnemy(state: SimState, type: number): void {
  scheduleSpawn(state, type, 0.4);
}

export function debugKillAllEnemies(state: SimState): void {
  for (let eid = 0; eid < state.world.highWater; eid++) {
    if (((state.world.masks[eid] as number) & C.Enemy) !== 0) killEnemy(state, eid, 0, -1);
  }
}

export function debugNextWave(state: SimState): void {
  if (state.waves.phase === WavePhase.Intermission && !state.gameOver) startWave(state);
}

export function debugClearRoom(state: SimState): void {
  forceClearRoom(state);
}
