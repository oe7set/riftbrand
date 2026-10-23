/** Component bits. Keep below bit 31 (reserved for ALIVE_BIT). */
export const C = {
  Transform: 1 << 0,
  Velocity: 1 << 1,
  Collider: 1 << 2,
  PlayerControl: 1 << 3,
  Drifter: 1 << 4,
  Renderable: 1 << 5,
  Health: 1 << 6,
  Enemy: 1 << 7,
  Projectile: 1 << 8,
  /** Pushed apart from other bodies by the separation system. */
  Crowd: 1 << 9,
  /** Delayed ground blast (mines, volatile elites): fuse in projLifeTicks, blast radius = radius. */
  Hazard: 1 << 10,
} as const;

/** What the view should draw for an entity; the sim never references textures. */
export const RenderKind = {
  None: 0,
  Player: 1,
  Drifter: 2,
  Enemy: 3,
  EnemyProjectile: 4,
  RiftShot: 5,
  Firebird: 6,
  Hazard: 7,
} as const;

export type RenderKindId = (typeof RenderKind)[keyof typeof RenderKind];

export const Team = {
  None: 0,
  Player: 1,
  Enemy: 2,
} as const;

/** Enemy behaviour states (GDD §5.2: windup → active → recovery is the punish window). */
export const AiState = {
  Position: 0,
  Windup: 1,
  Active: 2,
  Recover: 3,
  Stagger: 4,
} as const;

export const Token = {
  None: 0,
  Melee: 1,
  Ranged: 2,
} as const;

/** Enough to cover a swing's active window plus novas and projectiles landing meanwhile. */
export const HIT_HISTORY = 6;

/** Whether hit `id` already damaged `eid`. */
export function wasHitBy(c: Components, eid: number, id: number): boolean {
  const base = eid * HIT_HISTORY;
  for (let i = 0; i < HIT_HISTORY; i++) if (c.hitHistory[base + i] === id) return true;
  return false;
}

export function rememberHit(c: Components, eid: number, id: number): void {
  const next = c.hitHistoryNext[eid] as number;
  c.hitHistory[eid * HIT_HISTORY + next] = id;
  c.hitHistoryNext[eid] = (next + 1) % HIT_HISTORY;
}

/** Struct-of-arrays component storage, indexed by entity id. */
export interface Components {
  posX: Float64Array;
  posY: Float64Array;
  /** Position at the start of the tick; the view interpolates between prev and pos. */
  prevX: Float64Array;
  prevY: Float64Array;
  velX: Float64Array;
  velY: Float64Array;
  /** Knockback velocity, added on top of velX/velY and decayed every tick. */
  kbX: Float64Array;
  kbY: Float64Array;
  facingX: Float64Array;
  facingY: Float64Array;
  radius: Float64Array;
  renderKind: Uint8Array;
  team: Uint8Array;
  hp: Float64Array;
  maxHp: Float64Array;
  /**
   * The last HIT_HISTORY hit ids (swing, nova, projectile) that damaged this entity, so one
   * attack never hits twice even when other attacks land in between. Slot `eid * HIT_HISTORY + i`.
   */
  hitHistory: Int32Array;
  /** Next slot to overwrite in this entity's hit history. */
  hitHistoryNext: Uint8Array;
  // Enemy
  enemyType: Uint8Array;
  aiState: Uint8Array;
  /** Ticks spent in the current aiState. */
  aiTicks: Int32Array;
  aiCooldownTicks: Int32Array;
  aiDirX: Float64Array;
  aiDirY: Float64Array;
  aiStrafeSign: Int8Array;
  /** 1 once the current attack has resolved against the player (hit or dodged). */
  aiAttackDone: Uint8Array;
  token: Uint8Array;
  poise: Float64Array;
  poiseRegenTicks: Int32Array;
  /** Elite modifier id (0 = none, see content/elites). */
  eliteMod: Uint8Array;
  /** Bosses: current phase and the attack pattern picked for the current attack. */
  aiPhase: Uint8Array;
  aiPattern: Uint8Array;
  // Status effects
  burnStacks: Uint8Array;
  burnTicks: Int32Array;
  burnTickTimer: Int32Array;
  chillStacks: Uint8Array;
  chillTicks: Int32Array;
  frozenTicks: Int32Array;
  // Projectile
  projDamage: Float64Array;
  projLifeTicks: Int32Array;
  // Player projectile extras
  projKnockback: Float64Array;
  projPoise: Float64Array;
  /** 1 = flies through enemies, hitting each once. */
  projPierce: Uint8Array;
  /** StatusCode applied on hit, with projStacks stacks. */
  projStatus: Uint8Array;
  projStacks: Uint8Array;
  /** 1 = cast (triggers onHit cast boons), 0 = effect. */
  projIsCast: Uint8Array;
  /** Hit id shared by all hits of one projectile, so piercing shots hit each enemy once. */
  projSwing: Int32Array;
  /** Hazards: total fuse, so the view can show how close the blast is. */
  hazFuseTotal: Int32Array;
  /** Drifter AI: ticks until a new wander direction is chosen. */
  wanderTicks: Int32Array;
}

export function createComponents(capacity: number): Components {
  return {
    posX: new Float64Array(capacity),
    posY: new Float64Array(capacity),
    prevX: new Float64Array(capacity),
    prevY: new Float64Array(capacity),
    velX: new Float64Array(capacity),
    velY: new Float64Array(capacity),
    kbX: new Float64Array(capacity),
    kbY: new Float64Array(capacity),
    facingX: new Float64Array(capacity),
    facingY: new Float64Array(capacity),
    radius: new Float64Array(capacity),
    renderKind: new Uint8Array(capacity),
    team: new Uint8Array(capacity),
    hp: new Float64Array(capacity),
    maxHp: new Float64Array(capacity),
    hitHistory: new Int32Array(capacity * HIT_HISTORY).fill(-1),
    hitHistoryNext: new Uint8Array(capacity),
    enemyType: new Uint8Array(capacity),
    aiState: new Uint8Array(capacity),
    aiTicks: new Int32Array(capacity),
    aiCooldownTicks: new Int32Array(capacity),
    aiDirX: new Float64Array(capacity),
    aiDirY: new Float64Array(capacity),
    aiStrafeSign: new Int8Array(capacity),
    aiAttackDone: new Uint8Array(capacity),
    token: new Uint8Array(capacity),
    poise: new Float64Array(capacity),
    poiseRegenTicks: new Int32Array(capacity),
    eliteMod: new Uint8Array(capacity),
    aiPhase: new Uint8Array(capacity),
    aiPattern: new Uint8Array(capacity),
    burnStacks: new Uint8Array(capacity),
    burnTicks: new Int32Array(capacity),
    burnTickTimer: new Int32Array(capacity),
    chillStacks: new Uint8Array(capacity),
    chillTicks: new Int32Array(capacity),
    frozenTicks: new Int32Array(capacity),
    projDamage: new Float64Array(capacity),
    projLifeTicks: new Int32Array(capacity),
    projKnockback: new Float64Array(capacity),
    projPoise: new Float64Array(capacity),
    projPierce: new Uint8Array(capacity),
    projStatus: new Uint8Array(capacity),
    projStacks: new Uint8Array(capacity),
    projIsCast: new Uint8Array(capacity),
    projSwing: new Int32Array(capacity),
    hazFuseTotal: new Int32Array(capacity),
    wanderTicks: new Int32Array(capacity),
  };
}

const arrayLists = new WeakMap<Components, Array<{ [i: number]: number }>>();

/** Zeroes all component data of an entity so reused ids start clean. */
export function resetComponents(c: Components, eid: number): void {
  let arrays = arrayLists.get(c);
  if (!arrays) {
    // hitHistory is laid out per slot, not per entity; it is reset separately below.
    arrays = Object.entries(c)
      .filter(([key]) => key !== 'hitHistory')
      .map(([, array]) => array) as Array<{ [i: number]: number }>;
    arrayLists.set(c, arrays);
  }
  for (let i = 0; i < arrays.length; i++) (arrays[i] as { [i: number]: number })[eid] = 0;
  c.facingX[eid] = 1;
  // The generic loop above only clears index `eid`; the history spans several slots.
  c.hitHistory.fill(-1, eid * HIT_HISTORY, eid * HIT_HISTORY + HIT_HISTORY);
  c.hitHistoryNext[eid] = 0;
}
