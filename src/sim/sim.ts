import { RIFT_SHOT } from '../content/abilities';
import { ENEMIES } from '../content/enemies';
import { TUNING } from '../content/tuning';
import type { InputFrame } from '../shared/input-frame';
import { createSpatialHash, type SpatialHash } from './collision/spatial-hash';
import {
  AiState,
  C,
  type Components,
  createComponents,
  RenderKind,
  resetComponents,
  Team,
} from './ecs/components';
import { addComponents, createEntity, createWorld, destroyEntity, type World } from './ecs/world';
import { type CompiledBuild, compileBuild, type OwnedBoon, type OwnedRelic } from './effects/build';
import { MAX_EFFECT_DEPTH } from './effects/runtime';
import { statusSystem } from './effects/status';
import { clearEvents, createEventBuffer, Ev, type EventBuffer, pushEvent } from './events';
import { createPlayerState, type PlayerState } from './player-state';
import { createRngStreams, nextRange, type RngStreams } from './rng/rng';
import {
  createRoomState,
  loadEncounter,
  loadObstacles,
  loadSpawnPoints,
  type RoomState,
} from './room';
import type { RoomSetup } from './run/run-state';
import { drifterAiSystem } from './systems/drifter-ai';
import { enemyAiSystem } from './systems/enemy-ai';
import { movementSystem } from './systems/movement';
import { capturePlayerInput, playerActionSystem } from './systems/player-actions';
import { projectileSystem } from './systems/projectiles';
import { rebuildSpatialHash, separationSystem } from './systems/separation';
import { createWaveState, type WaveState, waveSystem } from './systems/waves';
import { secondsToTicks, TICK_RATE_HZ } from './time';

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
  readonly events: EventBuffer;
  playerEid: number;
  readonly player: PlayerState;
  readonly waves: WaveState;
  readonly room: RoomState;
  /** Owned boons and their compiled form (stats + trigger lists). */
  boons: OwnedBoon[];
  relics: OwnedRelic[];
  /** Weapon evolutions unlocked in this run (GDD §4.9). */
  evolutions: string[];
  build: CompiledBuild;
  /** Run currency carried into the room plus everything picked up here. */
  shards: number;
  /** Nesting depth of effects triggering effects, and the per-tick budget used. */
  effectDepth: number;
  effectsThisTick: number;
  /** One spatial query buffer per effect depth, so nested effects don't clobber outer loops. */
  readonly effectQueryBuffers: Int32Array[];
  /** Monotonic id per player attack, so one swing damages each enemy at most once. */
  swingCounter: number;
  meleeTokensInUse: number;
  rangedTokensInUse: number;
  enemiesAlive: number;
  gameOver: boolean;
  arenaWidthPx: number;
  arenaHeightPx: number;
  /** Debug switches live in the state so replays with debug actions stay deterministic. */
  readonly debug: { godMode: boolean; wavesEnabled: boolean };
}

export const MAX_MELEE_TOKENS = 3;
export const MAX_RANGED_TOKENS = 4;

/**
 * Creates a room simulation. Without `setup` it is the endless arena (debug/tuning mode);
 * with `setup` it plays one map node of a run.
 */
export function createSim(seed: number, setup?: RoomSetup): SimState {
  const state: SimState = {
    seed: seed >>> 0,
    tick: 0,
    freezeTicks: 0,
    rng: createRngStreams(seed),
    world: createWorld(MAX_ENTITIES),
    c: createComponents(MAX_ENTITIES),
    spatial: createSpatialHash(MAX_ENTITIES, 64),
    queryBuffer: new Int32Array(512),
    events: createEventBuffer(),
    playerEid: -1,
    player: createPlayerState(),
    waves: createWaveState(),
    room: createRoomState(),
    boons: [],
    relics: [],
    evolutions: [],
    build: compileBuild([]),
    shards: 0,
    effectDepth: 0,
    effectsThisTick: 0,
    effectQueryBuffers: Array.from({ length: MAX_EFFECT_DEPTH + 1 }, () => new Int32Array(512)),
    swingCounter: 0,
    meleeTokensInUse: 0,
    rangedTokensInUse: 0,
    enemiesAlive: 0,
    gameOver: false,
    arenaWidthPx: setup?.template.widthPx ?? TUNING.arenaWidthPx,
    arenaHeightPx: setup?.template.heightPx ?? TUNING.arenaHeightPx,
    debug: { godMode: false, wavesEnabled: true },
  };
  if (setup) {
    setBuild(state, setup.boons, setup.relics, setup.evolutions);
    state.shards = setup.shards;
    state.player.ultCharge = setup.ultCharge;
    const t = setup.template;
    loadObstacles(state.room, t.obstacles);
    loadSpawnPoints(state.room, t.spawnPoints);
    loadEncounter(state.room, setup.encounter, TICK_RATE_HZ);
    state.room.exitX = t.exit.x;
    state.room.exitY = t.exit.y;
    state.playerEid = spawnPlayer(state, t.playerStart.x, t.playerStart.y);
    state.c.maxHp[state.playerEid] = setup.playerMaxHp;
    state.c.hp[state.playerEid] = setup.playerHp;
    // Face into the room.
    state.c.facingX[state.playerEid] = 0;
    state.c.facingY[state.playerEid] = -1;
  } else {
    state.playerEid = spawnPlayer(state, state.arenaWidthPx / 2, state.arenaHeightPx / 2);
  }
  state.player.stamina = TUNING.staminaMax;
  state.player.castCharges = RIFT_SHOT.charges;
  state.waves.timerTicks = secondsToTicks(TUNING.firstWaveDelaySec);
  return state;
}

export function spawnEntity(state: SimState, x: number, y: number): number {
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
    C.Transform | C.Velocity | C.Collider | C.PlayerControl | C.Renderable | C.Health,
  );
  const c = state.c;
  c.radius[eid] = TUNING.playerRadiusPx;
  c.renderKind[eid] = RenderKind.Player;
  c.team[eid] = Team.Player;
  c.hp[eid] = TUNING.playerMaxHp;
  c.maxHp[eid] = TUNING.playerMaxHp;
  return eid;
}

export function spawnEnemy(state: SimState, type: number, x: number, y: number): number {
  const def = ENEMIES[type];
  if (!def) return -1;
  const eid = spawnEntity(state, x, y);
  if (eid === -1) return -1;
  addComponents(
    state.world,
    eid,
    C.Transform | C.Velocity | C.Collider | C.Renderable | C.Health | C.Enemy | C.Crowd,
  );
  const c = state.c;
  c.radius[eid] = def.radiusPx;
  c.renderKind[eid] = RenderKind.Enemy;
  c.team[eid] = Team.Enemy;
  c.hp[eid] = def.maxHp;
  c.maxHp[eid] = def.maxHp;
  c.enemyType[eid] = type;
  c.aiState[eid] = AiState.Position;
  c.poise[eid] = def.poise;
  c.aiStrafeSign[eid] = nextRange(state.rng.ai, 0, 1) < 0.5 ? -1 : 1;
  // A short grace period so freshly spawned enemies never attack on their first frame.
  c.aiCooldownTicks[eid] = secondsToTicks(
    nextRange(state.rng.ai, def.attack.cooldownMinSec, def.attack.cooldownMaxSec) * 0.5,
  );
  state.enemiesAlive++;
  const e = pushEvent(state.events, Ev.Spawn, x, y);
  if (e) {
    e.eid = eid;
    e.value = type;
  }
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
      C.Transform | C.Velocity | C.Collider | C.Drifter | C.Renderable | C.Crowd,
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

/** Replaces the player's boons and recompiles the build (room start, debug). */
export function setBuild(
  state: SimState,
  boons: readonly OwnedBoon[],
  relics: readonly OwnedRelic[] = state.relics,
  evolutions: readonly string[] = state.evolutions,
): void {
  state.boons = boons.map((b) => ({ ...b }));
  state.relics = relics.map((r) => ({ ...r }));
  state.evolutions = [...evolutions];
  state.build = compileBuild(state.boons, state.relics, state.evolutions);
}

/** Advances the simulation by exactly one fixed tick. */
export function stepSim(state: SimState, input: InputFrame): void {
  state.tick++;
  const { world, c } = state;
  for (let eid = 0; eid < world.highWater; eid++) {
    c.prevX[eid] = c.posX[eid] as number;
    c.prevY[eid] = c.posY[eid] as number;
  }
  // Presses during hitstop are buffered, never lost.
  capturePlayerInput(state, input);
  if (state.freezeTicks > 0) {
    state.freezeTicks--;
    return;
  }
  state.effectsThisTick = 0;
  rebuildSpatialHash(state);
  playerActionSystem(state, input);
  enemyAiSystem(state);
  statusSystem(state);
  drifterAiSystem(state);
  movementSystem(state);
  projectileSystem(state);
  separationSystem(state);
  waveSystem(state);
}

/** Hands the accumulated events to a consumer (the view) and clears the buffer. */
export function drainEvents(state: SimState, consume: (events: EventBuffer) => void): void {
  consume(state.events);
  clearEvents(state.events);
}
