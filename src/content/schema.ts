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

const attackTiming = {
  triggerRangePx: px,
  windupSec: z.number().min(0.4, 'GDD §4.6: telegraphs last at least 0.4 s'),
  activeSec: z.number().positive(),
  recoverySec: sec,
  cooldownMinSec: sec,
  cooldownMaxSec: sec,
  /** Fraction of the windup during which the attack still tracks the player. */
  trackFraction: z.number().min(0).max(1),
};
const attackBase = { ...attackTiming, damage: z.number().positive() };

export const enemyAttackSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('lunge'), ...attackBase, lungePx: px }),
  z.object({
    kind: z.literal('volley'),
    ...attackBase,
    projectileCount: z.number().int().min(1),
    /** Half the fan angle; 180 spreads the shots evenly all around. */
    spreadDeg: z.number().min(0).max(180),
    projectileSpeedPxPerSec: z.number().positive().max(260, 'GDD §4.6: enemy shots ≤ 260 px/s'),
    projectileRadiusPx: z.number().positive(),
    projectileLifeSec: z.number().positive(),
  }),
  z.object({ kind: z.literal('slam'), ...attackBase, slamRadiusPx: px }),
  z.object({
    kind: z.literal('mine'),
    ...attackBase,
    /** Mines land around the player's position at the end of the windup. */
    count: z.number().int().min(1),
    spreadPx: px,
    blastRadiusPx: z.number().positive(),
    /** Time from landing to detonation; the ground marker fills up meanwhile. */
    fuseSec: z.number().min(0.6, 'mines must be readable before they blow'),
  }),
  z.object({
    kind: z.literal('summon'),
    ...attackTiming,
    /** Enemy id to summon (resolved to a type index at runtime). */
    enemy: id,
    count: z.number().int().min(1),
    /** No summoning while this many enemies are already alive. */
    maxAlive: z.number().int().min(1),
  }),
  z.object({
    kind: z.literal('mend'),
    ...attackTiming,
    radiusPx: z.number().positive(),
    /** Healing per ally as a fraction of its max HP. */
    healFraction: z.number().positive().max(1),
  }),
]);

/** Boss phases (GDD §5.3): attack lists switch as HP drops; later phases may be faster. */
const bossPhaseSchema = z.object({
  /** The phase starts once HP falls to this fraction of max HP (first phase: 1). */
  hpBelow: z.number().min(0).max(1),
  attacks: z.array(enemyAttackSchema).min(1),
  cooldownScale: z.number().positive(),
  speedScale: z.number().positive(),
});

export const enemySchema = z.object({
  id,
  role: z.enum(['chaser', 'shooter', 'bruiser', 'swarm', 'support', 'trapper', 'boss']),
  maxHp: z.number().positive(),
  radiusPx: z.number().positive(),
  speedPxPerSec: z.number().nonnegative(),
  /** Hits absorbed before the enemy is staggered; 0 = every hit interrupts. */
  poise: z.number().nonnegative(),
  poiseRegenDelaySec: sec,
  staggerSec: sec,
  /** 0 = full knockback, 1 = immovable. */
  weight: z.number().min(0).max(1),
  /**
   * Shrugs off status effects: burn damage and freeze duration are scaled by (1 − resist).
   * Bosses need it, or stacked burn would melt them regardless of their health.
   */
  statusResist: z.number().min(0).max(0.9),
  keepDistanceMinPx: px,
  keepDistanceMaxPx: px,
  /** Attack token pool (GDD §4.6); bosses need none. */
  token: z.enum(['melee', 'ranged', 'none']),
  waveCost: z.number().positive(),
  /** Shards dropped on death (run currency, GDD §7.3). */
  shardValue: z.number().int().min(0),
  minWave: z.number().int().min(1),
  attack: enemyAttackSchema,
  /** Bosses only: phases replace `attack` with a pattern picked per attack. */
  boss: z.object({ phases: z.array(bossPhaseSchema).min(1) }).optional(),
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

export const roomTypeSchema = z.enum([
  'combat',
  'elite',
  'horde',
  'rest',
  'boss',
  'altar',
  'shop',
  'event',
]);

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
    shop: z.number(),
    event: z.number(),
  }),
  /** Earliest layer (0-based) where elites may appear. */
  eliteMinLayer: z.number().int().min(0),
  restMinLayer: z.number().int().min(0),
  altarMinLayer: z.number().int().min(0),
  shopMinLayer: z.number().int().min(0),
  maxShops: z.number().int().min(0),
  eventMinLayer: z.number().int().min(0),
  /** Enemy types (indices into ENEMIES) that may appear here. */
  enemyPool: z.array(z.number().int().min(0)),
  /** Enemy type (index into ENEMIES) fought at the boss node. */
  boss: z.number().int().min(0),
  /** Elites per elite room: the first is always the room's anchor (a bruiser). */
  elitesPerRoom: z.number().int().min(1),
  combatBudgetBase: z.number().positive(),
  /** Waves per combat room: fewer in the first layers, more from `combatWavesLateFromLayer`. */
  combatWavesEarly: z.number().int().min(1),
  combatWavesLate: z.number().int().min(1),
  combatWavesLateFromLayer: z.number().int().min(0),
  combatBudgetPerLayer: z.number().nonnegative(),
  eliteBudgetFactor: z.number().min(1),
  /** Extra enemies alongside the boss, as a wave budget (0 = boss alone). */
  bossBudget: z.number().nonnegative(),
  hordeDurationSec: z.number().positive(),
  hordeSpawnIntervalSec: z.number().positive(),
  restHealFraction: z.number().min(0).max(1),
});

// ── Boons (GDD §7.1) ──────────────────────────────────────────────────────

export const beingIdSchema = z.enum(['ignara', 'vaelis']);
export const boonSlotSchema = z.enum(['attack', 'special', 'cast', 'dash', 'passive']);
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
  'castDamage',
  // Relic stats (M2.3)
  'allDamage',
  'critChance',
  'critDamage',
  'moveSpeed',
  'staminaRegen',
  /** Flat max HP (applied by the run, not the room). */
  'maxHp',
  /** Multiplies all healing; negative values are curses. */
  'healing',
  'shardGain',
]);

/** A number, or the name of an entry in the boon's `values` (which scales with rarity). */
const valueRef = z.union([z.number(), z.string()]);

/** Player projectile looks; each kind has its own texture and feedback. */
export const projectileKindSchema = z.enum(['rift_shot', 'firebird']);

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
    /** Clears burn and frozen on the target first (duo combos), so it cannot re-trigger. */
    consumeStatuses: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('projectile'),
    /** Fired from the player along the current attack direction. */
    kind: projectileKindSchema,
    damage: valueRef,
    speedPxPerSec: z.number().positive(),
    radiusPx: z.number().positive(),
    rangePx: z.number().positive(),
    pierce: z.boolean(),
    status: statusIdSchema.optional(),
    stacks: valueRef.optional(),
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
  'onRoomClear',
  /** The last hit of the weapon combo starts. */
  'onComboFinisher',
  /** An enemy freezes solid. */
  'onFreeze',
  /** Burn is applied to an enemy. */
  'onBurnApplied',
]);
/** `ultimate` and `effect` damage never trigger onHit (no loops, no ult-charging the ult). */
export const hitSourceSchema = z.enum(['attack', 'special', 'cast', 'ultimate', 'effect']);

export const effectSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('trigger'),
    trigger: effectTriggerSchema,
    /** onHit only: which kind of hit fires it. Effect damage never retriggers onHit. */
    source: z.enum(['attack', 'special', 'cast', 'any']).optional(),
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
  /** Duo boons (GDD §7.1): the second being. Duos are never part of a normal offer pool. */
  partner: beingIdSchema.optional(),
  /** Duo prerequisites: the player must own at least one boon from every group. */
  requires: z.array(z.array(id).min(1)).optional(),
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

/** Every value reference in effects must name an existing value. */
function checkValueRefs(
  owner: string,
  values: Record<string, unknown>,
  effects: readonly EffectDef[],
): void {
  const check = (v: unknown) => {
    if (typeof v === 'string' && !(v in values)) {
      throw new Error(`${owner}: unknown value "${v}"`);
    }
  };
  for (const e of effects) {
    if (e.kind === 'stat') check(e.add);
    else {
      check(e.chance);
      check(e.condition?.targetBurnStacksAtLeast);
      const a = e.action as Record<string, unknown>;
      for (const key of ['stacks', 'radiusPx', 'damage', 'amount']) check(a[key]);
      // Projectile geometry is plain numbers; only damage and stacks may scale.
    }
  }
}

export function defineBoon(def: BoonDef): BoonDef {
  const boon = boonSchema.parse(def);
  checkValueRefs(`boon ${boon.id}`, boon.values, boon.effects);
  if ((boon.partner === undefined) !== (boon.requires === undefined)) {
    throw new Error(`boon ${boon.id}: duo boons need both partner and requires`);
  }
  if (boon.partner === boon.being) throw new Error(`boon ${boon.id}: duo partner equals being`);
  return boon;
}

// ── Evolutions (GDD §4.9) ─────────────────────────────────────────────────

export const evolutionSchema = z.object({
  id,
  weapon: id,
  /** Every listed boon and relic must be owned. */
  requires: z.object({ boons: z.array(id), relics: z.array(id) }),
  /** Evolutions have fixed values (no rarity), so effects use plain numbers. */
  effects: z.array(effectSchema).min(1),
});

export type EvolutionDef = z.infer<typeof evolutionSchema>;

export function defineEvolution(def: EvolutionDef): EvolutionDef {
  const evo = evolutionSchema.parse(def);
  checkValueRefs(`evolution ${evo.id}`, {}, evo.effects);
  return evo;
}

// ── Cast and ultimate (GDD §4.1) ──────────────────────────────────────────

export const castSchema = z.object({
  id,
  damage: z.number().positive(),
  speedPxPerSec: z.number().positive(),
  radiusPx: z.number().positive(),
  rangePx: z.number().positive(),
  charges: z.number().int().min(1),
  /** Time to regain one charge; charges come back one after another. */
  rechargeSec: z.number().positive(),
  windupSec: sec,
  recoverySec: sec,
  knockback: z.number().nonnegative(),
  poiseDamage: z.number().nonnegative(),
  /** Aim assist reaches much further than the blade's. */
  assistRangePx: px,
  moveFactor: z.number().min(0).max(1),
});

const burstVariantSchema = z.object({
  radiusPx: z.number().positive(),
  damage: z.number().nonnegative(),
  status: statusIdSchema.optional(),
  stacks: z.number().int().min(0),
  freeze: z.boolean(),
  knockback: z.number().nonnegative(),
});

export const ultimateSchema = z.object({
  id,
  /** Damage dealt (any source except the ultimate) that fills the meter once. */
  chargeDamageDealt: z.number().positive(),
  /** Damage taken that fills the meter once; getting hit builds it much faster. */
  chargeDamageTaken: z.number().positive(),
  windupSec: sec,
  recoverySec: sec,
  /** Invulnerable from activation until this long after (covers windup and blast). */
  invulnSec: sec,
  /** The blast depends on the dominant being; `none` before any boon. */
  variants: z.object({
    none: burstVariantSchema,
    ignara: burstVariantSchema,
    vaelis: burstVariantSchema,
  }),
});

export type CastDef = z.infer<typeof castSchema>;
export type UltimateDef = z.infer<typeof ultimateSchema>;
export type BurstVariant = z.infer<typeof burstVariantSchema>;
export type ProjectileKind = z.infer<typeof projectileKindSchema>;

export function defineCast(def: CastDef): CastDef {
  return castSchema.parse(def);
}

export function defineUltimate(def: UltimateDef): UltimateDef {
  return ultimateSchema.parse(def);
}

// ── Relics (GDD §7.2) ─────────────────────────────────────────────────────

export const relicRaritySchema = z.enum(['common', 'rare', 'epic', 'curse']);

const relicValueSchema = z.object({
  base: z.number(),
  /** Added per extra stack (linear stacking). */
  perStack: z.number(),
  /** Chance-style stacking (Risk of Rain): 1 − 1/(1 + base·stacks); never reaches 100 %. */
  hyperbolic: z.boolean().optional(),
  int: z.boolean().optional(),
  percent: z.boolean().optional(),
});

export const relicSchema = z.object({
  id,
  rarity: relicRaritySchema,
  tags: z.array(z.string()),
  /** Shop price in shards before the shop's rarity markup. */
  price: z.number().int().positive(),
  /** Rift dust to unlock it at Nix (GDD §2.3); without it the relic is in the pool from the start. */
  unlockCost: z.number().int().positive().optional(),
  values: z.record(z.string(), relicValueSchema),
  effects: z.array(effectSchema).min(1),
});

export type RelicRarity = z.infer<typeof relicRaritySchema>;
export type RelicDef = z.infer<typeof relicSchema>;

export function defineRelic(def: RelicDef): RelicDef {
  const relic = relicSchema.parse(def);
  checkValueRefs(`relic ${relic.id}`, relic.values, relic.effects);
  return relic;
}

// ── Events (GDD §6.2) ─────────────────────────────────────────────────────

const eventOutcomeSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('heal'), fraction: z.number().min(0).max(1) }),
  z.object({ type: z.literal('damage'), amount: z.number().positive() }),
  z.object({ type: z.literal('shards'), amount: z.number().int() }),
  z.object({ type: z.literal('relic'), pool: z.enum(['common', 'rare', 'epic', 'curse']) }),
  z.object({ type: z.literal('maxHp'), amount: z.number().int() }),
]);

export const eventSchema = z.object({
  id,
  options: z
    .array(
      z.object({
        id,
        outcomes: z.array(eventOutcomeSchema),
        /** Option is disabled unless the player can pay. */
        requiresShards: z.number().int().min(0).optional(),
        requiresHpAbove: z.number().int().min(0).optional(),
      }),
    )
    .min(1)
    .max(4),
});

export type EventDef = z.infer<typeof eventSchema>;
export type EventOutcome = z.infer<typeof eventOutcomeSchema>;

export function defineEvent(def: EventDef): EventDef {
  return eventSchema.parse(def);
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
  const enemy = enemySchema.parse(def);
  const phases = enemy.boss?.phases ?? [];
  for (let i = 1; i < phases.length; i++) {
    if (
      (phases[i] as { hpBelow: number }).hpBelow >= (phases[i - 1] as { hpBelow: number }).hpBelow
    )
      throw new Error(`enemy ${enemy.id}: boss phases must have falling hpBelow`);
  }
  return enemy;
}

// ── Elite modifiers (GDD §5.1) ────────────────────────────────────────────

export const eliteSchema = z.object({
  id,
  hpMultiplier: z.number().min(1),
  /** Elites are a bit bigger so they read at a glance. */
  radiusMultiplier: z.number().min(1),
  speedMultiplier: z.number().positive(),
  cooldownMultiplier: z.number().positive(),
  /** Frontal shield: hits from within this cone (total angle) take reduced damage. */
  shieldArcDeg: z.number().min(0).max(360),
  shieldDamageFactor: z.number().min(0).max(1),
  /** Volatile: on death a delayed blast is left behind (0 radius = none). */
  deathBlastRadiusPx: px,
  deathBlastDamage: z.number().nonnegative(),
  deathBlastFuseSec: sec,
  color: z.number().int().nonnegative(),
});

export type EliteDef = z.infer<typeof eliteSchema>;

export function defineElite(def: EliteDef): EliteDef {
  return eliteSchema.parse(def);
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

// ── Meta progression (GDD §8) ─────────────────────────────────────────────

const treeEffectSchema = z.discriminatedUnion('kind', [
  /** Adds `perRank` to a build stat for the whole run (e.g. maxHp, allDamage). */
  z.object({ kind: z.literal('stat'), stat: statIdSchema, perRank: z.number() }),
  z.object({ kind: z.literal('startShards'), perRank: z.number().int().positive() }),
  z.object({ kind: z.literal('roomHeal'), perRank: z.number().positive() }),
  /** Survive a lethal hit once per run; the heal fraction is per rank. */
  z.object({ kind: z.literal('lastSpark'), healPerRank: z.array(z.number().min(0).max(1)).min(1) }),
  z.object({ kind: z.literal('boonReroll'), perRank: z.number().int().positive() }),
  z.object({ kind: z.literal('staminaSegment'), perRank: z.number().int().positive() }),
]);

export const treeNodeSchema = z.object({
  id,
  /** Cost of each rank, in order; the number of entries is the max rank. */
  ranks: z
    .array(z.object({ ember: z.number().int().min(0), dust: z.number().int().min(0) }))
    .min(1),
  effect: treeEffectSchema,
  /** Another node that needs at least one rank first. */
  requires: id.optional(),
});

export type TreeNodeDef = z.infer<typeof treeNodeSchema>;
export type TreeEffect = z.infer<typeof treeEffectSchema>;

export function defineTreeNode(def: TreeNodeDef): TreeNodeDef {
  const node = treeNodeSchema.parse(def);
  if (node.effect.kind === 'lastSpark' && node.effect.healPerRank.length !== node.ranks.length) {
    throw new Error(`tree node ${node.id}: one heal value per rank`);
  }
  return node;
}

export const speakerSchema = z.enum(['maren', 'nix']);

/** Hades-style dialogue (GDD §2.6): the best-matching unseen line wins, fillers repeat. */
export const dialogueLineSchema = z.object({
  id,
  speaker: speakerSchema,
  /** Higher wins. Story beats > context reactions > fillers. */
  priority: z.number().int(),
  /** Story and context lines play once; fillers (false) may repeat. */
  once: z.boolean(),
  when: z
    .object({
      minRuns: z.number().int().min(0).optional(),
      maxRuns: z.number().int().min(0).optional(),
      minWins: z.number().int().min(0).optional(),
      lastResult: z.enum(['won', 'lost']).optional(),
      /** Enemy id that ended the last run. */
      killedBy: id.optional(),
      lastDominant: z.enum(['ignara', 'vaelis']).optional(),
      /** The last run reached the boss node. */
      reachedBoss: z.boolean().optional(),
      hasFlag: id.optional(),
      lacksFlag: id.optional(),
    })
    .optional(),
  setsFlag: id.optional(),
});

export type DialogueLineDef = z.infer<typeof dialogueLineSchema>;
export type Speaker = z.infer<typeof speakerSchema>;

export function defineDialogue(lines: DialogueLineDef[]): DialogueLineDef[] {
  return lines.map((l) => dialogueLineSchema.parse(l));
}
