import { defineSpell } from '../schema';

/** Glutmantel (Ignara school): enemies close to the player catch fire every second. */
export const EMBER_MANTLE = defineSpell({
  id: 'ember_mantle',
  school: 'flame',
  kind: 'aura',
  cooldownSec: 0,
  pulseSec: 1,
  windupSec: 0,
  recoverySec: 0,
  moveFactor: 1,
  effect: {
    type: 'burst',
    at: 'self',
    rangePx: 0,
    radiusPx: 90,
    damage: 0,
    status: 'burn',
    stacks: 1,
    freeze: false,
    knockback: 0,
    delaySec: 0,
  },
  upgrades: {
    tier3: [
      { id: 'wide_mantle', mods: { radiusMult: 1.35 } },
      { id: 'searing', mods: { stacksAdd: 1 } },
    ],
    tier5: [
      { id: 'quick_flame', mods: { pulseMult: 0.65 } },
      { id: 'blaze', mods: { radiusMult: 1.25, stacksAdd: 1 } },
    ],
  },
  visual: { color: 0xffa64d, glyph: 'flame' },
});
