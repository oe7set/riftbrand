import { defineEnemy, type EnemyAttackDef } from '../../schema';

const breach = (radius: number, windupSec: number): EnemyAttackDef => ({
  kind: 'slam',
  triggerRangePx: radius + 40,
  windupSec,
  activeSec: 0.1,
  recoverySec: 1.2,
  cooldownMinSec: 0.7,
  cooldownMaxSec: 1.2,
  damage: 26,
  trackFraction: 0,
  slamRadiusPx: radius,
});

/** A spray of ice all around: the gaps are the way through. */
const spray = (count: number, speed: number): EnemyAttackDef => ({
  kind: 'volley',
  triggerRangePx: 1400,
  windupSec: 0.8,
  activeSec: 0.1,
  recoverySec: 0.7,
  cooldownMinSec: 0.7,
  cooldownMaxSec: 1.2,
  damage: 11,
  trackFraction: 0,
  projectileCount: count,
  spreadDeg: 180,
  projectileSpeedPxPerSec: speed,
  projectileRadiusPx: 9,
  projectileLifeSec: 4,
});

/** Shock waves under the ice: rings of rime burst where the player stands. */
const shocks: EnemyAttackDef = {
  kind: 'mine',
  triggerRangePx: 1400,
  windupSec: 0.8,
  activeSec: 0.1,
  recoverySec: 0.8,
  cooldownMinSec: 0.7,
  cooldownMaxSec: 1.2,
  damage: 16,
  trackFraction: 0.8,
  count: 4,
  spreadPx: 120,
  blastRadiusPx: 65,
  fuseSec: 1.3,
};

/** It dives under the ice and rams out along a marked lane: dash through it. */
const ram: EnemyAttackDef = {
  kind: 'lunge',
  triggerRangePx: 650,
  windupSec: 0.75,
  activeSec: 0.35,
  recoverySec: 1.0,
  cooldownMinSec: 0.7,
  cooldownMaxSec: 1.2,
  damage: 24,
  trackFraction: 0.75,
  lungePx: 400,
};

/**
 * Eiswal-Wächter (ROADMAP M6.1): the second champion. Huge and slow, it breaches the ice in a
 * ring, sprays shards, and from phase 2 rams through the room.
 */
export const ICE_WHALE = defineEnemy({
  id: 'ice_whale',
  role: 'champion',
  maxHp: 2200,
  radiusPx: 34,
  speedPxPerSec: 65,
  poise: 120,
  poiseRegenDelaySec: 2.5,
  staggerSec: 1.2,
  weight: 0.95,
  statusResist: 0.35,
  keepDistanceMinPx: 90,
  keepDistanceMaxPx: 180,
  token: 'none',
  waveCost: 14,
  shardValue: 45,
  minWave: 99,
  attack: breach(170, 0.95),
  boss: {
    phases: [
      {
        hpBelow: 1,
        cooldownScale: 1,
        speedScale: 1,
        attacks: [breach(170, 0.95), spray(12, 160), shocks],
      },
      {
        hpBelow: 0.6,
        cooldownScale: 0.85,
        speedScale: 1.15,
        attacks: [breach(190, 0.9), ram, spray(14, 175), shocks],
      },
      {
        hpBelow: 0.3,
        cooldownScale: 0.7,
        speedScale: 1.3,
        attacks: [ram, spray(16, 185), shocks, breach(200, 0.85)],
      },
    ],
  },
  visual: { color: 0x7fb8e8, sides: 7, rotationDeg: 0 },
});
