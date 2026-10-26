import { defineEnemy, type EnemyAttackDef } from '../../schema';

const fan = (count: number, spreadDeg: number, speed: number): EnemyAttackDef => ({
  kind: 'volley',
  triggerRangePx: 1400,
  windupSec: 0.75,
  activeSec: 0.1,
  recoverySec: 0.7,
  cooldownMinSec: 0.6,
  cooldownMaxSec: 1.1,
  damage: 12,
  trackFraction: spreadDeg >= 180 ? 0 : 0.8,
  projectileCount: count,
  spreadDeg,
  projectileSpeedPxPerSec: speed,
  projectileRadiusPx: 9,
  projectileLifeSec: 4,
});

/** She glides across the glass: a long, marked lane, perfect for a perfect dash. */
const glide = (lungePx: number, windupSec: number): EnemyAttackDef => ({
  kind: 'lunge',
  triggerRangePx: 650,
  windupSec,
  activeSec: 0.35,
  recoverySec: 1.0,
  cooldownMinSec: 0.6,
  cooldownMaxSec: 1.1,
  damage: 24,
  trackFraction: 0.75,
  lungePx,
});

/** Frozen moments crack out of the floor around the player. */
const frozenMoments = (count: number, spreadPx: number): EnemyAttackDef => ({
  kind: 'mine',
  triggerRangePx: 1400,
  windupSec: 0.8,
  activeSec: 0.1,
  recoverySec: 0.8,
  cooldownMinSec: 0.6,
  cooldownMaxSec: 1.1,
  damage: 17,
  trackFraction: 0.8,
  count,
  spreadPx,
  blastRadiusPx: 65,
  fuseSec: 1.3,
});

/** Her clones are memories (docs/STORY.md): knights from the moment before the fire. */
const memories: EnemyAttackDef = {
  kind: 'summon',
  triggerRangePx: 1400,
  windupSec: 0.9,
  activeSec: 0.1,
  recoverySec: 0.6,
  cooldownMinSec: 0.9,
  cooldownMaxSec: 1.4,
  trackFraction: 0,
  enemy: 'mirror_knight',
  count: 2,
  maxAlive: 4,
};

const crush: EnemyAttackDef = {
  kind: 'slam',
  triggerRangePx: 230,
  windupSec: 0.95,
  activeSec: 0.1,
  recoverySec: 1.2,
  cooldownMinSec: 0.6,
  cooldownMaxSec: 1.1,
  damage: 26,
  trackFraction: 0,
  slamRadiusPx: 190,
};

const LATE: EnemyAttackDef[] = [
  fan(18, 180, 160),
  glide(440, 0.65),
  frozenMoments(5, 150),
  memories,
  fan(9, 40, 210),
  crush,
];

/**
 * Die Spiegelkönigin (GDD §2.5, docs/STORY.md Akt 2): she froze her sea so the moment before
 * the fire would never end. Fans of glass, glides and frozen moments; from 60 % her memories
 * fight for her, below 30 % she stops holding back.
 */
export const MIRROR_QUEEN = defineEnemy({
  id: 'mirror_queen',
  role: 'boss',
  maxHp: 3300,
  radiusPx: 36,
  speedPxPerSec: 70,
  poise: 150,
  poiseRegenDelaySec: 3,
  staggerSec: 1.3,
  weight: 0.95,
  statusResist: 0.5,
  keepDistanceMinPx: 140,
  keepDistanceMaxPx: 260,
  token: 'none',
  waveCost: 20,
  shardValue: 65,
  minWave: 99,
  attack: fan(7, 35, 200),
  boss: {
    phases: [
      {
        hpBelow: 1,
        cooldownScale: 1,
        speedScale: 1,
        attacks: [fan(7, 35, 200), glide(360, 0.8), frozenMoments(3, 110), crush],
      },
      { hpBelow: 0.6, cooldownScale: 0.85, speedScale: 1.15, attacks: LATE },
      { hpBelow: 0.3, cooldownScale: 0.65, speedScale: 1.3, attacks: LATE },
    ],
  },
  visual: { color: 0xc8b4ff, sides: 8, rotationDeg: 0 },
});
