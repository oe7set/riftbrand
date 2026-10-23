import { registerTunables } from './tunables';

/**
 * Global game-feel numbers (GDD §4). Weapon and enemy stats live in their own content files.
 * All values are live-tunable in the debug menu.
 */
export const TUNING = {
  // Player movement
  playerSpeedPxPerSec: 220,
  /** Time to reach full speed from standstill. */
  playerAccelSec: 0.06,
  /** 0 = instant stop (precise on touch), >0 = time to stop from full speed. */
  playerDecelSec: 0,
  playerRadiusPx: 14,
  playerMaxHp: 100,
  /** Invulnerability after taking a hit. */
  playerHitInvulnSec: 0.6,
  playerHitKnockback: 220,
  /** Invulnerability after the Last Spark saved the player (Ember Tree). */
  playerLastSparkInvulnSec: 2,

  // Dash (GDD §4.2)
  dashDurationSec: 0.18,
  dashDistancePx: 170,
  /** A hit landing within this time after the dash started counts as a perfect dash. */
  perfectDashWindowSec: 0.12,
  perfectDashStaminaRefund: 0.5,
  perfectDashSlowMoSec: 0.4,
  perfectDashTimeScale: 0.3,

  // Stamina (GDD §4.3)
  staminaMax: 3,
  staminaRegenSecPerSegment: 0.8,
  staminaRegenDelaySec: 0.3,

  // Input forgiveness
  inputBufferSec: 0.15,
  /** Aim-assist half-angles per input style (GDD §4.4). */
  aimAssistTouchDeg: 30,
  aimAssistStickDeg: 20,
  aimAssistMouseDeg: 10,

  // Combat
  critChance: 0.05,
  critMultiplier: 1.5,
  /** Exponential decay rate of knockback velocity per second. */
  knockbackDecayPerSec: 12,

  // Upgrade levels (ROADMAP M3.4): every level above 1 adds these, branches come on top.
  upgradeLevelDamage: 0.2,
  upgradeLevelRadius: 0.06,
  /** Cooldown and pulse interval shrink by this per level. */
  upgradeLevelCooldown: 0.06,
  /** Angle between shots/beams when an upgrade adds more of them. */
  upgradeFanDeg: 12,
  /** Delay between echoes of a self-centred burst, and between meteors of a shower. */
  upgradeEchoSec: 0.3,
  /** Boon levels (Glutsplitter): each level adds this many rarity steps. */
  boonLevelSteps: 0.6,

  // Freezing (GDD §2.4: Vaelis). Stacking statuses live in content/statuses.ts.
  freezeDurationSec: 1.6,
  /** Extra damage taken while frozen ("shatter"), before boons. */
  frozenDamageBonus: 0.3,
  /** Safety cap on chained effect triggers per tick (TECH_DESIGN §6.5). */
  effectBudgetPerTick: 64,

  // Hitstop (GDD §4.7)
  hitstopLightSec: 0.045,
  hitstopHeavySec: 0.08,
  hitstopKillSec: 0.06,
  hitstopPlayerHitSec: 0.08,

  // Feel (view-side)
  shakeLightTrauma: 0.15,
  shakeHeavyTrauma: 0.3,
  shakePlayerHitTrauma: 0.45,
  shakeDecayPerSec: 2,
  shakeMaxOffsetPx: 14,
  shakeMaxRotationDeg: 1.5,
  hitFlashSec: 0.06,
  squashAmount: 0.18,
  squashSec: 0.12,
  lastEnemySlowMoSec: 0.5,
  lastEnemyTimeScale: 0.3,
  lastEnemyZoomPunch: 0.08,
  /** Slow motion right after the ultimate blast. */
  ultimateSlowMoSec: 0.35,
  ultimateTimeScale: 0.35,

  // Camera
  cameraFollowSharpness: 10,
  cameraLookaheadPx: 60,
  /** World area visible on screen, independent of orientation (width × height of a 16:9 view). */
  viewAreaWidthPx: 960,
  viewAreaHeightPx: 540,

  // Arena & waves
  arenaWidthPx: 1200,
  arenaHeightPx: 1200,
  firstWaveDelaySec: 1.0,
  waveIntermissionSec: 1.5,
  /** Pause between waves inside one room (encounter mode). */
  encounterWaveGapSec: 0.7,
  waveBaseBudget: 3,
  waveBudgetPerWave: 1.5,
  spawnPortalSec: 0.8,
  spawnStaggerSec: 0.12,
  spawnMinDistPx: 220,

  // Stress-test dummies
  drifterSpeedPxPerSec: 70,
  drifterRadiusPx: 10,
  drifterWanderMinSec: 0.6,
  drifterWanderMaxSec: 2.0,
  separationStrength: 0.5,

  // Input devices
  touchJoystickRadiusPx: 60,
  touchJoystickDeadzone: 0.1,
  touchAimDragThresholdPx: 14,
  gamepadDeadzone: 0.18,
} satisfies Record<string, number>;

export type TuningKey = keyof typeof TUNING;

export const TUNING_DEFAULTS: Readonly<Record<TuningKey, number>> = Object.freeze({ ...TUNING });

export function resetTuning(): void {
  Object.assign(TUNING, TUNING_DEFAULTS);
}

const SOURCE = 'src/content/tuning.ts';
const keysWithPrefix = (...prefixes: string[]) =>
  (Object.keys(TUNING) as TuningKey[]).filter((k) => prefixes.some((p) => k.startsWith(p)));

registerTunables('player', SOURCE, TUNING, {}, keysWithPrefix('player'));
registerTunables(
  'dash & stamina',
  SOURCE,
  TUNING,
  {},
  keysWithPrefix('dash', 'perfect', 'stamina'),
);
registerTunables('combat & input', SOURCE, TUNING, {}, [
  ...keysWithPrefix('input', 'aimAssist', 'crit', 'knockback', 'hitstop'),
]);
registerTunables(
  'status effects',
  SOURCE,
  TUNING,
  {},
  keysWithPrefix('freeze', 'frozen', 'effect'),
);
registerTunables(
  'feel',
  SOURCE,
  TUNING,
  {},
  keysWithPrefix('shake', 'hitFlash', 'squash', 'last', 'ultimate'),
);
registerTunables('camera', SOURCE, TUNING, {}, keysWithPrefix('camera', 'viewArea'));
registerTunables('upgrades', SOURCE, TUNING, {}, keysWithPrefix('upgrade', 'boonLevel'));
registerTunables(
  'arena & waves',
  SOURCE,
  TUNING,
  {},
  keysWithPrefix('arena', 'wave', 'firstWave', 'spawn', 'encounter'),
);
registerTunables('stress & devices', SOURCE, TUNING, {}, [
  ...keysWithPrefix('drifter', 'separation', 'touch', 'gamepad'),
]);
