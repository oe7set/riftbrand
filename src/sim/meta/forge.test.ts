import { describe, expect, it } from 'vitest';
import { ARMOR, ARMOR_SLOTS } from '../../content/armor';
import { materialById } from '../../content/materials';
import { TUNING } from '../../content/tuning';
import { compileBuild, type OwnedArmor } from '../effects/build';
import { createRun } from '../run/run-state';
import {
  armorLevel,
  canForge,
  equippedArmor,
  forgeArmor,
  forgeMaxLevel,
  toggleEquip,
} from './forge';
import { createProfile, runMetaFor } from './profile';
import { addMaterials } from './refuge';

const EMBER_SET = ['ember_helm', 'ember_plate', 'ember_gauntlets', 'ember_greaves'];

function smith(forgeLevel = 1) {
  const p = createProfile();
  p.dust = 200;
  addMaterials(p, { slag_iron: 200, ember_core: 200 });
  p.buildings.forge = forgeLevel;
  return p;
}

const stats = (armor: OwnedArmor[]) => compileBuild([], [], [], armor).stats;

describe("Toll's forge (ROADMAP M5.4)", () => {
  it('needs the rebuilt forge; level 3 needs the expanded one', () => {
    const p = smith(0);
    expect(canForge(p, 'ember_helm')).toBe('locked');
    p.buildings.forge = 1;
    expect(forgeMaxLevel(p)).toBe(2);
    expect(forgeArmor(p, 'ember_helm')).toBe(true);
    expect(forgeArmor(p, 'ember_helm')).toBe(true);
    expect(armorLevel(p, 'ember_helm')).toBe(2);
    expect(canForge(p, 'ember_helm')).toBe('locked');
    p.buildings.forge = 2;
    expect(forgeArmor(p, 'ember_helm')).toBe(true);
    expect(canForge(p, 'ember_helm')).toBe('maxed');
  });

  it('crafting pays the cost and wears the piece if the slot is free', () => {
    const p = smith();
    const dust = p.dust;
    forgeArmor(p, 'ember_helm');
    expect(p.dust).toBe(dust - 1);
    expect(p.equipped.head).toBe('ember_helm');
    forgeArmor(p, 'frost_hood');
    expect(p.equipped.head).toBe('ember_helm');
    toggleEquip(p, 'frost_hood');
    expect(p.equipped.head).toBe('frost_hood');
    toggleEquip(p, 'frost_hood');
    expect(p.equipped.head).toBeUndefined();
    expect(toggleEquip(p, 'ember_plate')).toBe(false);
  });

  it('values grow with the level', () => {
    expect(stats([{ id: 'ember_helm', level: 1 }]).maxHp).toBe(6);
    expect(stats([{ id: 'ember_helm', level: 3 }]).maxHp).toBe(12);
    expect(stats([{ id: 'ember_gauntlets', level: 2 }]).attackDamage).toBeCloseTo(0.09);
  });

  it('set bonuses need 2 and 4 pieces of the set', () => {
    const one = compileBuild([], [], [], [{ id: 'ember_helm', level: 1 }]);
    expect(one.stats.burnDamage).toBe(0);
    const two = compileBuild(
      [],
      [],
      [],
      EMBER_SET.slice(0, 2).map((id) => ({ id, level: 1 })),
    );
    expect(two.stats.burnDamage).toBeCloseTo(0.25);
    expect(two.stats.damageVsBurning).toBe(0);
    const four = compileBuild(
      [],
      [],
      [],
      EMBER_SET.map((id) => ({ id, level: 1 })),
    );
    expect(four.stats.damageVsBurning).toBeCloseTo(0.15);
    // The 4-piece trigger comes on top of the gauntlets' own chance to burn.
    expect(four.onHit.length).toBe(2);
  });

  it('armour power has a ceiling: the best loadout stays within planned bounds', () => {
    let maxHp = 0;
    let attack = 0;
    let speed = 0;
    for (const slot of ARMOR_SLOTS) {
      const best = (stat: 'maxHp' | 'attackDamage' | 'moveSpeed') =>
        Math.max(
          0,
          ...ARMOR.filter((a) => a.slot === slot).map((a) => stats([{ id: a.id, level: 3 }])[stat]),
        );
      maxHp += best('maxHp');
      attack += best('attackDamage');
      speed += best('moveSpeed');
    }
    expect(maxHp).toBeLessThanOrEqual(TUNING.playerMaxHp * 0.4);
    expect(attack).toBeLessThanOrEqual(0.15);
    expect(speed).toBeLessThanOrEqual(0.1);
  });

  it('a run snapshots the worn armour and starts with its extra health', () => {
    const p = smith();
    forgeArmor(p, 'ember_plate');
    expect(equippedArmor(p)).toEqual([{ id: 'ember_plate', level: 1 }]);
    const run = createRun(3, runMetaFor(p));
    expect(run.meta.armor).toEqual([{ id: 'ember_plate', level: 1 }]);
    expect(run.maxHp).toBe(TUNING.playerMaxHp + 10);
    expect(run.hp).toBe(run.maxHp);
    // Changing the gear later does not touch the running run.
    forgeArmor(p, 'ember_plate');
    expect(run.meta.armor[0]?.level).toBe(1);
  });

  it('content: one piece per slot in the set, costs name real materials', () => {
    const slots = ARMOR.filter((a) => a.set === 'ember_set').map((a) => a.slot);
    expect([...slots].sort()).toEqual([...ARMOR_SLOTS].sort());
    for (const a of ARMOR) {
      for (const cost of [a.craftCost, ...a.upgradeCosts]) {
        for (const m of Object.keys(cost.materials)) expect(materialById(m), m).toBeDefined();
      }
    }
  });
});
