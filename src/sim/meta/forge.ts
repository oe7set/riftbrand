import { ARMOR_SLOTS, armorById } from '../../content/armor';
import type { CostDef } from '../../content/schema';
import type { OwnedArmor } from '../effects/build';
import type { Profile } from './profile';
import { type CostCheck, canAfford, hasUnlock, pay } from './refuge';

/** Armour levels (ROADMAP M5.4); level 3 needs the expanded forge. */
export const MAX_ARMOR_LEVEL = 3;

export function armorLevel(profile: Profile, id: string): number {
  return profile.armor[id] ?? 0;
}

/** Highest level the forge can work to right now. */
export function forgeMaxLevel(profile: Profile): number {
  if (!hasUnlock(profile, 'armor')) return 0;
  return hasUnlock(profile, 'armor_mastery') ? MAX_ARMOR_LEVEL : MAX_ARMOR_LEVEL - 1;
}

/** Crafting (level 0 → 1) or improving a piece: what the next step costs, null at the top. */
export function nextArmorCost(profile: Profile, id: string): CostDef | null {
  const def = armorById(id);
  if (!def) return null;
  const level = armorLevel(profile, id);
  if (level === 0) return def.craftCost;
  return def.upgradeCosts[level - 1] ?? null;
}

export function canForge(profile: Profile, id: string): CostCheck {
  if (!armorById(id)) return 'unknown';
  if (!hasUnlock(profile, 'armor')) return 'locked';
  const cost = nextArmorCost(profile, id);
  if (!cost) return 'maxed';
  if (armorLevel(profile, id) >= forgeMaxLevel(profile)) return 'locked';
  return canAfford(profile, cost);
}

/** Crafts or improves a piece; a freshly crafted piece goes on if its slot is empty. */
export function forgeArmor(profile: Profile, id: string): boolean {
  const def = armorById(id);
  const cost = nextArmorCost(profile, id);
  if (!def || !cost || canForge(profile, id) !== 'ok') return false;
  pay(profile, cost);
  const level = armorLevel(profile, id) + 1;
  profile.armor[id] = level;
  if (level === 1 && !profile.equipped[def.slot]) profile.equipped[def.slot] = id;
  return true;
}

/** Puts an owned piece on (replacing the slot), or takes it off when it is already worn. */
export function toggleEquip(profile: Profile, id: string): boolean {
  const def = armorById(id);
  if (!def || armorLevel(profile, id) === 0) return false;
  if (profile.equipped[def.slot] === id) delete profile.equipped[def.slot];
  else profile.equipped[def.slot] = id;
  return true;
}

/** What a run snapshots at its start; unknown or unowned pieces are skipped. */
export function equippedArmor(profile: Profile): OwnedArmor[] {
  const out: OwnedArmor[] = [];
  for (const slot of ARMOR_SLOTS) {
    const id = profile.equipped[slot];
    if (!id) continue;
    const def = armorById(id);
    const level = armorLevel(profile, id);
    if (def?.slot === slot && level > 0) out.push({ id, level });
  }
  return out;
}
