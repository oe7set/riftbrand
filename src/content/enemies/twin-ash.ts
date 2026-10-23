import { defineEnemy, type EnemyAttackDef } from '../schema';

const slam = (radius: number, windupSec: number, damage: number): EnemyAttackDef => ({
  kind: 'slam',
  triggerRangePx: radius + 30,
  windupSec,
  activeSec: 0.1,
  recoverySec: 0.9,
  cooldownMinSec: 0.6,
  cooldownMaxSec: 1,
  damage,
  trackFraction: 0,
  slamRadiusPx: radius,
});

const charge = (lungePx: number, windupSec: number): EnemyAttackDef => ({
  kind: 'lunge',
  triggerRangePx: lungePx + 80,
  windupSec,
  activeSec: 0.3,
  recoverySec: 0.8,
  cooldownMinSec: 0.6,
  cooldownMaxSec: 1,
  damage: 18,
  trackFraction: 0.7,
  lungePx,
});

/**
 * Asche (ROADMAP M3.5), the heavy half of the twins: slow ground slams, and a charge once the
 * pair is hurt. Next to Funke both take less damage; split them up.
 */
export const TWIN_ASH = defineEnemy({
  id: 'twin_ash',
  role: 'champion',
  maxHp: 1100,
  radiusPx: 24,
  speedPxPerSec: 90,
  poise: 70,
  poiseRegenDelaySec: 2.5,
  staggerSec: 1,
  weight: 0.8,
  statusResist: 0.3,
  keepDistanceMinPx: 60,
  keepDistanceMaxPx: 120,
  token: 'none',
  waveCost: 8,
  shardValue: 20,
  minWave: 99,
  attack: slam(120, 0.85, 20),
  boss: {
    phases: [
      { hpBelow: 1, cooldownScale: 1, speedScale: 1, attacks: [slam(120, 0.85, 20)] },
      {
        hpBelow: 0.5,
        cooldownScale: 0.9,
        speedScale: 1.1,
        attacks: [slam(130, 0.8, 20), charge(300, 0.7)],
      },
      {
        // Enraged: the partner fell.
        hpBelow: 0,
        cooldownScale: 0.7,
        speedScale: 1.3,
        attacks: [slam(140, 0.75, 22), charge(340, 0.65)],
      },
    ],
  },
  link: {
    partner: 'twin_spark',
    rangePx: 200,
    damageReduction: 0.4,
    reviveSec: 8,
    reviveHpFraction: 0.3,
  },
  visual: { color: 0x9a8a80, sides: 6, rotationDeg: 0 },
});
