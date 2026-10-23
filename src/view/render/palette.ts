/** Neon palette (GDD §12.1): dark, low-contrast world; the play layer glows. */
export const PALETTE = {
  background: 0x07060d,
  floorGrid: 0x1c1830,
  floorGridMajor: 0x2a2346,
  arenaEdge: 0xff7a2f,
  player: 0x7ff6ff,
  playerCore: 0xffffff,
  /** Player attacks: bright, cool and elongated (GDD §12.1 rule 2). */
  playerSlash: 0xbffcff,
  ember: 0xffa64d,
  drifter: 0xb36bff,
  /** Enemy attacks: warm and round. */
  enemyShot: 0xff5a3d,
  telegraph: 0xff3d3d,
  telegraphFill: 0xff7a5c,
  portal: 0xc46bff,
  hpBack: 0x2a1020,
  hpFill: 0xff4d6d,
  hpPlayer: 0x7ff6ff,
  stamina: 0xffd36b,
  crit: 0xfff06b,
  damageText: 0xffffff,
  perfectDash: 0x9dfcff,
  frozen: 0xa8ecff,
  chillLight: 0xd6f4ff,
  chillHeavy: 0xa6dcff,
  frost: 0x8fe3ff,
  /** Parry stance of champions: cool, a defence, not an attack. */
  guard: 0x6bb8ff,
  /** Body tint of poisoned enemies. */
  poisonTint: 0xc8ffb8,
  burnText: 0xffa64d,
  heal: 0x6bff9a,
  shard: 0xffd36b,
  /** Rift shot: cool violet so it reads as the player's, never as an enemy shot. */
  riftShot: 0xc7b8ff,
  firebird: 0xffb347,
  steam: 0xf2f7ff,
  /** Ultimate meter and burst flavours. */
  ultimate: 0xff8a3d,
  debugCollider: 0x39ff88,
  touchBase: 0xffffff,
  touchAccent: 0x7ff6ff,
} as const;
