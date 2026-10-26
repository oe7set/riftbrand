import { defineEnemy } from '../../schema';

/**
 * Spiegelritter: hollow armour with a mirror for a face. A long, straight lunge with a clear
 * windup; it stays upright through light hits (ROADMAP M6.1).
 */
export const MIRROR_KNIGHT = defineEnemy({
  id: 'mirror_knight',
  role: 'chaser',
  maxHp: 52,
  radiusPx: 15,
  speedPxPerSec: 100,
  poise: 20,
  poiseRegenDelaySec: 1.5,
  staggerSec: 0.45,
  weight: 0.3,
  statusResist: 0,
  keepDistanceMinPx: 120,
  keepDistanceMaxPx: 170,
  token: 'melee',
  waveCost: 1.5,
  shardValue: 3,
  minWave: 2,
  attack: {
    kind: 'lunge',
    triggerRangePx: 230,
    windupSec: 0.6,
    activeSec: 0.2,
    recoverySec: 0.7,
    cooldownMinSec: 1.2,
    cooldownMaxSec: 1.8,
    damage: 14,
    trackFraction: 0.7,
    lungePx: 200,
  },
  visual: { color: 0xc4d6ff, sides: 5, rotationDeg: -90 },
});
