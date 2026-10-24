import { type BuildingDef, type DecorationDef, defineBuilding, defineDecoration } from '../schema';

/**
 * Building sites in the refuge (ROADMAP M5.3). Level 0 is a ruin (forge, map table, archive) or
 * the plain version of a place that already works; levels 1 and 2 cost materials and Rissstaub.
 * Text in `building.<id>.name` / `.desc` and `building.<id>.level1` / `.level2`.
 */
export const BUILDINGS: readonly BuildingDef[] = [
  defineBuilding({
    id: 'forge',
    ruin: true,
    levels: [
      { cost: { dust: 2, materials: { slag_iron: 5 } }, unlocks: ['armor'] },
      { cost: { dust: 6, materials: { slag_iron: 8, ember_core: 3 } }, unlocks: ['armor_mastery'] },
    ],
  }),
  defineBuilding({
    id: 'map_table',
    ruin: true,
    levels: [
      { cost: { dust: 2, materials: { slag_iron: 3, ember_core: 1 } }, unlocks: ['world_intel'] },
      { cost: { dust: 5, materials: { slag_iron: 4, ember_core: 3 } }, unlocks: ['daily_seeds'] },
    ],
  }),
  defineBuilding({
    id: 'archive',
    ruin: true,
    levels: [
      { cost: { dust: 3, materials: { ember_core: 2 } }, unlocks: ['codex'] },
      { cost: { dust: 6, materials: { slag_iron: 4, ember_core: 4 } }, unlocks: ['lore'] },
    ],
  }),
  defineBuilding({
    id: 'market',
    ruin: false,
    levels: [
      { cost: { dust: 2, materials: { slag_iron: 4 } }, unlocks: [] },
      { cost: { dust: 4, materials: { slag_iron: 6, ember_core: 2 } }, unlocks: [] },
    ],
  }),
  defineBuilding({
    id: 'rune_tower',
    ruin: false,
    levels: [
      { cost: { dust: 2, materials: { slag_iron: 2, ember_core: 2 } }, unlocks: [] },
      { cost: { dust: 4, materials: { slag_iron: 4, ember_core: 4 } }, unlocks: [] },
    ],
  }),
  defineBuilding({
    id: 'campfire',
    ruin: false,
    levels: [
      { cost: { dust: 1, materials: { slag_iron: 3 } }, unlocks: ['decorations'] },
      { cost: { dust: 4, materials: { slag_iron: 5, ember_core: 2 } }, unlocks: [] },
    ],
  }),
];

export function buildingById(id: string): BuildingDef | undefined {
  return BUILDINGS.find((b) => b.id === id);
}

/** Cosmetic decorations, bought at the campfire once it is built up (`decorations`). */
export const DECORATIONS: readonly DecorationDef[] = [
  defineDecoration({
    id: 'lantern_path',
    kind: 'lantern',
    x: 700,
    y: 420,
    cost: { dust: 1, materials: { slag_iron: 2 } },
    color: 0xffd36b,
  }),
  defineDecoration({
    id: 'ember_flowers',
    kind: 'flowers',
    x: 540,
    y: 760,
    cost: { dust: 1, materials: { ember_core: 1 } },
    color: 0xff7a2e,
  }),
  defineDecoration({
    id: 'portal_banner',
    kind: 'banner',
    x: 610,
    y: 330,
    cost: { dust: 2, materials: { slag_iron: 2 } },
    color: 0x7ff6ff,
  }),
  defineDecoration({
    id: 'rune_crystal',
    kind: 'crystal',
    x: 880,
    y: 300,
    cost: { dust: 2, materials: { ember_core: 2 } },
    color: 0xb8a6ff,
  }),
];

export function decorationById(id: string): DecorationDef | undefined {
  return DECORATIONS.find((d) => d.id === id);
}
