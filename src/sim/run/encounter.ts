import { ENEMIES } from '../../content/enemies';
import type { BiomeDef, RoomType } from '../../content/schema';
import { nextFloat, type Rng } from '../rng/rng';

export type Encounter =
  | { kind: 'waves'; waves: number[][] }
  | { kind: 'horde'; durationSec: number; spawnIntervalSec: number; pool: number[] }
  | { kind: 'none' };

function fillWave(
  rng: Rng,
  biome: BiomeDef,
  budget: number,
  layer: number,
  mustInclude?: number,
): number[] {
  const wave: number[] = [];
  let left = budget;
  if (mustInclude !== undefined) {
    wave.push(mustInclude);
    left -= ENEMIES[mustInclude]?.waveCost ?? 0;
  }
  // minWave doubles as "unlocks at map layer" so early rooms stay simple.
  const pool = biome.enemyPool.filter((t) => (ENEMIES[t]?.minWave ?? 1) <= layer + 1);
  while (left > 0) {
    const affordable = pool.filter((t) => (ENEMIES[t]?.waveCost ?? Infinity) <= left);
    if (affordable.length === 0) break;
    const type = affordable[Math.floor(nextFloat(rng) * affordable.length)] as number;
    wave.push(type);
    left -= ENEMIES[type]?.waveCost ?? left;
  }
  if (wave.length === 0 && pool[0] !== undefined) wave.push(pool[0]);
  return wave;
}

/** Turns a map node into concrete enemy waves (budget grows with the layer, GDD §9). */
export function buildEncounter(
  rng: Rng,
  biome: BiomeDef,
  type: RoomType,
  layer: number,
): Encounter {
  const budget = biome.combatBudgetBase + biome.combatBudgetPerLayer * layer;
  const bruteType = biome.enemyPool.find((t) => ENEMIES[t]?.id === 'brute');
  switch (type) {
    case 'combat': {
      const waves = layer < 2 ? 2 : 3;
      return {
        kind: 'waves',
        waves: Array.from({ length: waves }, () => fillWave(rng, biome, budget / waves + 1, layer)),
      };
    }
    case 'elite': {
      const total = budget * biome.eliteBudgetFactor;
      return {
        kind: 'waves',
        waves: [
          fillWave(rng, biome, total / 2, layer, bruteType),
          fillWave(rng, biome, total / 2, layer),
        ],
      };
    }
    case 'boss':
      // Placeholder until the Glutwächter arrives (ROADMAP M2.5): a hard final gauntlet.
      return {
        kind: 'waves',
        waves: [
          fillWave(rng, biome, biome.bossBudget / 3, layer, bruteType),
          fillWave(rng, biome, biome.bossBudget / 3, layer, bruteType),
          fillWave(rng, biome, biome.bossBudget / 3, layer, bruteType),
        ],
      };
    case 'horde':
      return {
        kind: 'horde',
        durationSec: biome.hordeDurationSec,
        spawnIntervalSec: biome.hordeSpawnIntervalSec,
        pool: biome.enemyPool.filter((t) => ENEMIES[t]?.role !== 'bruiser'),
      };
    case 'rest':
    case 'altar':
    case 'shop':
    case 'event':
      return { kind: 'none' };
  }
}
