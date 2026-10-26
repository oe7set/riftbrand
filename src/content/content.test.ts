import { describe, expect, it } from 'vitest';
import { ENEMIES, ENEMY_TYPE } from './enemies';
import { PUZZLES } from './puzzles';
import { ENEMY_RIGS, PLAYER_RIG_ID, RIGS, rigIndex } from './rigs';
import { enemySchema, rigSchema, weaponSchema } from './schema';
import { exportTunablesDiff, resetTunables, tunableGroups } from './tunables';
import { BRAND_BLADE } from './weapons/brand-blade';

describe('content', () => {
  it('validates all enemies and weapons', () => {
    for (const def of ENEMIES) expect(() => enemySchema.parse(def)).not.toThrow();
    expect(() => weaponSchema.parse(BRAND_BLADE)).not.toThrow();
  });

  it('has unique enemy ids that match the type table', () => {
    const ids = ENEMIES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [name, index] of Object.entries(ENEMY_TYPE)) expect(ENEMIES[index]?.id).toBe(name);
  });

  it('enforces the fairness rules (GDD §4.6)', () => {
    const tooFast = structuredClone(ENEMIES[ENEMY_TYPE.slag]);
    if (tooFast) tooFast.attack.windupSec = 0.2;
    expect(() => enemySchema.parse(tooFast)).toThrow();
  });

  it('has valid rigs within the part budgets (ROADMAP M4)', () => {
    const ids = RIGS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const rig of RIGS) expect(() => rigSchema.parse(rig)).not.toThrow();
    expect(rigIndex(PLAYER_RIG_ID)).toBeGreaterThanOrEqual(0);
    for (const [enemyId, rigId] of Object.entries(ENEMY_RIGS)) {
      const enemy = ENEMIES.find((e) => e.id === enemyId);
      expect(enemy, enemyId).toBeDefined();
      const rig = RIGS[rigIndex(rigId)];
      expect(rig, rigId).toBeDefined();
      // At most 8 parts for standard enemies, 20 for bosses and champions.
      const budget = enemy?.role === 'boss' || enemy?.role === 'champion' ? 20 : 8;
      expect(rig?.parts.length ?? 99).toBeLessThanOrEqual(budget);
    }
  });

  it('exports tunable changes as code and resets them', () => {
    expect(tunableGroups().length).toBeGreaterThan(5);
    const hit = BRAND_BLADE.combo[0];
    if (!hit) throw new Error('missing combo hit');
    hit.damage = 99;
    expect(exportTunablesDiff()).toContain('damage: 99');
    resetTunables();
    expect(hit.damage).toBe(12);
    expect(exportTunablesDiff()).toBe('// No tuning changes.');
  });
});

describe('boon content', () => {
  it('has unique ids, names and descriptions in every locale, and resolvable placeholders', async () => {
    const { BOONS, boonDescParams } = await import('./boons');
    const { LOCALES } = await import('../shared/i18n');
    const ids = BOONS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const boon of BOONS) {
      for (const [locale, table] of Object.entries(LOCALES)) {
        const strings = table as Record<string, string>;
        const name = strings[`boon.${boon.id}.name`];
        const desc = strings[`boon.${boon.id}.desc`];
        expect(name, `${locale} ${boon.id}`).toBeTruthy();
        expect(desc, `${locale} ${boon.id}`).toBeTruthy();
        const params = boonDescParams(boon, 'common');
        for (const placeholder of desc?.match(/\{(\w+)\}/g) ?? []) {
          expect(params[placeholder.slice(1, -1)], `${boon.id} ${placeholder}`).toBeDefined();
        }
      }
    }
  });
});

describe('relic and event content', () => {
  it('has texts for every relic, event and option in every locale', async () => {
    const { RELICS, relicDescParams } = await import('./relics');
    const { EVENTS } = await import('./events');
    const { LOCALES } = await import('../shared/i18n');
    for (const table of Object.values(LOCALES)) {
      const strings = table as Record<string, string>;
      for (const relic of RELICS) {
        expect(strings[`relic.${relic.id}.name`], relic.id).toBeTruthy();
        const desc = strings[`relic.${relic.id}.desc`] ?? '';
        const params = relicDescParams(relic, 1);
        for (const ph of desc.match(/\{(\w+)\}/g) ?? [])
          expect(params[ph.slice(1, -1)], `${relic.id} ${ph}`).toBeDefined();
      }
      for (const event of EVENTS) {
        expect(strings[`event.${event.id}.title`], event.id).toBeTruthy();
        expect(strings[`event.${event.id}.text`], event.id).toBeTruthy();
        for (const o of event.options)
          expect(strings[`event.${event.id}.${o.id}`], `${event.id}.${o.id}`).toBeTruthy();
      }
      for (const puzzle of PUZZLES) {
        expect(strings[`puzzle.${puzzle.id}.name`], puzzle.id).toBeTruthy();
        expect(strings[`puzzle.${puzzle.id}.hint`], puzzle.id).toBeTruthy();
      }
    }
  });
});

describe('duo boons and evolutions', () => {
  it('has unique spells with texts in every locale and valid start spells', async () => {
    const { SPELLS, START_SPELLS, spellById } = await import('./spells');
    const { LOCALES } = await import('../shared/i18n');
    expect(new Set(SPELLS.map((s) => s.id)).size).toBe(SPELLS.length);
    expect(spellById(START_SPELLS.active)?.kind).toBe('active');
    expect(spellById(START_SPELLS.aura)?.kind).toBe('aura');
    for (const spell of SPELLS) {
      for (const table of Object.values(LOCALES)) {
        const strings = table as Record<string, string>;
        expect(strings[`spell.${spell.id}.name`], spell.id).toBeTruthy();
        expect(strings[`spell.${spell.id}.desc`], spell.id).toBeTruthy();
      }
    }
  });

  it('has a text for every upgrade branch of every spell and the rift shot', async () => {
    const { SPELLS } = await import('./spells');
    const { RIFT_SHOT_UPGRADES } = await import('./abilities');
    const { LOCALES } = await import('../shared/i18n');
    const trees = [RIFT_SHOT_UPGRADES, ...SPELLS.map((s) => s.upgrades)];
    for (const tree of trees) {
      const ids = [...tree.tier3, ...tree.tier5].map((b) => b.id);
      expect(new Set(ids).size, ids.join()).toBe(ids.length);
      for (const id of ids) {
        for (const table of Object.values(LOCALES)) {
          const strings = table as Record<string, string>;
          expect(strings[`upgrade.${id}.name`], id).toBeTruthy();
          expect(strings[`upgrade.${id}.desc`], id).toBeTruthy();
        }
      }
    }
  });

  it('reference existing boons and relics and have texts in every locale', async () => {
    const { BOONS, boonById } = await import('./boons');
    const { EVOLUTIONS } = await import('./evolutions');
    const { relicById } = await import('./relics');
    const { BRAND_BLADE } = await import('./weapons/brand-blade');
    const { LOCALES } = await import('../shared/i18n');
    for (const duo of BOONS.filter((b) => b.partner)) {
      for (const group of duo.requires ?? []) {
        for (const id of group) {
          const def = boonById(id);
          expect(def, `${duo.id} requires ${id}`).toBeDefined();
          // Every prerequisite belongs to one of the two beings and is not itself a duo.
          expect([duo.being, duo.partner]).toContain(def?.being);
          expect(def?.partner).toBeUndefined();
        }
      }
    }
    for (const evo of EVOLUTIONS) {
      expect(evo.weapon).toBe(BRAND_BLADE.id);
      for (const id of evo.requires.boons) expect(boonById(id), `${evo.id} ${id}`).toBeDefined();
      for (const id of evo.requires.relics) expect(relicById(id), `${evo.id} ${id}`).toBeDefined();
      for (const table of Object.values(LOCALES)) {
        const strings = table as Record<string, string>;
        expect(strings[`evolution.${evo.id}.name`], evo.id).toBeTruthy();
        expect(strings[`evolution.${evo.id}.desc`], evo.id).toBeTruthy();
      }
    }
  });
});
