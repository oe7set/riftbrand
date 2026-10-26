import { defineEnemy, type EnemyAttackDef } from '../../schema';

const thrust = (lungePx: number, windupSec: number, damage: number): EnemyAttackDef => ({
  kind: 'lunge',
  triggerRangePx: lungePx + 60,
  windupSec,
  activeSec: 0.16,
  recoverySec: 0.5,
  cooldownMinSec: 0.4,
  cooldownMaxSec: 0.8,
  damage,
  trackFraction: 0.6,
  lungePx,
});

/** Her mirror parry: strike the glass from the front and it strikes back. */
const mirrorGuard: EnemyAttackDef = {
  kind: 'guard',
  triggerRangePx: 210,
  windupSec: 0.85,
  activeSec: 0.05,
  recoverySec: 0.4,
  cooldownMinSec: 0.4,
  cooldownMaxSec: 0.8,
  trackFraction: 1,
  counterDamage: 17,
  counterRangePx: 125,
  frontArcDeg: 150,
  brokenStaggerSec: 1.2,
};

const shardFan: EnemyAttackDef = {
  kind: 'volley',
  triggerRangePx: 520,
  windupSec: 0.6,
  activeSec: 0.1,
  recoverySec: 0.6,
  cooldownMinSec: 0.6,
  cooldownMaxSec: 1,
  damage: 10,
  trackFraction: 0.8,
  projectileCount: 7,
  spreadDeg: 40,
  projectileSpeedPxPerSec: 220,
  projectileRadiusPx: 8,
  projectileLifeSec: 2.6,
};

/** Her reflections step out of the glass and fight beside her. */
const reflections: EnemyAttackDef = {
  kind: 'summon',
  triggerRangePx: 1400,
  windupSec: 0.9,
  activeSec: 0.1,
  recoverySec: 0.6,
  cooldownMinSec: 1.2,
  cooldownMaxSec: 1.8,
  trackFraction: 0,
  enemy: 'mirror_knight',
  count: 2,
  maxAlive: 2,
};

/**
 * Spiegelfechterin (ROADMAP M6.1): the first champion of the Glass Sea. Faster than the Ember
 * Duelist and fond of her parry; phase 2 throws a fan of shards, phase 3 calls her reflections.
 */
export const GLASS_FENCER = defineEnemy({
  id: 'glass_fencer',
  role: 'champion',
  maxHp: 1900,
  radiusPx: 19,
  speedPxPerSec: 160,
  poise: 60,
  poiseRegenDelaySec: 2,
  staggerSec: 0.9,
  weight: 0.6,
  statusResist: 0.3,
  keepDistanceMinPx: 70,
  keepDistanceMaxPx: 160,
  token: 'none',
  waveCost: 12,
  shardValue: 42,
  minWave: 99,
  attack: thrust(140, 0.45, 14),
  boss: {
    phases: [
      {
        hpBelow: 1,
        cooldownScale: 1,
        speedScale: 1,
        attacks: [thrust(140, 0.45, 14), thrust(210, 0.6, 18), mirrorGuard],
      },
      {
        hpBelow: 0.66,
        cooldownScale: 0.9,
        speedScale: 1.1,
        attacks: [thrust(150, 0.42, 15), mirrorGuard, shardFan, mirrorGuard],
      },
      {
        hpBelow: 0.33,
        cooldownScale: 0.75,
        speedScale: 1.2,
        attacks: [thrust(240, 0.55, 18), shardFan, mirrorGuard, reflections],
      },
    ],
  },
  visual: { color: 0xd8c4ff, sides: 5, rotationDeg: -90 },
});
