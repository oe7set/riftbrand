import { ENEMY_TYPE } from '../enemies';
import { defineBiome } from '../schema';
import { registerTunables } from '../tunables';

/** Biome 1, Aschefelder (GDD §2.5). Room counts target a 6–8 minute run (ROADMAP M2). */
export const EMBER_WASTES = defineBiome({
  id: 'ember_wastes',
  layers: 8,
  minNodesPerLayer: 2,
  maxNodesPerLayer: 4,
  typeWeights: { combat: 55, elite: 14, horde: 14, rest: 10 },
  eliteMinLayer: 2,
  restMinLayer: 2,
  enemyPool: [ENEMY_TYPE.slag, ENEMY_TYPE.spitter, ENEMY_TYPE.brute],
  combatBudgetBase: 4,
  combatBudgetPerLayer: 1.2,
  eliteBudgetFactor: 1.6,
  bossBudget: 16,
  hordeDurationSec: 40,
  hordeSpawnIntervalSec: 1.4,
  restHealFraction: 0.4,
});

registerTunables('biome: ember wastes', 'src/content/biomes/ember-wastes.ts', EMBER_WASTES, {}, [
  'combatBudgetBase',
  'combatBudgetPerLayer',
  'eliteBudgetFactor',
  'bossBudget',
  'hordeDurationSec',
  'hordeSpawnIntervalSec',
  'restHealFraction',
]);
