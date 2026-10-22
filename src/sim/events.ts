/**
 * Things that happened during a tick, for feedback (VFX, sound, haptics, slow-mo).
 * The view drains the buffer once per rendered frame; events never feed back into the sim.
 */
export const Ev = {
  /** Player damaged an enemy. amount = damage, flags = crit/heavy/killed. */
  Hit: 1,
  Kill: 2,
  /** Player swing started. value = combo index (0-based), dir = swing direction. */
  Swing: 3,
  Special: 4,
  Dash: 5,
  PerfectDash: 6,
  /** Enemy began a telegraphed attack. value = enemy type. */
  Telegraph: 7,
  /** Enemy attack resolved (lunge start, volley fired, slam landed). value = enemy type. */
  EnemyAttack: 8,
  PlayerHit: 9,
  StaminaEmpty: 10,
  /** Spawn portal opened; enemy follows after `amount` seconds. value = enemy type. */
  SpawnWarn: 11,
  Spawn: 12,
  WaveStart: 13,
  /** Last enemy of a wave died. value = wave number. */
  WaveCleared: 14,
  PlayerDied: 15,
  ProjectileExpired: 16,
  EnemyStagger: 17,
  /** Encounter finished; the exit portal at (x, y) is open. */
  RoomCleared: 18,
  /** Player stepped into the open exit. */
  ExitReached: 19,
  /** value = status (StatusCode), amount = stacks now. */
  StatusApplied: 20,
  Frozen: 21,
  /** Effect area burst; amount = radius, value = StatusCode (0 = none). */
  Nova: 22,
  /** Player healed; amount = HP. */
  Heal: 23,
  /** Shards picked up from a kill; amount = shards. */
  Shards: 24,
} as const;

/** Numeric status codes for event payloads. */
export const StatusCode = {
  None: 0,
  Burn: 1,
  Chill: 2,
  Freeze: 3,
} as const;

export type EventType = (typeof Ev)[keyof typeof Ev];

export const EvFlag = {
  Crit: 1 << 0,
  Heavy: 1 << 1,
  Killed: 1 << 2,
  /** Damage over time (burn tick): no hitstop, shake or stagger. */
  Dot: 1 << 3,
} as const;

export interface SimEvent {
  type: EventType;
  eid: number;
  x: number;
  y: number;
  dirX: number;
  dirY: number;
  amount: number;
  value: number;
  flags: number;
}

const CAPACITY = 1024;

export interface EventBuffer {
  readonly items: SimEvent[];
  count: number;
  dropped: number;
}

export function createEventBuffer(): EventBuffer {
  const items: SimEvent[] = [];
  for (let i = 0; i < CAPACITY; i++) {
    items.push({
      type: Ev.Hit,
      eid: -1,
      x: 0,
      y: 0,
      dirX: 0,
      dirY: 0,
      amount: 0,
      value: 0,
      flags: 0,
    });
  }
  return { items, count: 0, dropped: 0 };
}

/** Returns a pooled, zeroed event to fill in, or null when the buffer is full. */
export function pushEvent(
  buffer: EventBuffer,
  type: EventType,
  x: number,
  y: number,
): SimEvent | null {
  if (buffer.count >= buffer.items.length) {
    buffer.dropped++;
    return null;
  }
  const e = buffer.items[buffer.count++] as SimEvent;
  e.type = type;
  e.eid = -1;
  e.x = x;
  e.y = y;
  e.dirX = 0;
  e.dirY = 0;
  e.amount = 0;
  e.value = 0;
  e.flags = 0;
  return e;
}

export function clearEvents(buffer: EventBuffer): void {
  buffer.count = 0;
}
