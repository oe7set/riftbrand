import { defineEnemy } from '../../schema';

/**
 * Prismenspucker: a crystal snail that splits light into a wide, slow fan. Keeps its distance;
 * the gaps in the fan are wide enough to walk through (ROADMAP M6.1).
 */
export const PRISM_SPITTER = defineEnemy({
  id: 'prism_spitter',
  role: 'shooter',
  maxHp: 26,
  radiusPx: 13,
  speedPxPerSec: 85,
  poise: 0,
  poiseRegenDelaySec: 0,
  staggerSec: 0.3,
  weight: 0.1,
  statusResist: 0,
  keepDistanceMinPx: 260,
  keepDistanceMaxPx: 360,
  token: 'ranged',
  waveCost: 1.5,
  shardValue: 3,
  minWave: 1,
  attack: {
    kind: 'volley',
    triggerRangePx: 440,
    windupSec: 0.7,
    activeSec: 0.1,
    recoverySec: 0.5,
    cooldownMinSec: 2.4,
    cooldownMaxSec: 3.2,
    damage: 8,
    trackFraction: 0.85,
    projectileCount: 5,
    spreadDeg: 32,
    projectileSpeedPxPerSec: 190,
    projectileRadiusPx: 7,
    projectileLifeSec: 3.2,
  },
  visual: { color: 0xd8a8ff, sides: 4, rotationDeg: 45 },
});
