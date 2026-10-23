import { defineSpell } from '../schema';

/** Frostnova (Vaelis school): a ring of cold around the player that freezes everything close. */
export const FROST_NOVA = defineSpell({
  id: 'frost_nova',
  school: 'frost',
  kind: 'active',
  cooldownSec: 15,
  pulseSec: 0,
  windupSec: 0.12,
  recoverySec: 0.2,
  moveFactor: 0.3,
  effect: {
    type: 'burst',
    at: 'self',
    rangePx: 0,
    radiusPx: 150,
    damage: 18,
    freeze: true,
    stacks: 0,
    knockback: 260,
  },
  visual: { color: 0x8fe3ff, glyph: 'nova' },
});
