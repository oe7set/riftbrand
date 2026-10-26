import { defineEnemy } from '../../schema';

/** Glimmerling: a skittering shard of mirror glass; quick hops in packs (ROADMAP M6.1). */
export const GLASS_MITE = defineEnemy({
  id: 'glass_mite',
  role: 'swarm',
  maxHp: 11,
  radiusPx: 9,
  speedPxPerSec: 170,
  poise: 0,
  poiseRegenDelaySec: 0,
  staggerSec: 0.2,
  weight: 0,
  statusResist: 0,
  keepDistanceMinPx: 30,
  keepDistanceMaxPx: 60,
  token: 'melee',
  waveCost: 0.5,
  shardValue: 1,
  minWave: 1,
  attack: {
    kind: 'lunge',
    triggerRangePx: 95,
    windupSec: 0.4,
    activeSec: 0.12,
    recoverySec: 0.45,
    cooldownMinSec: 0.8,
    cooldownMaxSec: 1.4,
    damage: 7,
    trackFraction: 0.6,
    lungePx: 75,
  },
  visual: { color: 0xbfe9f2, sides: 3, rotationDeg: 0 },
});
