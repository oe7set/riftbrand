import { defineCast, defineUltimate } from './schema';
import { registerTunables } from './tunables';

/** Riss-Geschoss (GDD §4.1): a fast ranged shot with two recharging charges. */
export const RIFT_SHOT = defineCast({
  id: 'rift_shot',
  damage: 16,
  speedPxPerSec: 820,
  radiusPx: 9,
  rangePx: 480,
  charges: 2,
  rechargeSec: 3,
  windupSec: 0.04,
  recoverySec: 0.14,
  knockback: 140,
  poiseDamage: 8,
  assistRangePx: 480,
  moveFactor: 0.5,
});

/**
 * Brandausbruch (GDD §4.1): a screen-wide blast that charges from damage dealt and taken.
 * Its flavour follows the dominant being of the build.
 */
export const BRAND_BURST = defineUltimate({
  id: 'brand_burst',
  chargeDamageDealt: 900,
  chargeDamageTaken: 90,
  windupSec: 0.35,
  recoverySec: 0.25,
  invulnSec: 0.8,
  variants: {
    none: { radiusPx: 300, damage: 55, stacks: 0, freeze: false, knockback: 420 },
    ignara: { radiusPx: 330, damage: 60, status: 'burn', stacks: 5, freeze: false, knockback: 420 },
    vaelis: { radiusPx: 330, damage: 35, stacks: 0, freeze: true, knockback: 260 },
  },
});

const SOURCE = 'src/content/abilities.ts';
registerTunables('cast: rift shot', SOURCE, RIFT_SHOT);
registerTunables('ultimate: brand burst', SOURCE, BRAND_BURST);
registerTunables('ultimate: none', SOURCE, BRAND_BURST.variants.none);
registerTunables('ultimate: ignara', SOURCE, BRAND_BURST.variants.ignara);
registerTunables('ultimate: vaelis', SOURCE, BRAND_BURST.variants.vaelis);
