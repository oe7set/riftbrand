import { defineSpell } from '../schema';

/**
 * Meteor (flame school): the aimed spot is marked and fills up for half a second, then a
 * meteor lands there, knocks everything back and sets it on fire.
 */
export const METEOR = defineSpell({
  id: 'meteor',
  school: 'flame',
  kind: 'active',
  cooldownSec: 14,
  pulseSec: 0,
  windupSec: 0.15,
  recoverySec: 0.15,
  moveFactor: 0.5,
  effect: {
    type: 'burst',
    at: 'target',
    rangePx: 240,
    radiusPx: 120,
    damage: 45,
    status: 'burn',
    stacks: 3,
    freeze: false,
    knockback: 320,
    delaySec: 0.5,
  },
  upgrades: {
    tier3: [
      { id: 'shower', mods: { count: 2, radiusMult: 0.65, damageMult: 0.7 } },
      { id: 'giant', mods: { radiusMult: 1.4, damageMult: 1.4, knockbackMult: 1.3 } },
    ],
    tier5: [
      { id: 'firestorm', mods: { stacksAdd: 3 } },
      { id: 'quick_call', mods: { cooldownMult: 0.65 } },
    ],
  },
  visual: { color: 0xffb347, glyph: 'meteor' },
});
