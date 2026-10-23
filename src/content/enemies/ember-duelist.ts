import { defineEnemy, type EnemyAttackDef } from '../schema';

const thrust = (lungePx: number, windupSec: number, damage: number): EnemyAttackDef => ({
  kind: 'lunge',
  triggerRangePx: lungePx + 60,
  windupSec,
  activeSec: 0.16,
  recoverySec: 0.55,
  cooldownMinSec: 0.4,
  cooldownMaxSec: 0.8,
  damage,
  trackFraction: 0.6,
  lungePx,
});

/** The parry stance: strike it from the front and it ripostes; break it with anything else. */
const guard: EnemyAttackDef = {
  kind: 'guard',
  triggerRangePx: 200,
  windupSec: 0.8,
  activeSec: 0.05,
  recoverySec: 0.4,
  cooldownMinSec: 0.4,
  cooldownMaxSec: 0.8,
  trackFraction: 1,
  counterDamage: 16,
  counterRangePx: 120,
  frontArcDeg: 140,
  brokenStaggerSec: 1.2,
};

const bladeWave: EnemyAttackDef = {
  kind: 'volley',
  triggerRangePx: 500,
  windupSec: 0.6,
  activeSec: 0.1,
  recoverySec: 0.6,
  cooldownMinSec: 0.6,
  cooldownMaxSec: 1,
  damage: 10,
  trackFraction: 0.8,
  projectileCount: 5,
  spreadDeg: 30,
  projectileSpeedPxPerSec: 230,
  projectileRadiusPx: 8,
  projectileLifeSec: 2.5,
};

/**
 * Glut-Duellant (ROADMAP M3.5): a quick fencer and the first mini-boss of the Aschefelder. Phase
 * 1 thrusts and parries, phase 2 adds a blade wave and parries more, phase 3 adds a long
 * charge through a marked lane that rewards a perfect dash.
 */
export const EMBER_DUELIST = defineEnemy({
  id: 'ember_duelist',
  role: 'champion',
  maxHp: 1800,
  radiusPx: 20,
  speedPxPerSec: 150,
  poise: 60,
  poiseRegenDelaySec: 2,
  staggerSec: 0.9,
  weight: 0.6,
  statusResist: 0.3,
  keepDistanceMinPx: 70,
  keepDistanceMaxPx: 150,
  token: 'none',
  waveCost: 12,
  shardValue: 40,
  // Only duel rooms spawn champions.
  minWave: 99,
  attack: thrust(130, 0.45, 14),
  boss: {
    phases: [
      {
        hpBelow: 1,
        cooldownScale: 1,
        speedScale: 1,
        attacks: [thrust(130, 0.45, 14), thrust(200, 0.6, 18), guard],
      },
      {
        hpBelow: 0.66,
        cooldownScale: 0.9,
        speedScale: 1.1,
        attacks: [thrust(130, 0.42, 14), thrust(200, 0.55, 18), guard, guard, bladeWave],
      },
      {
        hpBelow: 0.33,
        cooldownScale: 0.75,
        speedScale: 1.25,
        attacks: [
          thrust(140, 0.4, 15),
          guard,
          bladeWave,
          // Glutsturm: a long, readable lane and a fast commit (perfect-dash bait).
          { ...thrust(380, 0.75, 22), trackFraction: 0.7, recoverySec: 0.9 },
        ],
      },
    ],
  },
  visual: { color: 0xff8f4d, sides: 4, rotationDeg: 45 },
});
