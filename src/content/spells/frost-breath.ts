import { defineSpell } from '../schema';

/** Frosthauch (frost school): enemies close to the player keep getting colder and slower. */
export const FROST_BREATH = defineSpell({
  id: 'frost_breath',
  school: 'frost',
  kind: 'aura',
  cooldownSec: 0,
  pulseSec: 1.5,
  windupSec: 0,
  recoverySec: 0,
  moveFactor: 1,
  effect: {
    type: 'burst',
    at: 'self',
    rangePx: 0,
    radiusPx: 110,
    damage: 0,
    status: 'chill',
    stacks: 1,
    freeze: false,
    knockback: 0,
    delaySec: 0,
  },
  upgrades: {
    tier3: [
      { id: 'wide_breath', mods: { radiusMult: 1.35 } },
      { id: 'biting', mods: { stacksAdd: 1 } },
    ],
    tier5: [
      { id: 'quick_frost', mods: { pulseMult: 0.65 } },
      { id: 'glacier', mods: { radiusMult: 1.25, stacksAdd: 1 } },
    ],
  },
  unlockCost: { ember: 50, dust: 1 },
  visual: { color: 0x8fe3ff, glyph: 'snowflake' },
});
