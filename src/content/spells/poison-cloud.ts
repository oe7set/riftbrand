import { defineSpell } from '../schema';

/** Giftwolke (poison school): a cloud at the aimed spot that poisons everything inside for 5 s. */
export const POISON_CLOUD = defineSpell({
  id: 'poison_cloud',
  school: 'poison',
  kind: 'active',
  cooldownSec: 12,
  pulseSec: 0,
  windupSec: 0.1,
  recoverySec: 0.15,
  moveFactor: 0.6,
  effect: {
    type: 'zone',
    at: 'target',
    rangePx: 200,
    radiusPx: 110,
    damage: 0,
    status: 'poison',
    stacks: 1,
    knockback: 0,
    durationSec: 5,
    pulseSec: 0.5,
  },
  visual: { color: 0x7dff6b, glyph: 'cloud' },
});
