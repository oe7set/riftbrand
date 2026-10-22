import { defineWeapon } from '../schema';
import { registerTunables } from '../tunables';

/** Brandklinge, the starting weapon (GDD §4.8). Combo: arc, arc, thrust. */
export const BRAND_BLADE = defineWeapon({
  id: 'brand_blade',
  combo: [
    {
      damage: 12,
      reachPx: 70,
      arcDeg: 110,
      windupSec: 0.06,
      activeSec: 0.08,
      recoverySec: 0.16,
      lungePx: 16,
      knockback: 160,
      poiseDamage: 10,
      hitstop: 'light',
    },
    {
      damage: 12,
      reachPx: 70,
      arcDeg: 110,
      windupSec: 0.06,
      activeSec: 0.08,
      recoverySec: 0.16,
      lungePx: 16,
      knockback: 160,
      poiseDamage: 10,
      hitstop: 'light',
    },
    {
      damage: 20,
      reachPx: 90,
      arcDeg: 50,
      windupSec: 0.08,
      activeSec: 0.1,
      recoverySec: 0.24,
      lungePx: 34,
      knockback: 300,
      poiseDamage: 20,
      hitstop: 'heavy',
    },
  ],
  comboWindowSec: 0.35,
  recoveryCancelSec: 0.08,
  attackMoveFactor: 0.35,
  assistRangePx: 170,
  special: {
    id: 'ember_whirl',
    damage: 25,
    radiusPx: 110,
    windupSec: 0.1,
    activeSec: 0.12,
    recoverySec: 0.25,
    staminaCost: 1,
    knockback: 300,
    poiseDamage: 30,
    moveFactor: 0.2,
  },
});

const SOURCE = 'src/content/weapons/brand-blade.ts';
registerTunables('blade', SOURCE, BRAND_BLADE);
BRAND_BLADE.combo.forEach((hit, i) => {
  registerTunables(`blade: hit ${i + 1}`, SOURCE, hit);
});
registerTunables('blade: ember whirl', SOURCE, BRAND_BLADE.special);
