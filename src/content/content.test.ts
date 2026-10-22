import { describe, expect, it } from 'vitest';
import { ENEMIES, ENEMY_TYPE } from './enemies';
import { enemySchema, weaponSchema } from './schema';
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
    }
  });
});
