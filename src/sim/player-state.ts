/** The player's action state machine (GDD §4.1). */
export const PlayerAction = {
  Idle: 0,
  Attack: 1,
  Special: 2,
  Dash: 3,
  Dead: 4,
} as const;

export type PlayerActionId = (typeof PlayerAction)[keyof typeof PlayerAction];

export const Buffered = {
  None: 0,
  Attack: 1,
  Special: 2,
  Dash: 3,
} as const;

export type BufferedId = (typeof Buffered)[keyof typeof Buffered];

/** Singleton state for the one player entity; kept out of the SoA arrays for readability. */
export interface PlayerState {
  action: PlayerActionId;
  /** Ticks since the current action started. */
  actionTicks: number;
  /** Combo hit currently playing (Attack) or queued next (Idle). */
  comboIndex: number;
  /** Ticks left in which the next attack continues the combo. */
  comboWindowTicks: number;
  buffered: BufferedId;
  bufferTicks: number;
  stamina: number;
  staminaDelayTicks: number;
  dirX: number;
  dirY: number;
  swingId: number;
  perfectDashUsed: boolean;
  /** Crit forced for the current swing (consumed from guaranteedCrit when it starts). */
  swingCrit: boolean;
  /** Avoids repeating the "out of stamina" feedback while one press waits in the buffer. */
  bufferStaminaSignaled: boolean;
  /** Set by a perfect dash: the next attack is a guaranteed crit. */
  guaranteedCrit: boolean;
  invulnTicks: number;
  kills: number;
}

export function createPlayerState(): PlayerState {
  return {
    action: PlayerAction.Idle,
    actionTicks: 0,
    comboIndex: 0,
    comboWindowTicks: 0,
    buffered: Buffered.None,
    bufferTicks: 0,
    stamina: 3,
    staminaDelayTicks: 0,
    dirX: 1,
    dirY: 0,
    swingId: -1,
    perfectDashUsed: false,
    swingCrit: false,
    bufferStaminaSignaled: false,
    guaranteedCrit: false,
    invulnTicks: 0,
    kills: 0,
  };
}
