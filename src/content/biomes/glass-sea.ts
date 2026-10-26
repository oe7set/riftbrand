import { ENEMY_TYPE } from '../enemies';
import { defineBiome } from '../schema';
import { registerTunables } from '../tunables';

/**
 * Biome 2, Gläserne See (GDD §2.5, ROADMAP M6.1): the first world played as a room net. Crystal
 * shooters, mirror knights and rime bells; the Spiegelfechterin or the Eiswal-Wächter guard the
 * locked wing, the Spiegelkönigin waits behind them. The path fields only matter if the world
 * is ever played as a path map.
 */
export const GLASS_SEA = defineBiome({
  id: 'glass_sea',
  layers: 8,
  minNodesPerLayer: 2,
  maxNodesPerLayer: 4,
  typeWeights: {
    combat: 44,
    elite: 13,
    horde: 8,
    rest: 8,
    altar: 10,
    shop: 9,
    event: 11,
    puzzle: 10,
  },
  eliteMinLayer: 2,
  duelMinLayer: 3,
  duelsMin: 1,
  duelsMax: 1,
  duelEncounters: [[ENEMY_TYPE.glass_fencer], [ENEMY_TYPE.ice_whale]],
  restMinLayer: 2,
  altarMinLayer: 1,
  shopMinLayer: 2,
  maxShops: 1,
  eventMinLayer: 1,
  puzzleMinLayer: 1,
  maxPuzzles: 2,
  enemyPool: [
    ENEMY_TYPE.glass_mite,
    ENEMY_TYPE.prism_spitter,
    ENEMY_TYPE.mirror_knight,
    ENEMY_TYPE.shard_golem,
    ENEMY_TYPE.frost_bell,
    ENEMY_TYPE.tide_priest,
  ],
  boss: ENEMY_TYPE.mirror_queen,
  elitesPerRoom: 2,
  combatBudgetBase: 8,
  combatBudgetPerLayer: 1.9,
  combatWavesEarly: 2,
  combatWavesLate: 3,
  combatWavesLateFromLayer: 2,
  eliteBudgetFactor: 1.6,
  bossBudget: 0,
  hordeDurationSec: 60,
  hordeSpawnIntervalSec: 1.4,
  restHealFraction: 0.4,
  net: { roomsMin: 12, roomsMax: 15, puzzles: 2, loops: 2, eliteChance: 0.3, shop: true },
});

registerTunables('biome: glass sea', 'src/content/biomes/glass-sea.ts', GLASS_SEA, {}, [
  'combatBudgetBase',
  'combatBudgetPerLayer',
  'combatWavesEarly',
  'combatWavesLate',
  'eliteBudgetFactor',
  'restHealFraction',
]);
