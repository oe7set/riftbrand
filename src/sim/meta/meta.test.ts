import { describe, expect, it } from 'vitest';
import { DIALOGUE } from '../../content/dialogue';
import { EMBER_TREE } from '../../content/meta/ember-tree';
import { META_REWARDS } from '../../content/meta/rewards';
import { RELICS } from '../../content/relics';
import { rollRelicOffer, shopStock } from '../run/economy';
import { createRun, offerFor, rerollOffer } from '../run/run-state';
import { markSeen, pickLine } from './dialogue';
import {
  buyRank,
  canBuyRank,
  canUnlockSpell,
  createProfile,
  discoverRunSpells,
  equipLoadout,
  lockedRelics,
  nextGoal,
  type Profile,
  recordRun,
  respec,
  runEarnings,
  runMetaFor,
  spellUnlockCost,
  startSpellsFor,
  treeRank,
  unlockRelic,
  unlockSpell,
} from './profile';

function rich(): Profile {
  const p = createProfile();
  p.ember = 10_000;
  p.dust = 100;
  return p;
}

describe('ember tree', () => {
  it('buys ranks in order, respects requirements and the max rank', () => {
    const p = rich();
    expect(canBuyRank(p, 'last_spark')).toBe('locked');
    expect(buyRank(p, 'vitality')).toBe(true);
    expect(canBuyRank(p, 'last_spark')).toBe('ok');
    buyRank(p, 'vitality');
    buyRank(p, 'vitality');
    expect(treeRank(p, 'vitality')).toBe(3);
    expect(canBuyRank(p, 'vitality')).toBe('maxed');
    expect(p.ember).toBe(10_000 - 30 - 60 - 100);
  });

  it('refuses without enough Glut or Rissstaub', () => {
    const p = createProfile();
    expect(canBuyRank(p, 'vitality')).toBe('ember');
    p.ember = 1000;
    expect(canBuyRank(p, 'second_offer')).toBe('dust');
    expect(buyRank(p, 'second_offer')).toBe(false);
  });

  it('respec refunds everything', () => {
    const p = rich();
    for (const node of EMBER_TREE) while (buyRank(p, node.id));
    expect(p.ember).toBeLessThan(10_000);
    respec(p);
    expect(p.ember).toBe(10_000);
    expect(p.dust).toBe(100);
    expect(p.tree).toEqual({});
  });

  it('the full tree takes roughly 15–25 runs of Glut (GDD §8.2)', () => {
    let total = 0;
    for (const node of EMBER_TREE) for (const r of node.ranks) total += r.ember;
    // A typical run: ~6 fights, 1 elite, some kills; a won run adds boss and win bonus.
    const typical = runEarnings({ combat: 6, elite: 1, boss: 0 }, 60, false).ember;
    expect(total / typical).toBeGreaterThan(15);
    expect(total / typical).toBeLessThan(28);
  });

  it('ranks turn into run bonuses', () => {
    const p = rich();
    buyRank(p, 'vitality');
    buyRank(p, 'vitality');
    buyRank(p, 'starting_shards');
    buyRank(p, 'last_spark');
    buyRank(p, 'last_spark');
    buyRank(p, 'second_offer');
    buyRank(p, 'deep_breath');
    buyRank(p, 'fourth_segment');
    const meta = runMetaFor(p);
    expect(meta.maxHp).toBe(20);
    expect(meta.startShards).toBe(30);
    expect(meta.lastSparks).toBe(1);
    expect(meta.lastSparkHeal).toBeCloseTo(0.4);
    expect(meta.rerolls).toBe(1);
    expect(meta.staminaBonus).toBe(1);
    const run = createRun(5, meta);
    expect(run.maxHp).toBe(120);
    expect(run.hp).toBe(120);
    expect(run.shards).toBe(30);
  });

  it('nextGoal points at the cheapest reachable rank', () => {
    const p = createProfile();
    expect(nextGoal(p)?.nodeId).toBe('vitality');
    expect(nextGoal(p)?.ember).toBe(30);
  });
});

describe('earnings and run records', () => {
  it('pays Glut for rooms and kills, Rissstaub only for elites and bosses', () => {
    const r = META_REWARDS;
    const lost = runEarnings({ combat: 3, elite: 1, boss: 0 }, 20, false);
    expect(lost.ember).toBe(
      3 * r.emberPerRoom + r.emberPerElite + Math.floor(20 / r.killsPerEmber),
    );
    expect(lost.dust).toBe(r.dustPerElite);
    const won = runEarnings({ combat: 5, elite: 1, boss: 1 }, 80, true);
    expect(won.dust).toBe(r.dustPerElite + r.dustPerBoss);
    expect(won.ember).toBeGreaterThan(lost.ember + r.emberWinBonus);
  });

  it('records runs into the profile', () => {
    const p = createProfile();
    recordRun(p, {
      result: 'won',
      roomsCleared: 8,
      kills: 90,
      timeSec: 600,
      worldId: 'ember_wastes',
      unlockedWorlds: [],
      materials: {},
      killedBy: null,
      dominant: 'ignara',
      reachedBoss: true,
      ember: 90,
      dust: 4,
    });
    expect([p.runs, p.wins, p.bestRooms, p.ember, p.dust]).toEqual([1, 1, 8, 90, 4]);
  });
});

describe('relic unlocks at Nix', () => {
  it('locked relics never appear in offers, shops or events until unlocked', () => {
    const p = createProfile();
    const locked = lockedRelics(p);
    expect(locked.length).toBeGreaterThan(0);
    for (let node = 0; node < 60; node++) {
      for (const id of rollRelicOffer(3, node, 2, locked)) expect(locked).not.toContain(id);
    }
    const run = createRun(3, undefined, locked);
    for (let node = 0; node < 40; node++) {
      for (const item of shopStock(run, { id: node })) {
        if (item.kind === 'relic') expect(locked).not.toContain(item.id);
      }
    }
    p.dust = 100;
    const id = locked[0] as string;
    expect(unlockRelic(p, id)).toBe(true);
    expect(lockedRelics(p)).not.toContain(id);
    expect(unlockRelic(p, id)).toBe(false);
  });

  it('only relics with an unlock cost start locked', () => {
    const locked = new Set(lockedRelics(createProfile()));
    for (const r of RELICS) expect(locked.has(r.id)).toBe(r.unlockCost !== undefined);
  });
});

describe('boon reroll', () => {
  it('spends a charge and yields a different but reproducible offer', () => {
    const run = createRun(11, { ...runMetaFor(createProfile()), rerolls: 1 });
    run.rerolls = 1;
    // A node whose reward is a boon (rewards are seeded per node).
    let node = { id: 0, layer: 1, x: 0.5, type: 'combat' as const, next: [] as number[] };
    while (!offerFor(run, node)) node = { ...node, id: node.id + 1 };
    const before = offerFor(run, node);
    expect(rerollOffer(run)).toBe(true);
    const after = offerFor(run, node);
    expect(after).toEqual(offerFor(run, node));
    expect(after?.options.map((o) => o.id)).not.toEqual(before?.options.map((o) => o.id));
    expect(rerollOffer(run)).toBe(false);
  });
});

describe('hub dialogue', () => {
  it('introduces both characters on the first visit, then reacts to the last run', () => {
    const p = createProfile();
    const maren = pickLine(p, 'maren');
    expect(maren?.id).toBe('maren_intro');
    if (maren) markSeen(p, maren);
    expect(p.flags).toContain('met_maren');
    expect(pickLine(p, 'nix')?.id).toBe('nix_intro');
    recordRun(p, {
      result: 'lost',
      roomsCleared: 2,
      kills: 10,
      timeSec: 120,
      worldId: 'ember_wastes',
      unlockedWorlds: [],
      materials: {},
      killedBy: 'brute',
      dominant: null,
      reachedBoss: false,
      ember: 10,
      dust: 0,
    });
    expect(pickLine(p, 'maren')?.id).toBe('maren_first_death');
  });

  it('never repeats a once-line and falls back to fillers', () => {
    const p = createProfile();
    for (let visit = 0; visit < 40; visit++) {
      const line = pickLine(p, 'maren');
      expect(line).not.toBeNull();
      if (!line) break;
      if (line.once) expect(p.seenDialogue).not.toContain(line.id);
      markSeen(p, line);
      p.runs++;
    }
    expect(pickLine(p, 'maren')?.once).toBe(false);
  });

  it('has text for every line in every locale', async () => {
    const { LOCALES } = await import('../../shared/i18n');
    for (const table of Object.values(LOCALES)) {
      const strings = table as Record<string, string>;
      for (const line of DIALOGUE) expect(strings[`dialogue.${line.id}`], line.id).toBeTruthy();
      for (const node of EMBER_TREE) {
        expect(strings[`tree.${node.id}.name`], node.id).toBeTruthy();
        expect(strings[`tree.${node.id}.desc`], node.id).toBeTruthy();
      }
    }
  });
});

describe('story dialogue conditions (M5.7)', () => {
  it('reacts to finished and active quests and rebuilt buildings', () => {
    const p = createProfile();
    p.flags.push('met_maren');
    p.seenDialogue.push('maren_intro');
    expect(pickLine(p, 'maren')?.id).not.toBe('maren_quest_forge');
    p.quests.done.push('story_rekindle_forge');
    expect(pickLine(p, 'maren')?.id).toBe('maren_quest_forge');
    p.seenDialogue.push('maren_quest_forge');
    p.quests.active.push('story_twin_fire');
    expect(pickLine(p, 'maren')?.id).toBe('maren_twins_active');
    p.seenDialogue.push('maren_twins_active');
    p.buildings.forge = 1;
    expect(pickLine(p, 'maren')?.id).toBe('maren_forge_built');
  });

  it('only refers to quests and buildings that exist', async () => {
    const { QUESTS } = await import('../../content/quests');
    const { BUILDINGS } = await import('../../content/hub/buildings');
    const quests = new Set(QUESTS.map((q) => q.id));
    const buildings = new Set(BUILDINGS.map((b) => b.id));
    for (const { id, when } of DIALOGUE) {
      if (when?.questDone) expect(quests.has(when.questDone), id).toBe(true);
      if (when?.questActive) expect(quests.has(when.questActive), id).toBe(true);
      if (when?.building) expect(buildings.has(when.building), id).toBe(true);
    }
  });
});

describe("Sel's rune tower (M3.6)", () => {
  it('unlocks a spell for ember and dust, once', () => {
    const p = rich();
    const cost = spellUnlockCost(p, 'meteor');
    expect(unlockSpell(p, 'meteor')).toBe(true);
    expect(p.ember).toBe(10_000 - cost.ember);
    expect(p.dust).toBe(100 - cost.dust);
    expect(canUnlockSpell(p, 'meteor')).toBe('maxed');
    expect(canUnlockSpell(createProfile(), 'meteor')).toBe('ember');
    expect(canUnlockSpell(p, 'nope')).toBe('unknown');
  });

  it('spells found in a run cost half', () => {
    const p = rich();
    const full = spellUnlockCost(p, 'meteor');
    const run = createRun(1, runMetaFor(p), [], {
      active: { id: 'meteor', level: 2, branches: [] },
      aura: { id: 'halo', level: 1, branches: [] },
    });
    discoverRunSpells(p, run);
    expect(p.spellsDiscovered).toEqual(['meteor', 'halo']);
    expect(spellUnlockCost(p, 'meteor')).toEqual({
      ember: Math.ceil(full.ember / 2),
      dust: Math.ceil(full.dust / 2),
    });
    unlockSpell(p, 'meteor');
    expect(p.spellsDiscovered).toEqual(['halo']);
  });

  it('the loadout only takes unlocked spells, each into its own slot', () => {
    const p = rich();
    expect(equipLoadout(p, 'halo')).toBe(false);
    unlockSpell(p, 'halo');
    unlockSpell(p, 'light_lance');
    expect(equipLoadout(p, 'halo')).toBe(true);
    expect(equipLoadout(p, 'light_lance')).toBe(true);
    const slots = startSpellsFor(p);
    expect(slots.active?.id).toBe('light_lance');
    expect(slots.aura?.id).toBe('halo');
  });

  it('rune lore starts the active spell one level higher', () => {
    const p = rich();
    expect(startSpellsFor(p).active?.level).toBe(1);
    expect(buyRank(p, 'rune_lore')).toBe(true);
    expect(startSpellsFor(p).active?.level).toBe(2);
    expect(startSpellsFor(p).aura?.level).toBe(1);
  });
});
