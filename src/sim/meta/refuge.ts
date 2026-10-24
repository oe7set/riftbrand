import { BUILDINGS, buildingById, decorationById } from '../../content/hub/buildings';
import type { CostDef } from '../../content/schema';
import type { Profile } from './profile';

/** Highest building level (ROADMAP M5.3): 0 ruin or plain, 1 built, 2 expanded. */
export const MAX_BUILDING_LEVEL = 2;

export type CostCheck = 'ok' | 'maxed' | 'owned' | 'dust' | 'materials' | 'locked' | 'unknown';

export function buildingLevel(profile: Profile, id: string): number {
  return profile.buildings[id] ?? 0;
}

export function canAfford(profile: Profile, cost: CostDef): 'ok' | 'dust' | 'materials' {
  for (const [id, n] of Object.entries(cost.materials)) {
    if ((profile.materials[id] ?? 0) < n) return 'materials';
  }
  return profile.dust < cost.dust ? 'dust' : 'ok';
}

export function pay(profile: Profile, cost: CostDef): void {
  profile.dust -= cost.dust;
  for (const [id, n] of Object.entries(cost.materials)) {
    profile.materials[id] = (profile.materials[id] ?? 0) - n;
  }
}

/** Cost of the next level, or null at the top. */
export function nextBuildingCost(profile: Profile, id: string): CostDef | null {
  return buildingById(id)?.levels[buildingLevel(profile, id)]?.cost ?? null;
}

export function canUpgradeBuilding(profile: Profile, id: string): CostCheck {
  if (!buildingById(id)) return 'unknown';
  const cost = nextBuildingCost(profile, id);
  return cost ? canAfford(profile, cost) : 'maxed';
}

export function upgradeBuilding(profile: Profile, id: string): boolean {
  const cost = nextBuildingCost(profile, id);
  if (!cost || canUpgradeBuilding(profile, id) !== 'ok') return false;
  pay(profile, cost);
  profile.buildings[id] = buildingLevel(profile, id) + 1;
  return true;
}

/** Whether a built level opened a feature, e.g. `world_intel` at the map table. */
export function hasUnlock(profile: Profile, flag: string): boolean {
  return BUILDINGS.some((b) =>
    b.levels.some((level, i) => i < buildingLevel(profile, b.id) && level.unlocks.includes(flag)),
  );
}

/** A ruin's figure only moves in once it is built. */
export function buildingInhabited(profile: Profile, id: string): boolean {
  const def = buildingById(id);
  return !def?.ruin || buildingLevel(profile, id) > 0;
}

/** How far the refuge has been rebuilt, 0..1: drives light and plants (GDD §2.3). */
export function refugeGrowth(profile: Profile): number {
  let sum = 0;
  for (const b of BUILDINGS) sum += Math.min(buildingLevel(profile, b.id), MAX_BUILDING_LEVEL);
  return sum / (BUILDINGS.length * MAX_BUILDING_LEVEL);
}

export function canBuyDecoration(profile: Profile, id: string): CostCheck {
  const def = decorationById(id);
  if (!def) return 'unknown';
  if (profile.decorations.includes(id)) return 'owned';
  if (!hasUnlock(profile, 'decorations')) return 'locked';
  return canAfford(profile, def.cost);
}

export function buyDecoration(profile: Profile, id: string): boolean {
  const def = decorationById(id);
  if (!def || canBuyDecoration(profile, id) !== 'ok') return false;
  pay(profile, def.cost);
  profile.decorations.push(id);
  return true;
}

/** Adds a run's materials to the stash; they survive death (ROADMAP M5.3). */
export function addMaterials(profile: Profile, found: Readonly<Record<string, number>>): void {
  for (const [id, n] of Object.entries(found)) {
    if (n > 0) profile.materials[id] = (profile.materials[id] ?? 0) + n;
  }
}
