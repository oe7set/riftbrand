import { defineSpell } from '../schema';

/** Lichtlanze (light school): a straight beam that pierces everything in its line and blinds. */
export const LIGHT_LANCE = defineSpell({
  id: 'light_lance',
  school: 'light',
  kind: 'active',
  cooldownSec: 10,
  pulseSec: 0,
  windupSec: 0.1,
  recoverySec: 0.18,
  moveFactor: 0.3,
  effect: {
    type: 'beam',
    lengthPx: 420,
    widthPx: 40,
    damage: 50,
    status: 'blind',
    stacks: 1,
    knockback: 140,
  },
  upgrades: {
    tier3: [
      { id: 'double_lance', mods: { count: 1 } },
      { id: 'prism', mods: { damageMult: 1.6, radiusMult: 1.5 } },
    ],
    tier5: [
      { id: 'triple_lance', mods: { count: 1 } },
      { id: 'focus', mods: { cooldownMult: 0.6 } },
    ],
  },
  unlockCost: { ember: 70, dust: 2 },
  visual: { color: 0xfff6c8, glyph: 'ray' },
});
