import { z } from 'zod';

const sec = z.number().nonnegative();
const px = z.number().nonnegative();
const id = z.string().regex(/^[a-z][a-z0-9_]*$/, 'content ids are snake_case');

export const hitstopLevel = z.enum(['none', 'light', 'heavy']);

export const meleeHitSchema = z.object({
  damage: z.number().positive(),
  reachPx: px,
  arcDeg: z.number().min(1).max(360),
  windupSec: sec,
  activeSec: z.number().positive(),
  recoverySec: sec,
  /** Forward step during the active phase. */
  lungePx: px,
  knockback: z.number().nonnegative(),
  poiseDamage: z.number().nonnegative(),
  hitstop: hitstopLevel,
});

export const weaponSchema = z.object({
  id,
  combo: z.array(meleeHitSchema).min(1).max(8),
  comboWindowSec: sec,
  /** Time into recovery after which the next combo hit may start. */
  recoveryCancelSec: sec,
  /** Movement speed multiplier while attacking. */
  attackMoveFactor: z.number().min(0).max(1),
  /** Max distance at which aim assist snaps to an enemy. */
  assistRangePx: px,
  special: z.object({
    id,
    damage: z.number().positive(),
    radiusPx: px,
    windupSec: sec,
    activeSec: z.number().positive(),
    recoverySec: sec,
    staminaCost: z.number().nonnegative(),
    knockback: z.number().nonnegative(),
    poiseDamage: z.number().nonnegative(),
    moveFactor: z.number().min(0).max(1),
  }),
});

const attackBase = {
  triggerRangePx: px,
  windupSec: z.number().min(0.4, 'GDD §4.6: telegraphs last at least 0.4 s'),
  activeSec: z.number().positive(),
  recoverySec: sec,
  cooldownMinSec: sec,
  cooldownMaxSec: sec,
  damage: z.number().positive(),
  /** Fraction of the windup during which the attack still tracks the player. */
  trackFraction: z.number().min(0).max(1),
};

export const enemyAttackSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('lunge'), ...attackBase, lungePx: px }),
  z.object({
    kind: z.literal('volley'),
    ...attackBase,
    projectileCount: z.number().int().min(1),
    spreadDeg: z.number().min(0),
    projectileSpeedPxPerSec: z.number().positive().max(260, 'GDD §4.6: enemy shots ≤ 260 px/s'),
    projectileRadiusPx: z.number().positive(),
    projectileLifeSec: z.number().positive(),
  }),
  z.object({ kind: z.literal('slam'), ...attackBase, slamRadiusPx: px }),
]);

export const enemySchema = z.object({
  id,
  role: z.enum(['chaser', 'shooter', 'bruiser', 'swarm', 'support', 'trapper']),
  maxHp: z.number().positive(),
  radiusPx: z.number().positive(),
  speedPxPerSec: z.number().nonnegative(),
  /** Hits absorbed before the enemy is staggered; 0 = every hit interrupts. */
  poise: z.number().nonnegative(),
  poiseRegenDelaySec: sec,
  staggerSec: sec,
  /** 0 = full knockback, 1 = immovable. */
  weight: z.number().min(0).max(1),
  keepDistanceMinPx: px,
  keepDistanceMaxPx: px,
  token: z.enum(['melee', 'ranged']),
  waveCost: z.number().positive(),
  minWave: z.number().int().min(1),
  attack: enemyAttackSchema,
  visual: z.object({
    color: z.number().int().nonnegative(),
    /** Polygon side count; 0 = circle. */
    sides: z.number().int().min(0),
    /** Polygon rotation in degrees. */
    rotationDeg: z.number(),
  }),
});

const obstacleSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('rect'),
    x: px,
    y: px,
    w: z.number().positive(),
    h: z.number().positive(),
  }),
  z.object({ kind: z.literal('circle'), x: px, y: px, r: z.number().positive() }),
]);

const point = z.object({ x: px, y: px });

export const roomTypeSchema = z.enum(['combat', 'elite', 'horde', 'rest', 'boss', 'altar']);

export const roomTemplateSchema = z.object({
  id,
  widthPx: z.number().min(400),
  heightPx: z.number().min(400),
  /** Room types this layout may be used for. */
  types: z.array(roomTypeSchema).min(1),
  obstacles: z.array(obstacleSchema),
  playerStart: point,
  exit: point,
  /** Preferred spawn spots; empty = anywhere free. */
  spawnPoints: z.array(point),
});

export const biomeSchema = z.object({
  id,
  /** Map layers including the boss layer (GDD §6.1). */
  layers: z.number().int().min(4).max(16),
  minNodesPerLayer: z.number().int().min(1),
  maxNodesPerLayer: z.number().int().min(1),
  /** Relative weights for mid-map node types. */
  typeWeights: z.object({
    combat: z.number(),
    elite: z.number(),
    horde: z.number(),
    rest: z.number(),
    altar: z.number(),
  }),
  /** Earliest layer (0-based) where elites may appear. */
  eliteMinLayer: z.number().int().min(0),
  restMinLayer: z.number().int().min(0),
  altarMinLayer: z.number().int().min(0),
  /** Enemy types (indices into ENEMIES) that may appear here. */
  enemyPool: z.array(z.number().int().min(0)),
  combatBudgetBase: z.number().positive(),
  combatBudgetPerLayer: z.number().nonnegative(),
  eliteBudgetFactor: z.number().min(1),
  bossBudget: z.number().positive(),
  hordeDurationSec: z.number().positive(),
  hordeSpawnIntervalSec: z.number().positive(),
  restHealFraction: z.number().min(0).max(1),
});

// ── Boons (GDD §7.1) ──────────────────────────────────────────────────────

export const beingIdSchema = z.enum(['ignara', 'vaelis']);
export const boonSlotSchema = z.enum(['attack', 'special', 'dash', 'passive']);
export const raritySchema = z.enum(['common', 'rare', 'epic', 'heroic']);
export const statusIdSchema = z.enum(['burn', 'chill']);
/** Additive stat bonuses; +0.15 means +15 %. */
export const statIdSchema = z.enum([
  'attackDamage',
  'specialDamage',
  'damageVsBurning',
  'damageVsFrozen',
  'damageVsChilledPerStack',
  'burnDamage',
  'freezeDuration',
]);

/** A number, or the name of an entry in the boon's `values` (which scales with rarity). */
const valueRef = z.union([z.number(), z.string()]);

const effectActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('applyStatus'), status: statusIdSchema, stacks: valueRef }),
  z.object({
    type: z.literal('nova'),
    /** Centre on the player or on the enemy that triggered the effect. */
    at: z.enum(['player', 'target']),
    radiusPx: valueRef,
    damage: valueRef,
    status: statusIdSchema.optional(),
    stacks: valueRef.optional(),
    freeze: z.boolean().optional(),
  }),
  z.object({ type: z.literal('heal'), amount: valueRef }),
  z.object({ type: z.literal('refundStamina'), amount: valueRef }),
]);

const effectConditionSchema = z.object({
  targetBurnStacksAtLeast: valueRef.optional(),
  targetFrozen: z.boolean().optional(),
});

export const effectTriggerSchema = z.enum([
  'onHit',
  'onKill',
  'onDash',
  'onPerfectDash',
  'onDamaged',
]);
export const hitSourceSchema = z.enum(['attack', 'special', 'effect']);

export const effectSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('trigger'),
    trigger: effectTriggerSchema,
    /** onHit only: which kind of hit fires it. Effect damage never retriggers onHit. */
    source: z.enum(['attack', 'special', 'any']).optional(),
    chance: valueRef.optional(),
    condition: effectConditionSchema.optional(),
    action: effectActionSchema,
  }),
  z.object({ kind: z.literal('stat'), stat: statIdSchema, add: valueRef }),
]);

const boonValueSchema = z.object({
  base: z.number(),
  /** Added per rarity step above common. */
  step: z.number(),
  int: z.boolean().optional(),
  /** Shown as a percentage in descriptions (0.15 → "15%"). */
  percent: z.boolean().optional(),
});

export const boonSchema = z.object({
  id,
  being: beingIdSchema,
  slot: boonSlotSchema,
  tags: z.array(z.string()),
  values: z.record(z.string(), boonValueSchema),
  effects: z.array(effectSchema).min(1),
});

export type BeingId = z.infer<typeof beingIdSchema>;
export type BoonSlot = z.infer<typeof boonSlotSchema>;
export type Rarity = z.infer<typeof raritySchema>;
export type StatusId = z.infer<typeof statusIdSchema>;
export type StatId = z.infer<typeof statIdSchema>;
export type EffectDef = z.infer<typeof effectSchema>;
export type EffectAction = z.infer<typeof effectActionSchema>;
export type EffectTrigger = z.infer<typeof effectTriggerSchema>;
export type HitSource = z.infer<typeof hitSourceSchema>;
export type BoonDef = z.infer<typeof boonSchema>;

/** Validates the schema and that every value reference names an existing value. */
export function defineBoon(def: BoonDef): BoonDef {
  const boon = boonSchema.parse(def);
  const check = (v: unknown) => {
    if (typeof v === 'string' && !(v in boon.values)) {
      throw new Error(`boon ${boon.id}: unknown value "${v}"`);
    }
  };
  for (const e of boon.effects) {
    if (e.kind === 'stat') check(e.add);
    else {
      check(e.chance);
      check(e.condition?.targetBurnStacksAtLeast);
      const a = e.action as Record<string, unknown>;
      for (const key of ['stacks', 'radiusPx', 'damage', 'amount']) check(a[key]);
    }
  }
  return boon;
}

export type MeleeHitDef = z.infer<typeof meleeHitSchema>;
export type RoomTemplateDef = z.infer<typeof roomTemplateSchema>;
export type RoomType = z.infer<typeof roomTypeSchema>;
export type BiomeDef = z.infer<typeof biomeSchema>;
export type ObstacleDef = z.infer<typeof obstacleSchema>;
export type WeaponDef = z.infer<typeof weaponSchema>;
export type EnemyDef = z.infer<typeof enemySchema>;
export type EnemyAttackDef = z.infer<typeof enemyAttackSchema>;
export type HitstopLevel = z.infer<typeof hitstopLevel>;

/** Validates at definition time so broken content fails fast in tests and dev. */
export function defineWeapon(def: WeaponDef): WeaponDef {
  return weaponSchema.parse(def);
}

export function defineEnemy(def: EnemyDef): EnemyDef {
  return enemySchema.parse(def);
}

export function defineRoom(def: RoomTemplateDef): RoomTemplateDef {
  const room = roomTemplateSchema.parse(def);
  const inside = (p: { x: number; y: number }) =>
    p.x > 0 && p.y > 0 && p.x < room.widthPx && p.y < room.heightPx;
  if (!inside(room.playerStart) || !inside(room.exit)) {
    throw new Error(`room ${room.id}: start and exit must lie inside the room`);
  }
  return room;
}

export function defineBiome(def: BiomeDef): BiomeDef {
  return biomeSchema.parse(def);
}
