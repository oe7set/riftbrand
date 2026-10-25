import { describe, expect, it } from 'vitest';
import { COSMETICS, DEFAULT_CAPE, MARKET, TRADES, tradeById } from '../../content/hub/market';
import { materialById } from '../../content/materials';
import {
  buyCosmetic,
  canBuyCosmetic,
  canTrade,
  capeColor,
  ownsCosmetic,
  syncMarketWeek,
  trade,
  tradesLeft,
  wearCape,
  weeklyOffer,
} from './market';
import { createProfile } from './profile';
import { addMaterials } from './refuge';

const WEEK = 2900;

function trader() {
  const p = createProfile();
  p.dust = 20;
  p.ember = 500;
  addMaterials(p, { slag_iron: 50, ember_core: 20 });
  return p;
}

describe("Nix's weekly market (ROADMAP M5.5)", () => {
  it('the offer comes from the week alone: same week, same goods; distinct picks', () => {
    expect(weeklyOffer(WEEK)).toEqual(weeklyOffer(WEEK));
    const offer = weeklyOffer(WEEK);
    expect(new Set(offer.trades).size).toBe(MARKET.tradesPerWeek);
    expect(new Set(offer.capes).size).toBe(MARKET.capesPerWeek);
    expect(offer.capes).not.toContain(DEFAULT_CAPE);
    const differs = [1, 2, 3, 4, 5].some(
      (d) => JSON.stringify(weeklyOffer(WEEK + d)) !== JSON.stringify(offer),
    );
    expect(differs).toBe(true);
  });

  it('a trade pays and delivers, up to its weekly stock', () => {
    const p = trader();
    const id = weeklyOffer(WEEK).trades[0] ?? '';
    const def = tradeById(id);
    if (!def) throw new Error('missing trade');
    syncMarketWeek(p, WEEK);
    for (let i = 0; i < def.stock; i++) expect(trade(p, id, WEEK)).toBe(true);
    expect(tradesLeft(p, id)).toBe(0);
    expect(canTrade(p, id, WEEK)).toBe('maxed');
    // Next week the stock is back (if the trade is offered again).
    syncMarketWeek(p, WEEK + 1);
    expect(tradesLeft(p, id)).toBe(def.stock);
  });

  it('trades off this week are not available', () => {
    const p = trader();
    const offered = weeklyOffer(WEEK).trades;
    const other = TRADES.find((t) => !offered.includes(t.id));
    if (!other) throw new Error('every trade offered');
    expect(canTrade(p, other.id, WEEK)).toBe('locked');
  });

  it('a trade needs the goods', () => {
    const p = createProfile();
    const id = weeklyOffer(WEEK).trades[0] ?? '';
    expect(['materials', 'dust']).toContain(canTrade(p, id, WEEK));
  });

  it('capes: buy from this week, then wear; the red one is always owned', () => {
    const p = trader();
    expect(ownsCosmetic(p, DEFAULT_CAPE)).toBe(true);
    const id = weeklyOffer(WEEK).capes[0] ?? '';
    const ember = p.ember;
    expect(buyCosmetic(p, id, WEEK)).toBe(true);
    expect(p.ember).toBeLessThan(ember);
    expect(p.cape).toBe(id);
    expect(canBuyCosmetic(p, id, WEEK)).toBe('owned');
    expect(wearCape(p, DEFAULT_CAPE)).toBe(true);
    expect(capeColor(p)).toBe(COSMETICS.find((c) => c.id === DEFAULT_CAPE)?.color);
    const notOffered = COSMETICS.find(
      (c) => c.ember > 0 && !weeklyOffer(WEEK).capes.includes(c.id),
    );
    if (notOffered) expect(canBuyCosmetic(p, notOffered.id, WEEK)).toBe('locked');
    expect(wearCape(p, notOffered?.id ?? 'nope')).toBe(false);
  });

  it('content: trades name real materials', () => {
    for (const t of TRADES) {
      for (const m of [...Object.keys(t.give.materials), ...Object.keys(t.get.materials)]) {
        expect(materialById(m), `${t.id}: ${m}`).toBeDefined();
      }
    }
  });
});
