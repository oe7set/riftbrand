/** The player's action state machine (GDD §4.1). */
export const PlayerAction = {
  Idle: 0,
  Attack: 1,
  Special: 2,
  Dash: 3,
  Dead: 4,
  Cast: 5,
  Ultimate: 6,
  Spell: 7,
} as const;

export type PlayerActionId = (typeof PlayerAction)[keyof typeof PlayerAction];

export const Buffered = {
  None: 0,
  Attack: 1,
  Special: 2,
  Dash: 3,
  Cast: 4,
  Ultimate: 5,
  Spell: 6,
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
  /** Rift shot charges (GDD §4.1) and ticks until the next one returns. */
  castCharges: number;
  castRechargeTicks: number;
  /** Ultimate meter 0..1; carried between rooms by the run. */
  ultCharge: number;
  /** Equipped spells (index into content SPELLS, -1 = empty slot) and their levels. */
  activeSpell: number;
  activeSpellLevel: number;
  auraSpell: number;
  auraSpellLevel: number;
  /** Ticks until the active spell can be cast again (0 = ready). */
  spellCooldownTicks: number;
  /** Full cooldown of the last cast, for the HUD's cooldown sweep. */
  spellCooldownTotal: number;
  /** Ticks until the next aura pulse. */
  auraTimerTicks: number;
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
    castCharges: 0,
    castRechargeTicks: 0,
    ultCharge: 0,
    activeSpell: -1,
    activeSpellLevel: 1,
    auraSpell: -1,
    auraSpellLevel: 1,
    spellCooldownTicks: 0,
    spellCooldownTotal: 1,
    auraTimerTicks: 0,
  };
}
