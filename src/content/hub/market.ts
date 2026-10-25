import { type CosmeticDef, defineCosmetic, defineTrade, type TradeDef } from '../schema';
import { registerTunables } from '../tunables';

/**
 * Nix's market (ROADMAP M5.5): a weekly offer of material trades and capes, picked from these
 * pools by the week number (no server). Text in `trade.<id>.*` is not needed: trades show their
 * goods; capes use `cosmetic.<id>.name`.
 */
export const TRADES: readonly TradeDef[] = [
  defineTrade({
    id: 'slag_to_core',
    give: { dust: 0, materials: { slag_iron: 4 } },
    get: { dust: 0, materials: { ember_core: 1 } },
    stock: 3,
  }),
  defineTrade({
    id: 'core_to_slag',
    give: { dust: 0, materials: { ember_core: 1 } },
    get: { dust: 0, materials: { slag_iron: 3 } },
    stock: 3,
  }),
  defineTrade({
    id: 'slag_to_dust',
    give: { dust: 0, materials: { slag_iron: 6 } },
    get: { dust: 1, materials: {} },
    stock: 2,
  }),
  defineTrade({
    id: 'core_to_dust',
    give: { dust: 0, materials: { ember_core: 2 } },
    get: { dust: 1, materials: {} },
    stock: 2,
  }),
  defineTrade({
    id: 'dust_to_slag',
    give: { dust: 1, materials: {} },
    get: { dust: 0, materials: { slag_iron: 4 } },
    stock: 3,
  }),
  defineTrade({
    id: 'dust_to_core',
    give: { dust: 2, materials: {} },
    get: { dust: 0, materials: { ember_core: 1 } },
    stock: 2,
  }),
];

/** Vesper's capes; `cape_red` is the one she always had. */
export const COSMETICS: readonly CosmeticDef[] = [
  defineCosmetic({ id: 'cape_red', kind: 'cape', color: 0xd94f4f, ember: 0 }),
  defineCosmetic({ id: 'cape_moss', kind: 'cape', color: 0x6f9a4a, ember: 60 }),
  defineCosmetic({ id: 'cape_night', kind: 'cape', color: 0x4a4a9a, ember: 80 }),
  defineCosmetic({ id: 'cape_gold', kind: 'cape', color: 0xe8b34a, ember: 100 }),
  defineCosmetic({ id: 'cape_rose', kind: 'cape', color: 0xe87a9a, ember: 80 }),
  defineCosmetic({ id: 'cape_sky', kind: 'cape', color: 0x5ab0e0, ember: 80 }),
  defineCosmetic({ id: 'cape_ember', kind: 'cape', color: 0xff7a2e, ember: 120 }),
];

export const DEFAULT_CAPE = 'cape_red';

/** How much of each pool is on offer in a week. */
export const MARKET = {
  tradesPerWeek: 3,
  capesPerWeek: 2,
};

registerTunables('meta: market', 'src/content/hub/market.ts', MARKET);

export function tradeById(id: string): TradeDef | undefined {
  return TRADES.find((t) => t.id === id);
}

export function cosmeticById(id: string): CosmeticDef | undefined {
  return COSMETICS.find((c) => c.id === id);
}
