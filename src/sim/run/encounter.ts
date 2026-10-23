import { ELITES } from '../../content/elites';
import { ENEMIES } from '../../content/enemies';
import type { BiomeDef, RoomType } from '../../content/schema';
import { packEnemy } from '../enemy-code';
import { nextFloat, nextInt, type Rng } from '../rng/rng';

/** Wave entries are packed enemy codes (type + elite modifier, see sim/enemy-code). */
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

/**
 * Elite rooms (GDD §5.1): the anchor of the first wave becomes an elite, then random enemies of
 * later waves, each with a random modifier.
 */
function makeElites(rng: Rng, waves: number[][], count: number): void {
  let made = 0;
  for (let w = 0; w < waves.length && made < count; w++) {
    const wave = waves[w] as number[];
    if (wave.length === 0) continue;
    const i = w === 0 ? 0 : nextInt(rng, 0, wave.length);
    const mod = nextInt(rng, 0, ELITES.length) + 1;
    wave[i] = packEnemy(wave[i] as number, mod);
    made++;
  }
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
      const waves =
        layer < biome.combatWavesLateFromLayer ? biome.combatWavesEarly : biome.combatWavesLate;
      return {
        kind: 'waves',
        waves: Array.from({ length: waves }, () => fillWave(rng, biome, budget / waves + 1, layer)),
      };
    }
    case 'elite': {
      const total = budget * biome.eliteBudgetFactor;
      const waves = [
        fillWave(rng, biome, total / 2, layer, bruteType),
        fillWave(rng, biome, total / 2, layer),
      ];
      makeElites(rng, waves, biome.elitesPerRoom);
      return { kind: 'waves', waves };
    }
    case 'boss': {
      const first = [packEnemy(biome.boss)];
      if (biome.bossBudget > 0) first.push(...fillWave(rng, biome, biome.bossBudget, layer));
      return { kind: 'waves', waves: [first] };
    }
    case 'horde':
      return {
        kind: 'horde',
        durationSec: biome.hordeDurationSec,
        spawnIntervalSec: biome.hordeSpawnIntervalSec,
        // Hordes are about numbers: no slow bruisers, no healers dragging it out.
        pool: biome.enemyPool.filter((t) => {
          const role = ENEMIES[t]?.role;
          return role !== 'bruiser' && role !== 'support' && role !== 'boss';
        }),
      };
    case 'rest':
    case 'altar':
    case 'shop':
    case 'event':
      return { kind: 'none' };
  }
}
