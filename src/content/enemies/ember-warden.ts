import { defineEnemy, type EnemyAttackDef } from '../schema';

/** Pattern building blocks shared between phases; later phases tweak them. */
const slam = (radius: number, windupSec: number): EnemyAttackDef => ({
  kind: 'slam',
  triggerRangePx: radius + 40,
  windupSec,
  activeSec: 0.1,
  recoverySec: 1.2,
  cooldownMinSec: 0.6,
  cooldownMaxSec: 1.1,
  damage: 28,
  trackFraction: 0,
  slamRadiusPx: radius,
});

/** The charge rewards a perfect dash: long, readable lane, fast commit (GDD §5.3). */
const charge = (lungePx: number, windupSec: number): EnemyAttackDef => ({
  kind: 'lunge',
  triggerRangePx: 650,
  windupSec,
  activeSec: 0.35,
  recoverySec: 1.0,
  cooldownMinSec: 0.6,
  cooldownMaxSec: 1.1,
  damage: 26,
  trackFraction: 0.75,
  lungePx,
});

const volley = (count: number, spreadDeg: number, speed: number): EnemyAttackDef => ({
  kind: 'volley',
  triggerRangePx: 1400,
  windupSec: 0.75,
  activeSec: 0.1,
  recoverySec: 0.7,
  cooldownMinSec: 0.6,
  cooldownMaxSec: 1.1,
  damage: 12,
  trackFraction: spreadDeg >= 180 ? 0 : 0.8,
  projectileCount: count,
  spreadDeg,
  projectileSpeedPxPerSec: speed,
  projectileRadiusPx: 9,
  projectileLifeSec: 4,
});

const mines = (count: number, spreadPx: number): EnemyAttackDef => ({
  kind: 'mine',
  triggerRangePx: 1400,
  windupSec: 0.8,
  activeSec: 0.1,
  recoverySec: 0.8,
  cooldownMinSec: 0.6,
  cooldownMaxSec: 1.1,
  damage: 18,
  trackFraction: 0.8,
  count,
  spreadPx,
  blastRadiusPx: 70,
  fuseSec: 1.3,
});

const PHASE_TWO: EnemyAttackDef[] = [
  slam(210, 0.9),
  charge(420, 0.65),
  volley(16, 180, 170),
  volley(9, 40, 210),
  mines(5, 150),
  {
    kind: 'summon',
    triggerRangePx: 1400,
    windupSec: 0.8,
    activeSec: 0.1,
    recoverySec: 0.6,
    cooldownMinSec: 0.8,
    cooldownMaxSec: 1.3,
    trackFraction: 0,
    enemy: 'ember_mite',
    count: 3,
    maxAlive: 6,
  },
];

/**
 * Der Glutwächter (GDD §2.5): the Aschefelder boss. A slow colossus with area attacks that
 * teaches dodging. Phase 2 at 55 % adds a radial burst, more mines and summoned mites; below
 * 30 % it enrages (faster patterns, shorter pauses).
 */
export const EMBER_WARDEN = defineEnemy({
  id: 'ember_warden',
  role: 'boss',
  maxHp: 1100,
  radiusPx: 42,
  speedPxPerSec: 60,
  poise: 160,
  poiseRegenDelaySec: 3,
  staggerSec: 1.4,
  weight: 0.95,
  keepDistanceMinPx: 90,
  keepDistanceMaxPx: 170,
  token: 'none',
  waveCost: 20,
  shardValue: 60,
  // Never part of random waves; only the boss node spawns it.
  minWave: 99,
  attack: slam(170, 1.0),
  boss: {
    phases: [
      {
        hpBelow: 1,
        cooldownScale: 1,
        speedScale: 1,
        attacks: [slam(170, 1.0), charge(360, 0.8), volley(7, 30, 200), mines(3, 110)],
      },
      { hpBelow: 0.55, cooldownScale: 0.8, speedScale: 1.2, attacks: PHASE_TWO },
      { hpBelow: 0.3, cooldownScale: 0.6, speedScale: 1.35, attacks: PHASE_TWO },
    ],
  },
  visual: { color: 0xff7a2f, sides: 7, rotationDeg: -90 },
});
