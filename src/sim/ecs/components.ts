import { STATUS_COUNT } from '../../content/statuses';

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
  /** Player spell area (meteor impact, poison cloud): pulses its hit, life in projLifeTicks. */
  Zone: 1 << 11,
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
  Zone: 8,
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
  // Status effects: STATUS_COUNT slots per entity, see statusSlot()
  statusStacks: Uint8Array;
  statusTicks: Int32Array;
  /** Ticks until the next damage-over-time tick. */
  statusTimer: Int32Array;
  /** Fractional windup progress carried between ticks while blinded. */
  windupCarry: Float64Array;
  frozenTicks: Int32Array;
  // Twin champions (ROADMAP M3.5)
  /** Linked partner entity + 1 (0 = none). */
  linkEid: Int32Array;
  /** Ticks until the fallen partner rises again (0 = no revive pending). */
  reviveTicks: Int32Array;
  /** Enemy type + 1 that will be revived. */
  reviveType: Uint8Array;
  // Player spell zones (hit data in projDamage/projStatus/projStacks/projKnockback)
  zonePulseTicks: Int32Array;
  zoneTimer: Int32Array;
  /** Spell index the zone belongs to (colour, feedback). */
  zoneSpell: Uint8Array;
  // Projectile
  projDamage: Float64Array;
  projLifeTicks: Int32Array;
  // Player projectile extras
  projKnockback: Float64Array;
  projPoise: Float64Array;
  /** 1 = flies through enemies, hitting each once. */
  projPierce: Uint8Array;
  /** Status index + 1 applied on hit (0 = none), with projStacks stacks. */
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
    statusStacks: new Uint8Array(capacity * STATUS_COUNT),
    statusTicks: new Int32Array(capacity * STATUS_COUNT),
    statusTimer: new Int32Array(capacity * STATUS_COUNT),
    windupCarry: new Float64Array(capacity),
    frozenTicks: new Int32Array(capacity),
    linkEid: new Int32Array(capacity),
    reviveTicks: new Int32Array(capacity),
    reviveType: new Uint8Array(capacity),
    zonePulseTicks: new Int32Array(capacity),
    zoneTimer: new Int32Array(capacity),
    zoneSpell: new Uint8Array(capacity),
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
    // These are laid out with several slots per entity; they are reset separately below.
    arrays = Object.entries(c)
      .filter(([key]) => !MULTI_SLOT_KEYS.includes(key))
      .map(([, array]) => array) as Array<{ [i: number]: number }>;
    arrayLists.set(c, arrays);
  }
  for (let i = 0; i < arrays.length; i++) (arrays[i] as { [i: number]: number })[eid] = 0;
  c.facingX[eid] = 1;
  // The generic loop above only clears index `eid`; the history spans several slots.
  c.hitHistory.fill(-1, eid * HIT_HISTORY, eid * HIT_HISTORY + HIT_HISTORY);
  c.hitHistoryNext[eid] = 0;
  const first = eid * STATUS_COUNT;
  c.statusStacks.fill(0, first, first + STATUS_COUNT);
  c.statusTicks.fill(0, first, first + STATUS_COUNT);
  c.statusTimer.fill(0, first, first + STATUS_COUNT);
}

const MULTI_SLOT_KEYS = ['hitHistory', 'statusStacks', 'statusTicks', 'statusTimer'];

/** Index into statusStacks/statusTicks/statusTimer for one status of one entity. */
export function statusSlot(eid: number, status: number): number {
  return eid * STATUS_COUNT + status;
}

export function stacksOf(c: Components, eid: number, status: number): number {
  return c.statusStacks[eid * STATUS_COUNT + status] as number;
}
