import { defineEnemy } from '../schema';

/** Funkenspucker: keeps its distance and fires a slow three-shot fan (GDD §5.2). */
export const SPITTER = defineEnemy({
  id: 'spitter',
  role: 'shooter',
  maxHp: 22,
  radiusPx: 12,
  speedPxPerSec: 95,
  poise: 0,
  poiseRegenDelaySec: 0,
  staggerSec: 0.3,
  weight: 0.1,
  statusResist: 0,
  keepDistanceMinPx: 250,
  keepDistanceMaxPx: 350,
  token: 'ranged',
  waveCost: 1.5,
  shardValue: 3,
  minWave: 2,
  attack: {
    kind: 'volley',
    triggerRangePx: 420,
    windupSec: 0.6,
    activeSec: 0.1,
    recoverySec: 0.5,
    // M2.8: the most common killer in the simulator; a little less pressure.
    cooldownMinSec: 2.2,
    cooldownMaxSec: 3.0,
    damage: 8,
    trackFraction: 0.85,
    projectileCount: 3,
    spreadDeg: 15,
    projectileSpeedPxPerSec: 220,
    projectileRadiusPx: 7,
    projectileLifeSec: 3,
  },
  visual: { color: 0xffc23d, sides: 3, rotationDeg: 0 },
});
