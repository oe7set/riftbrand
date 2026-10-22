import { describe, expect, it } from 'vitest';
import { EMBER_WASTES } from '../../content/biomes/ember-wastes';
import { boonById } from '../../content/boons';
import { createRng } from '../rng/rng';
import { generateMap } from './map';
import { addBoon, OFFER_SIZE, rollBoonOffer } from './rewards';

describe('boon offers', () => {
  it('offers three distinct boons of one being, deterministically', () => {
    const a = rollBoonOffer(1, 4, 'ignara', [], 0);
    expect(a).toEqual(rollBoonOffer(1, 4, 'ignara', [], 0));
    expect(a.options).toHaveLength(OFFER_SIZE);
    expect(new Set(a.options.map((o) => o.id)).size).toBe(OFFER_SIZE);
    for (const o of a.options) expect(boonById(o.id)?.being).toBe('ignara');
  });

  it('never offers owned boons and marks slot replacements', () => {
    const owned = [
      { id: 'ember_heart', rarity: 'common' as const },
      { id: 'frost_strike', rarity: 'common' as const },
    ];
    for (let node = 0; node < 50; node++) {
      const offer = rollBoonOffer(9, node, 'ignara', owned, 0);
      for (const o of offer.options) {
        expect(o.id).not.toBe('ember_heart');
        if (o.id === 'searing_strike') expect(o.replaces).toBe('frost_strike');
      }
    }
  });

  it('rarity bonus raises the share of rare and better', () => {
    const better = (bonus: number) => {
      let n = 0;
      for (let node = 0; node < 300; node++) {
        for (const o of rollBoonOffer(3, node, 'vaelis', [], bonus).options)
          if (o.rarity !== 'common') n++;
      }
      return n;
    };
    expect(better(1)).toBeGreaterThan(better(0) * 1.3);
  });

  it('addBoon replaces the slot owner but keeps passives', () => {
    let boons = addBoon([], { id: 'searing_strike', rarity: 'common' });
    boons = addBoon(boons, { id: 'ember_heart', rarity: 'rare' });
    boons = addBoon(boons, { id: 'frost_strike', rarity: 'epic' });
    expect(boons.map((b) => b.id).sort()).toEqual(['ember_heart', 'frost_strike']);
  });
});

describe('offer exhaustion', () => {
  it('falls back to another being, then to no reward', async () => {
    const { createRun, offerFor } = await import('./run-state');
    const { BOONS } = await import('../../content/boons');
    const run = createRun(8);
    const node = { id: 3, layer: 1, x: 0.5, type: 'combat' as const, next: [] };
    run.boons = BOONS.filter((b) => b.being === 'ignara').map((b) => ({
      id: b.id,
      rarity: 'common' as const,
    }));
    const offer = offerFor(run, node);
    if (offer?.being === 'ignara') expect(offer.options.length).toBeGreaterThan(0);
    expect(offer?.options.length ?? 0).toBeGreaterThan(0);
    run.boons = BOONS.map((b) => ({ id: b.id, rarity: 'common' as const }));
    expect(offerFor(run, node)).toBeNull();
  });
});

describe('altars on the map', () => {
  it('appear across seeds but never in the first layer', () => {
    let altars = 0;
    for (let seed = 1; seed < 100; seed++) {
      for (const n of generateMap(createRng(seed), EMBER_WASTES).nodes) {
        if (n.type !== 'altar') continue;
        altars++;
        expect(n.layer).toBeGreaterThanOrEqual(EMBER_WASTES.altarMinLayer);
      }
    }
    expect(altars).toBeGreaterThan(50);
  });
});

describe('duo boons', () => {
  it('unlock only with a matching boon of both beings and then show up in offers', async () => {
    const { unlockedDuos, DUO_RARITY } = await import('./rewards');
    const ignaraOnly = [{ id: 'searing_strike', rarity: 'common' as const }];
    expect(unlockedDuos('ignara', ignaraOnly)).toHaveLength(0);
    const both = [...ignaraOnly, { id: 'frost_step', rarity: 'common' as const }];
    expect(unlockedDuos('vaelis', both).map((b) => b.id)).toEqual(['steam_burst']);
    let offered = 0;
    for (let node = 0; node < 40; node++) {
      const offer = rollBoonOffer(5, node, 'vaelis', both, 0);
      expect(offer.options.length).toBeLessThanOrEqual(3);
      const duo = offer.options.find((o) => o.id === 'steam_burst');
      if (duo) {
        offered++;
        expect(duo.rarity).toBe(DUO_RARITY);
      }
    }
    // Roughly half of the offers (DUO_OFFER.chance), never all or none.
    expect(offered).toBeGreaterThan(8);
    expect(offered).toBeLessThan(32);
    const owned = [...both, { id: 'steam_burst', rarity: 'epic' as const }];
    expect(unlockedDuos('ignara', owned)).toHaveLength(0);
  });
});

describe('evolutions', () => {
  it('become available with the combination and can be taken at a rest instead of healing', async () => {
    const { createRun, availableEvolutions, restEvolve } = await import('./run-state');
    const run = createRun(4);
    expect(availableEvolutions(run)).toEqual([]);
    run.boons = [{ id: 'searing_strike', rarity: 'common' }];
    run.relics = [{ id: 'spark_ring', stacks: 1 }];
    expect(availableEvolutions(run)).toEqual(['phoenix_blade']);
    run.hp = 50;
    restEvolve(run, 'phoenix_blade');
    expect(run.evolutions).toEqual(['phoenix_blade']);
    expect(run.hp).toBe(50);
    expect(availableEvolutions(run)).toEqual([]);
  });
});
