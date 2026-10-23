import { defineEnemy } from '../schema';

/** Glutmilbe: tiny, fast swarm enemy with a short hop; dangerous only in numbers (GDD §5.1). */
export const EMBER_MITE = defineEnemy({
  id: 'ember_mite',
  role: 'swarm',
  maxHp: 9,
  radiusPx: 9,
  speedPxPerSec: 165,
  poise: 0,
  poiseRegenDelaySec: 0,
  staggerSec: 0.2,
  weight: 0,
  keepDistanceMinPx: 30,
  keepDistanceMaxPx: 60,
  token: 'melee',
  waveCost: 0.5,
  shardValue: 1,
  minWave: 2,
  attack: {
    kind: 'lunge',
    triggerRangePx: 90,
    windupSec: 0.4,
    activeSec: 0.12,
    recoverySec: 0.45,
    cooldownMinSec: 0.8,
    cooldownMaxSec: 1.4,
    damage: 6,
    trackFraction: 0.6,
    lungePx: 70,
  },
  visual: { color: 0xffa13d, sides: 3, rotationDeg: 0 },
});
