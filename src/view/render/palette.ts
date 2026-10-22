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
  debugCollider: 0x39ff88,
  touchBase: 0xffffff,
  touchAccent: 0x7ff6ff,
} as const;
