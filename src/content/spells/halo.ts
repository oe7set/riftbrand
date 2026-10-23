import { defineSpell } from '../schema';

/** Heiligenschein (light school): every 2 s a pulse of light dissolves the nearest enemy shot. */
export const HALO = defineSpell({
  id: 'halo',
  school: 'light',
  kind: 'aura',
  cooldownSec: 0,
  pulseSec: 2,
  windupSec: 0,
  recoverySec: 0,
  moveFactor: 1,
  effect: { type: 'ward', radiusPx: 140, count: 1 },
  upgrades: {
    tier3: [
      { id: 'twin_halo', mods: { count: 1 } },
      { id: 'wide_halo', mods: { radiusMult: 1.4 } },
    ],
    tier5: [
      { id: 'quick_halo', mods: { pulseMult: 0.6 } },
      { id: 'triple_halo', mods: { count: 1 } },
    ],
  },
  unlockCost: { ember: 60, dust: 2 },
  visual: { color: 0xfff6c8, glyph: 'eye' },
});
