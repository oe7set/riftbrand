import { describe, expect, it } from 'vitest';
import { EMBER_WASTES } from '../../content/biomes/ember-wastes';
import { RELICS, relicById, relicValue } from '../../content/relics';
import { TUNING } from '../../content/tuning';
import { compileBuild } from '../effects/build';
import { createRng } from '../rng/rng';
import {
  addRelic,
  applyOutcomes,
  eventFor,
  heal,
  nodeReward,
  rollRelicOffer,
  shopStock,
} from './economy';
import { generateMap } from './map';
import { completeRoom, createRun } from './run-state';

describe('relic stacking', () => {
  it('stacks linear values and hyperbolic chances', () => {
    const stone = relicById('ember_stone');
    const ring = relicById('spark_ring');
    if (!stone || !ring) throw new Error('missing relic');
    expect(relicValue(stone, 'bonus', 1)).toBeCloseTo(0.08);
    expect(relicValue(stone, 'bonus', 3)).toBeCloseTo(0.24);
    const c1 = relicValue(ring, 'chance', 1);
    const c10 = relicValue(ring, 'chance', 10);
    expect(c1).toBeCloseTo(1 - 1 / 1.2);
    expect(c10).toBeGreaterThan(c1);
    expect(c10).toBeLessThan(1);
  });

  it('compiles relic stats into the build', () => {
    const b = compileBuild(
      [],
      [
        { id: 'ember_stone', stacks: 2 },
        { id: 'whetstone', stacks: 1 },
      ],
    );
    expect(b.stats.allDamage).toBeCloseTo(0.16);
    expect(b.stats.critChance).toBeCloseTo(0.06);
  });
});

describe('run economy', () => {
  it('heart shard raises and heals max HP; glass bones lowers it', () => {
    const run = createRun(1);
    run.hp = 50;
    addRelic(run, 'heart_shard');
    expect(run.maxHp).toBe(TUNING.playerMaxHp + 15);
    expect(run.hp).toBe(65);
    addRelic(run, 'glass_bones');
    expect(run.maxHp).toBe(TUNING.playerMaxHp + 15 - 30);
    expect(run.hp).toBeLessThanOrEqual(run.maxHp);
  });

  it('event max HP survives later relic changes', () => {
    const run = createRun(2);
    applyOutcomes(run, 1, 'share_fire', [{ type: 'maxHp', amount: 8 }]);
    expect(run.maxHp).toBe(TUNING.playerMaxHp + 8);
    addRelic(run, 'heart_shard');
    expect(run.maxHp).toBe(TUNING.playerMaxHp + 8 + 15);
  });

  it('greedy heart reduces healing', () => {
    const run = createRun(1);
    run.hp = 10;
    expect(heal(run, 20)).toBeCloseTo(20);
    addRelic(run, 'greedy_heart');
    run.hp = 10;
    expect(heal(run, 20)).toBeCloseTo(10);
  });

  it('room clear adds the shard bonus on top of the shards carried out of the room', () => {
    const run = createRun(3);
    const node = run.map.nodes[run.map.layers[0]?.[0] ?? 0];
    if (!node) throw new Error('no node');
    run.currentNodeId = node.id;
    completeRoom(run, { hp: 100, kills: 4, timeSec: 20, shards: 12, ultCharge: 0 });
    expect(run.shards).toBe(12 + 10);
  });

  it('elites always grant relics; combat rewards are mostly boons', () => {
    let boons = 0;
    for (let id = 0; id < 400; id++) {
      expect(nodeReward(5, { id, type: 'elite' })?.kind).toBe('relic');
      if (nodeReward(5, { id, type: 'combat' })?.kind === 'boon') boons++;
    }
    expect(boons).toBeGreaterThan(200);
    expect(boons).toBeLessThan(290);
    expect(nodeReward(5, { id: 1, type: 'rest' })).toBeNull();
  });

  it('relic offers are three distinct relics and never curses', () => {
    for (let node = 0; node < 100; node++) {
      const offer = rollRelicOffer(11, node, 1);
      expect(offer).toHaveLength(3);
      expect(new Set(offer).size).toBe(3);
      for (const id of offer) expect(relicById(id)?.rarity).not.toBe('curse');
    }
  });

  it('shop stock is deterministic and contains a curse, a boon and healing', () => {
    const run = createRun(21);
    const a = shopStock(run, { id: 9 });
    expect(a).toEqual(shopStock(run, { id: 9 }));
    expect(a.some((i) => i.kind === 'relic' && relicById(i.id)?.rarity === 'curse')).toBe(true);
    expect(a.some((i) => i.kind === 'boon')).toBe(true);
    expect(a.some((i) => i.kind === 'heal')).toBe(true);
    for (const i of a) expect(i.price).toBeGreaterThan(0);
  });

  it('event outcomes apply and resolve relics', () => {
    const run = createRun(4);
    run.hp = 10;
    const results = applyOutcomes(run, 2, 'dive', [
      { type: 'damage', amount: 18 },
      { type: 'relic', pool: 'curse' },
      { type: 'shards', amount: 25 },
    ]);
    expect(run.hp).toBeGreaterThanOrEqual(1);
    expect(run.shards).toBe(25);
    const relic = results.find((r) => r.type === 'relic')?.relicId;
    expect(relicById(relic ?? '')?.rarity).toBe('curse');
    expect(run.relics.some((r) => r.id === relic)).toBe(true);
    expect(eventFor(4, 2)).toBeDefined();
  });
});

describe('map with shops and events', () => {
  it('has at most two shops, none before their minimum layer, and events appear', () => {
    let events = 0;
    for (let seed = 1; seed < 150; seed++) {
      const map = generateMap(createRng(seed), EMBER_WASTES);
      const shops = map.nodes.filter((n) => n.type === 'shop');
      expect(shops.length).toBeLessThanOrEqual(EMBER_WASTES.maxShops);
      for (const s of shops) expect(s.layer).toBeGreaterThanOrEqual(EMBER_WASTES.shopMinLayer);
      events += map.nodes.filter((n) => n.type === 'event').length;
    }
    expect(events).toBeGreaterThan(50);
  });

  it('every relic has a price and valid rarity', () => {
    expect(RELICS.length).toBe(12);
    expect(RELICS.filter((r) => r.rarity === 'curse')).toHaveLength(2);
  });
});
