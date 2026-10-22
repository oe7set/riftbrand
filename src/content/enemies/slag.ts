import { defineEnemy } from '../schema';

/** Schlacke: melee chaser with a telegraphed lunge (GDD §5.2). */
export const SLAG = defineEnemy({
  id: 'slag',
  role: 'chaser',
  maxHp: 30,
  radiusPx: 13,
  speedPxPerSec: 115,
  poise: 0,
  poiseRegenDelaySec: 0,
  staggerSec: 0.25,
  weight: 0,
  keepDistanceMinPx: 70,
  keepDistanceMaxPx: 110,
  token: 'melee',
  waveCost: 1,
  minWave: 1,
  attack: {
    kind: 'lunge',
    triggerRangePx: 150,
    windupSec: 0.5,
    activeSec: 0.15,
    recoverySec: 0.6,
    cooldownMinSec: 1.0,
    cooldownMaxSec: 1.6,
    damage: 12,
    trackFraction: 0.7,
    lungePx: 140,
  },
  visual: { color: 0xff6a3d, sides: 5, rotationDeg: -90 },
});
