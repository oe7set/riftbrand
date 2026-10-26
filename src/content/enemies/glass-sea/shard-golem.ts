import { defineEnemy } from '../../schema';

/** Scherbenkoloss: a heap of frozen glass that slams the ice; slow, poised, big (ROADMAP M6.1). */
export const SHARD_GOLEM = defineEnemy({
  id: 'shard_golem',
  role: 'bruiser',
  maxHp: 135,
  radiusPx: 27,
  speedPxPerSec: 52,
  poise: 45,
  poiseRegenDelaySec: 2,
  staggerSec: 1.0,
  weight: 0.85,
  statusResist: 0,
  keepDistanceMinPx: 60,
  keepDistanceMaxPx: 90,
  token: 'melee',
  waveCost: 4,
  shardValue: 8,
  minWave: 3,
  attack: {
    kind: 'slam',
    triggerRangePx: 150,
    windupSec: 0.95,
    activeSec: 0.1,
    recoverySec: 1.25,
    cooldownMinSec: 2.0,
    cooldownMaxSec: 3.0,
    damage: 26,
    trackFraction: 0,
    slamRadiusPx: 140,
  },
  visual: { color: 0x8fb8e8, sides: 6, rotationDeg: 0 },
});
