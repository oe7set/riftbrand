/**
 * Global game-feel numbers. The debug menu edits TUNING live and can export the diff
 * against TUNING_DEFAULTS as code, so playtest findings flow back into this file.
 */
export const TUNING = {
  playerSpeedPxPerSec: 220,
  /** Time to reach full speed from standstill. */
  playerAccelSec: 0.06,
  /** 0 = instant stop (precise on touch), >0 = time to stop from full speed. */
  playerDecelSec: 0,
  playerRadiusPx: 14,

  cameraFollowSharpness: 10,
  cameraLookaheadPx: 60,
  /** World area visible on screen, independent of orientation (width × height of a 16:9 view). */
  viewAreaWidthPx: 960,
  viewAreaHeightPx: 540,

  arenaWidthPx: 1400,
  arenaHeightPx: 1400,

  drifterSpeedPxPerSec: 70,
  drifterRadiusPx: 10,
  drifterWanderMinSec: 0.6,
  drifterWanderMaxSec: 2.0,
  separationStrength: 0.5,

  touchJoystickRadiusPx: 60,
  touchJoystickDeadzone: 0.1,
  touchAimDragThresholdPx: 14,
  gamepadDeadzone: 0.18,
} satisfies Record<string, number>;

export type TuningKey = keyof typeof TUNING;

export const TUNING_DEFAULTS: Readonly<Record<TuningKey, number>> = Object.freeze({ ...TUNING });

export interface TuningRange {
  min: number;
  max: number;
  step: number;
  group: string;
}

export const TUNING_RANGES: Record<TuningKey, TuningRange> = {
  playerSpeedPxPerSec: { min: 80, max: 500, step: 5, group: 'player' },
  playerAccelSec: { min: 0, max: 0.4, step: 0.01, group: 'player' },
  playerDecelSec: { min: 0, max: 0.4, step: 0.01, group: 'player' },
  playerRadiusPx: { min: 6, max: 30, step: 1, group: 'player' },
  cameraFollowSharpness: { min: 1, max: 30, step: 0.5, group: 'camera' },
  cameraLookaheadPx: { min: 0, max: 200, step: 5, group: 'camera' },
  viewAreaWidthPx: { min: 480, max: 1600, step: 10, group: 'camera' },
  viewAreaHeightPx: { min: 270, max: 900, step: 10, group: 'camera' },
  arenaWidthPx: { min: 600, max: 3000, step: 50, group: 'arena' },
  arenaHeightPx: { min: 600, max: 3000, step: 50, group: 'arena' },
  drifterSpeedPxPerSec: { min: 0, max: 300, step: 5, group: 'stress' },
  drifterRadiusPx: { min: 4, max: 30, step: 1, group: 'stress' },
  drifterWanderMinSec: { min: 0.1, max: 3, step: 0.1, group: 'stress' },
  drifterWanderMaxSec: { min: 0.2, max: 5, step: 0.1, group: 'stress' },
  separationStrength: { min: 0, max: 1, step: 0.05, group: 'stress' },
  touchJoystickRadiusPx: { min: 30, max: 120, step: 2, group: 'input' },
  touchJoystickDeadzone: { min: 0, max: 0.5, step: 0.01, group: 'input' },
  touchAimDragThresholdPx: { min: 4, max: 40, step: 1, group: 'input' },
  gamepadDeadzone: { min: 0, max: 0.5, step: 0.01, group: 'input' },
};

export function resetTuning(): void {
  Object.assign(TUNING, TUNING_DEFAULTS);
}

/** Changed values as a paste-ready TS snippet for this file. */
export function exportTuningDiff(): string {
  const lines: string[] = [];
  for (const key of Object.keys(TUNING) as TuningKey[]) {
    if (TUNING[key] !== TUNING_DEFAULTS[key]) lines.push(`  ${key}: ${TUNING[key]},`);
  }
  return lines.length === 0 ? '// No tuning changes.' : `// Tuning changes\n${lines.join('\n')}`;
}
