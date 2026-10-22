import { TUNING } from '../content/tuning';
import type { InputFrame } from '../shared/input-frame';
import { createSpatialHash, type SpatialHash } from './collision/spatial-hash';
import {
  C,
  type Components,
  createComponents,
  RenderKind,
  resetComponents,
} from './ecs/components';
import { addComponents, createEntity, createWorld, destroyEntity, type World } from './ecs/world';
import { createRngStreams, nextRange, type RngStreams } from './rng/rng';
import { drifterAiSystem } from './systems/drifter-ai';
import { movementSystem } from './systems/movement';
import { playerControlSystem } from './systems/player-control';
import { separationSystem } from './systems/separation';

export const MAX_ENTITIES = 4096;

export interface SimState {
  readonly seed: number;
  tick: number;
  /** Hitstop: while > 0, gameplay systems are skipped (the view keeps animating). */
  freezeTicks: number;
  readonly rng: RngStreams;
  readonly world: World;
  readonly c: Components;
  readonly spatial: SpatialHash;
  /** Scratch buffer for spatial queries, preallocated to avoid per-tick allocations. */
  readonly queryBuffer: Int32Array;
  playerEid: number;
  arenaWidthPx: number;
  arenaHeightPx: number;
}

export function createSim(seed: number): SimState {
  const state: SimState = {
    seed: seed >>> 0,
    tick: 0,
    freezeTicks: 0,
    rng: createRngStreams(seed),
    world: createWorld(MAX_ENTITIES),
    c: createComponents(MAX_ENTITIES),
    spatial: createSpatialHash(MAX_ENTITIES, 64),
    queryBuffer: new Int32Array(256),
    playerEid: -1,
    arenaWidthPx: TUNING.arenaWidthPx,
    arenaHeightPx: TUNING.arenaHeightPx,
  };
  state.playerEid = spawnPlayer(state, state.arenaWidthPx / 2, state.arenaHeightPx / 2);
  return state;
}

function spawnEntity(state: SimState, x: number, y: number): number {
  const eid = createEntity(state.world);
  if (eid === -1) return -1;
  resetComponents(state.c, eid);
  state.c.posX[eid] = x;
  state.c.posY[eid] = y;
  state.c.prevX[eid] = x;
  state.c.prevY[eid] = y;
  return eid;
}

function spawnPlayer(state: SimState, x: number, y: number): number {
  const eid = spawnEntity(state, x, y);
  addComponents(
    state.world,
    eid,
    C.Transform | C.Velocity | C.Collider | C.PlayerControl | C.Renderable,
  );
  state.c.radius[eid] = TUNING.playerRadiusPx;
  state.c.renderKind[eid] = RenderKind.Player;
  return eid;
}

/** Debug/stress-test helper: wandering dummies that exercise movement and the broadphase. */
export function spawnDrifters(state: SimState, count: number): number {
  let spawned = 0;
  const rng = state.rng.spawn;
  for (let i = 0; i < count; i++) {
    const r = TUNING.drifterRadiusPx;
    const x = nextRange(rng, r, state.arenaWidthPx - r);
    const y = nextRange(rng, r, state.arenaHeightPx - r);
    const eid = spawnEntity(state, x, y);
    if (eid === -1) break;
    addComponents(
      state.world,
      eid,
      C.Transform | C.Velocity | C.Collider | C.Drifter | C.Renderable,
    );
    state.c.radius[eid] = r;
    state.c.renderKind[eid] = RenderKind.Drifter;
    spawned++;
  }
  return spawned;
}

export function clearDrifters(state: SimState): void {
  const { world } = state;
  for (let eid = 0; eid < world.highWater; eid++) {
    if (((world.masks[eid] as number) & C.Drifter) !== 0) destroyEntity(world, eid);
  }
}

/** Advances the simulation by exactly one fixed tick. */
export function stepSim(state: SimState, input: InputFrame): void {
  state.tick++;
  const { world, c } = state;
  for (let eid = 0; eid < world.highWater; eid++) {
    c.prevX[eid] = c.posX[eid] as number;
    c.prevY[eid] = c.posY[eid] as number;
  }
  if (state.freezeTicks > 0) {
    state.freezeTicks--;
    return;
  }
  playerControlSystem(state, input);
  drifterAiSystem(state);
  movementSystem(state);
  separationSystem(state);
}
