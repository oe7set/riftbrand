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

export type MeleeHitDef = z.infer<typeof meleeHitSchema>;
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
