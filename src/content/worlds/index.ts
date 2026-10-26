import { EMBER_WASTES } from '../biomes/ember-wastes';
import { GLASS_SEA } from '../biomes/glass-sea';
import { type BiomeDef, defineWorld, type WorldDef } from '../schema';

/**
 * The world map (ROADMAP M5.2, GDD §3): one run leads through one world. The Ember Wastes and
 * the Glass Sea (M6.1) are built; the others show on the map with their unlock condition.
 */
export const WORLDS: readonly WorldDef[] = [
  defineWorld({
    id: 'ember_wastes',
    biome: EMBER_WASTES,
    bossName: 'ember_warden',
    unlock: { kind: 'start' },
    mapX: 0.2,
    mapY: 0.68,
    color: 0xff7a2e,
  }),
  defineWorld({
    id: 'glass_sea',
    biome: GLASS_SEA,
    bossName: 'mirror_queen',
    unlock: { kind: 'boss', world: 'ember_wastes' },
    mapX: 0.45,
    mapY: 0.3,
    color: 0x4fd8ff,
  }),
  defineWorld({
    id: 'storm_citadel',
    biome: null,
    bossName: null,
    unlock: { kind: 'boss', world: 'glass_sea' },
    mapX: 0.72,
    mapY: 0.62,
    color: 0xc07bff,
  }),
  defineWorld({
    id: 'the_rift',
    biome: null,
    bossName: null,
    unlock: { kind: 'boss', world: 'storm_citadel' },
    mapX: 0.86,
    mapY: 0.22,
    color: 0xff3d8a,
  }),
];

/** Runs saved before worlds existed took place here (run-save v9, profile v3). */
export const FIRST_WORLD_ID = 'ember_wastes';

export function worldById(id: string): WorldDef | undefined {
  return WORLDS.find((w) => w.id === id);
}

/** The biome a world's run is built from; unknown or unbuilt worlds fall back to the first. */
export function worldBiome(id: string): BiomeDef {
  return worldById(id)?.biome ?? EMBER_WASTES;
}
