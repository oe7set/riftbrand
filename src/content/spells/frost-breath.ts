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
  visual: { color: 0x8fe3ff, glyph: 'snowflake' },
});
