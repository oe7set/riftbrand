import { defineMaterial, type MaterialDef } from './schema';
import { registerTunables } from './tunables';

/** Crafting materials per world (ROADMAP M5.3); text in `material.<id>.name`. */
export const MATERIALS: readonly MaterialDef[] = [
  defineMaterial({ id: 'slag_iron', world: 'ember_wastes', weight: 3, color: 0xa8b0c4 }),
  defineMaterial({ id: 'ember_core', world: 'ember_wastes', weight: 1, color: 0xff7a2e }),
  defineMaterial({ id: 'sea_glass', world: 'glass_sea', weight: 3, color: 0x4fd8ff }),
  defineMaterial({ id: 'frost_pearl', world: 'glass_sea', weight: 1, color: 0xe6f6ff }),
  defineMaterial({ id: 'storm_iron', world: 'storm_citadel', weight: 1, color: 0xc07bff }),
  defineMaterial({ id: 'rift_glass', world: 'the_rift', weight: 1, color: 0xff3d8a }),
];

export function materialById(id: string): MaterialDef | undefined {
  return MATERIALS.find((m) => m.id === id);
}

/**
 * How many materials a cleared room drops. Combat rooms only sometimes; elites, duels and the boss
 * always, so a good run pays for one building step (about 8–12 materials when won).
 */
export const MATERIAL_DROPS = {
  combatChance: 0.4,
  eliteMin: 1,
  eliteMax: 2,
  duelMin: 2,
  duelMax: 3,
  /** Puzzle rooms (ROADMAP M6.0) always pay a little: brains over blades. */
  puzzleMin: 1,
  puzzleMax: 2,
  bossMin: 3,
  bossMax: 4,
};

registerTunables('meta: material drops', 'src/content/materials.ts', MATERIAL_DROPS);
