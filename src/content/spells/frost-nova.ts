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
    delaySec: 0,
  },
  upgrades: {
    tier3: [
      { id: 'wide_ring', mods: { radiusMult: 1.35 } },
      { id: 'shatter', mods: { damageMult: 2.2, knockbackMult: 1.3 } },
    ],
    tier5: [
      { id: 'echo', mods: { count: 1 } },
      { id: 'deep_winter', mods: { cooldownMult: 0.7 } },
    ],
  },
  visual: { color: 0x8fe3ff, glyph: 'nova' },
});
