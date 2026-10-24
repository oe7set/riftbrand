import { describe, expect, it } from 'vitest';
import { BUILDINGS, DECORATIONS } from '../../content/hub/buildings';
import { REFUGE } from '../../content/hub/layout';
import { materialById } from '../../content/materials';
import { createProfile } from './profile';
import {
  addMaterials,
  buildingInhabited,
  buildingLevel,
  buyDecoration,
  canBuyDecoration,
  canUpgradeBuilding,
  hasUnlock,
  refugeGrowth,
  upgradeBuilding,
} from './refuge';

function rich() {
  const p = createProfile();
  p.dust = 100;
  addMaterials(p, { slag_iron: 50, ember_core: 50 });
  return p;
}

describe('rebuilding the refuge (ROADMAP M5.3)', () => {
  it('a ruin is empty until built; building pays the cost and opens its feature', () => {
    const p = createProfile();
    expect(buildingInhabited(p, 'forge')).toBe(false);
    expect(canUpgradeBuilding(p, 'forge')).toBe('materials');
    addMaterials(p, { slag_iron: 5 });
    expect(canUpgradeBuilding(p, 'forge')).toBe('dust');
    p.dust = 3;
    expect(upgradeBuilding(p, 'forge')).toBe(true);
    expect(p.dust).toBe(1);
    expect(p.materials.slag_iron).toBe(0);
    expect(buildingLevel(p, 'forge')).toBe(1);
    expect(buildingInhabited(p, 'forge')).toBe(true);
    expect(hasUnlock(p, 'armor')).toBe(true);
    expect(hasUnlock(p, 'armor_traits')).toBe(false);
  });

  it('places that already work are inhabited at level 0', () => {
    const p = createProfile();
    expect(buildingInhabited(p, 'market')).toBe(true);
    expect(buildingInhabited(p, 'campfire')).toBe(true);
  });

  it('stops at level 2', () => {
    const p = rich();
    expect(upgradeBuilding(p, 'archive')).toBe(true);
    expect(upgradeBuilding(p, 'archive')).toBe(true);
    expect(canUpgradeBuilding(p, 'archive')).toBe('maxed');
    expect(upgradeBuilding(p, 'archive')).toBe(false);
    expect(buildingLevel(p, 'archive')).toBe(2);
  });

  it('growth counts every level of every building', () => {
    const p = rich();
    expect(refugeGrowth(p)).toBe(0);
    upgradeBuilding(p, 'campfire');
    expect(refugeGrowth(p)).toBeCloseTo(1 / (BUILDINGS.length * 2));
    for (const b of BUILDINGS) {
      p.buildings[b.id] = 2;
    }
    expect(refugeGrowth(p)).toBe(1);
  });

  it('decorations need the built campfire, cost once and stay cosmetic', () => {
    const p = rich();
    const id = DECORATIONS[0]?.id ?? '';
    expect(canBuyDecoration(p, id)).toBe('locked');
    upgradeBuilding(p, 'campfire');
    const dust = p.dust;
    expect(buyDecoration(p, id)).toBe(true);
    expect(p.dust).toBeLessThan(dust);
    expect(canBuyDecoration(p, id)).toBe('owned');
    expect(buyDecoration(p, id)).toBe(false);
  });

  it('content: costs name real materials, sites and decorations fit the refuge', () => {
    for (const b of BUILDINGS) {
      for (const level of b.levels) {
        for (const m of Object.keys(level.cost.materials)) expect(materialById(m), m).toBeDefined();
      }
      expect(
        REFUGE.stations.some((s) => s.building === b.id),
        b.id,
      ).toBe(true);
    }
    for (const d of DECORATIONS) {
      expect(d.x).toBeLessThan(REFUGE.widthPx);
      expect(d.y).toBeLessThan(REFUGE.heightPx);
      for (const m of Object.keys(d.cost.materials)) expect(materialById(m), m).toBeDefined();
    }
  });
});
