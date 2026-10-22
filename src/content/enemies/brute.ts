import { defineEnemy } from '../schema';

/** Splitterkoloss: slow, poised bruiser with a ground slam and a long punish window (GDD §5.2). */
export const BRUTE = defineEnemy({
  id: 'brute',
  role: 'bruiser',
  maxHp: 120,
  radiusPx: 26,
  speedPxPerSec: 55,
  poise: 40,
  poiseRegenDelaySec: 2,
  staggerSec: 1.0,
  weight: 0.8,
  keepDistanceMinPx: 60,
  keepDistanceMaxPx: 90,
  token: 'melee',
  waveCost: 4,
  shardValue: 8,
  minWave: 3,
  attack: {
    kind: 'slam',
    triggerRangePx: 140,
    windupSec: 0.9,
    activeSec: 0.1,
    recoverySec: 1.2,
    cooldownMinSec: 2.0,
    cooldownMaxSec: 3.0,
    damage: 25,
    trackFraction: 0,
    slamRadiusPx: 130,
  },
  visual: { color: 0xff3d6e, sides: 6, rotationDeg: 0 },
});
