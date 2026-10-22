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
