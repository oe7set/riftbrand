import { defineEnemy } from '../../schema';

/** Gezeitenpriesterin: sings the frozen tide back into her allies' wounds; a priority target. */
export const TIDE_PRIEST = defineEnemy({
  id: 'tide_priest',
  role: 'support',
  maxHp: 34,
  radiusPx: 14,
  speedPxPerSec: 85,
  poise: 0,
  poiseRegenDelaySec: 0,
  staggerSec: 0.35,
  weight: 0.2,
  statusResist: 0,
  keepDistanceMinPx: 280,
  keepDistanceMaxPx: 380,
  token: 'ranged',
  waveCost: 2.5,
  shardValue: 5,
  minWave: 3,
  attack: {
    kind: 'mend',
    triggerRangePx: 2000,
    windupSec: 0.9,
    activeSec: 0.1,
    recoverySec: 0.6,
    cooldownMinSec: 3.0,
    cooldownMaxSec: 4.0,
    trackFraction: 0,
    radiusPx: 220,
    healFraction: 0.3,
  },
  visual: { color: 0x7fe0d0, sides: 4, rotationDeg: 45 },
});
