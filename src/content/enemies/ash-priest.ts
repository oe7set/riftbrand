import { defineEnemy } from '../schema';

/**
 * Aschenpriester: support that keeps far back and mends nearby allies. Harmless alone, a
 * priority target in a group (GDD §5.1).
 */
export const ASH_PRIEST = defineEnemy({
  id: 'ash_priest',
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
    healFraction: 0.35,
  },
  visual: { color: 0x7dffb0, sides: 4, rotationDeg: 45 },
});
