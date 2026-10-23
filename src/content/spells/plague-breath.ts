import { defineSpell } from '../schema';

/**
 * Pestatem (poison school): poisons enemies close by every second; poisoned enemies that die
 * burst into a small cloud that poisons their neighbours.
 */
export const PLAGUE_BREATH = defineSpell({
  id: 'plague_breath',
  school: 'poison',
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
    radiusPx: 100,
    damage: 0,
    status: 'poison',
    stacks: 1,
    freeze: false,
    knockback: 0,
    delaySec: 0,
  },
  onKill: {
    requiresStatus: 'poison',
    radiusPx: 70,
    durationSec: 2,
    pulseSec: 0.5,
    damage: 0,
    status: 'poison',
    stacks: 1,
    knockback: 0,
  },
  visual: { color: 0x7dff6b, glyph: 'drop' },
});
