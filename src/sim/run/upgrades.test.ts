import { afterEach, describe, expect, it } from 'vitest';
import { RIFT_SHOT, RIFT_SHOT_UPGRADES } from '../../content/abilities';
import { boonById, boonValue } from '../../content/boons';
import { LIGHT_LANCE } from '../../content/spells/light-lance';
import { METEOR } from '../../content/spells/meteor';
import { resetTunables } from '../../content/tunables';
import { TUNING } from '../../content/tuning';
import { applyUpgrade, rollUpgradeOffer } from './economy';
import { createRun } from './run-state';
import { branchTier, foldMods, MAX_UPGRADE_LEVEL, resolveCast, resolveSpell } from './upgrades';

afterEach(() => resetTunables());

describe('upgrade levels', () => {
  it('has branch choices exactly on levels 3 and 5', () => {
    expect([1, 2, 3, 4, 5].map(branchTier)).toEqual([null, null, 'tier3', null, 'tier5']);
  });

  it('adds per-level gains and the chosen branches', () => {
    const lvl2 = foldMods(RIFT_SHOT_UPGRADES, { level: 2, branches: [] });
    expect(lvl2.damageMult).toBeCloseTo(1 + TUNING.upgradeLevelDamage);
    expect(lvl2.count).toBe(0);
    const triple = foldMods(RIFT_SHOT_UPGRADES, { level: 5, branches: [0, 0] });
    expect(triple.count).toBe(2);
    const pierce = foldMods(RIFT_SHOT_UPGRADES, { level: 3, branches: [1] });
    expect(pierce.pierce).toBe(true);
  });

  it('resolves the rift shot: one, two, three shots', () => {
    expect(resolveCast({ level: 1, branches: [] }).shots).toBe(1);
    expect(resolveCast({ level: 3, branches: [0] }).shots).toBe(2);
    expect(resolveCast({ level: 5, branches: [0, 0] }).shots).toBe(3);
    expect(resolveCast({ level: 1, branches: [] }).damage).toBe(RIFT_SHOT.damage);
  });

  it('resolves spells with their branches', () => {
    const shower = resolveSpell('meteor', { level: 3, branches: [0] });
    const base = METEOR.effect.type === 'burst' ? METEOR.effect.radiusPx : 0;
    expect(shower?.extra).toBe(2);
    expect(shower?.radiusPx).toBeLessThan(base);
    const lance = resolveSpell('light_lance', { level: 5, branches: [0, 0] });
    expect(lance?.extra).toBe(2);
    expect(lance?.cooldownSec).toBeLessThan(LIGHT_LANCE.cooldownSec);
  });
});

describe('upgrade rewards', () => {
  it('offers spell, aura and rift shot levels, branch levels as a pair', () => {
    const run = createRun(41);
    const offer = rollUpgradeOffer(run, 3);
    expect(offer.length).toBeGreaterThanOrEqual(3);
    for (const o of offer) expect(o.kind).toBe('level');
    run.cast.level = 2;
    const withBranch = rollUpgradeOffer(run, 3);
    const castCards = withBranch.filter((o) => o.kind === 'level' && o.target === 'cast');
    expect([0, 2]).toContain(castCards.length);
  });

  it('applies levels and remembers the branch', () => {
    const run = createRun(42);
    applyUpgrade(run, { kind: 'level', target: 'cast', level: 2, branch: null });
    applyUpgrade(run, { kind: 'level', target: 'cast', level: 3, branch: 1 });
    expect(run.cast).toEqual({ level: 3, branches: [1] });
    // A stale card (wrong level) does nothing.
    applyUpgrade(run, { kind: 'level', target: 'cast', level: 3, branch: 0 });
    expect(run.cast).toEqual({ level: 3, branches: [1] });
  });

  it('levels boons up with diminishing value steps and stops at the cap', () => {
    const run = createRun(43);
    run.boons.push({ id: 'blazing_fury', rarity: 'common' });
    run.spells.active = { id: 'frost_nova', level: MAX_UPGRADE_LEVEL, branches: [0, 0] };
    run.spells.aura = { id: 'ember_mantle', level: MAX_UPGRADE_LEVEL, branches: [0, 0] };
    run.cast = { level: MAX_UPGRADE_LEVEL, branches: [0, 0] };
    const offer = rollUpgradeOffer(run, 7);
    expect(offer).toEqual([{ kind: 'boon', boonId: 'blazing_fury', level: 2 }]);
    applyUpgrade(run, offer[0] as (typeof offer)[number]);
    const def = boonById('blazing_fury');
    if (!def) throw new Error('missing boon');
    expect(boonValue(def, 'bonus', 'common', 2)).toBeGreaterThan(boonValue(def, 'bonus', 'common'));
    expect(boonValue(def, 'bonus', 'common', 2)).toBeLessThan(boonValue(def, 'bonus', 'epic'));
  });
});
