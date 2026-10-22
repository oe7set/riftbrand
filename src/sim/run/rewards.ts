import { BOONS, boonById, RARITIES, RARITY_WEIGHTS } from '../../content/boons';
import { BEING_IDS } from '../../content/boons/beings';
import type { BeingId, BoonDef, Rarity, RoomType } from '../../content/schema';
import type { OwnedBoon } from '../effects/build';
import { createRng, hashString, nextFloat, nextInt, type Rng } from '../rng/rng';

export const OFFER_SIZE = 3;

export interface BoonOption {
  id: string;
  rarity: Rarity;
  /** Id of the owned boon this one would replace (same slot), if any. */
  replaces: string | null;
}

export interface BoonOffer {
  being: BeingId;
  options: BoonOption[];
}

/** Nodes that grant a boon, and how much the rarity roll is shifted upwards. */
export function rewardRarityBonus(type: RoomType): number | null {
  switch (type) {
    case 'combat':
    case 'horde':
      return 0;
    case 'elite':
      return 1;
    case 'altar':
      return 1;
    default:
      return null;
  }
}

/** Which being rewards a node; deterministic per run seed and node. */
export function rewardBeing(seed: number, nodeId: number): BeingId {
  const rng = createRng(hashString(`${seed}:being:${nodeId}`));
  return BEING_IDS[nextInt(rng, 0, BEING_IDS.length)] as BeingId;
}

function rollRarity(rng: Rng, bonus: number): Rarity {
  const w = RARITY_WEIGHTS;
  // Each bonus step moves weight from common into the higher tiers.
  const common = Math.max(5, w.common - bonus * 30);
  const weights = [common, w.rare + bonus * 15, w.epic + bonus * 11, w.heroic + bonus * 4];
  let total = 0;
  for (const x of weights) total += x;
  let roll = nextFloat(rng) * total;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i] as number;
    if (roll < 0) return RARITIES[i] as Rarity;
  }
  return 'common';
}

/**
 * Three different boons of one being (GDD §7.1). Passive boons the player already owns are
 * excluded; slot boons may replace the current one in that slot.
 */
export function rollBoonOffer(
  seed: number,
  nodeId: number,
  being: BeingId,
  owned: readonly OwnedBoon[],
  rarityBonus: number,
): BoonOffer {
  const rng = createRng(hashString(`${seed}:offer:${nodeId}`));
  const ownedIds = new Set(owned.map((b) => b.id));
  const pool: BoonDef[] = BOONS.filter((b) => b.being === being && !ownedIds.has(b.id));
  const options: BoonOption[] = [];
  while (options.length < OFFER_SIZE && pool.length > 0) {
    const [boon] = pool.splice(nextInt(rng, 0, pool.length), 1);
    if (!boon) break;
    const current =
      boon.slot === 'passive' ? undefined : owned.find((o) => boonById(o.id)?.slot === boon.slot);
    options.push({
      id: boon.id,
      rarity: rollRarity(rng, rarityBonus),
      replaces: current?.id ?? null,
    });
  }
  return { being, options };
}

/** Adds a boon, replacing whatever occupied its slot (attack/special/dash). */
export function addBoon(boons: OwnedBoon[], pick: { id: string; rarity: Rarity }): OwnedBoon[] {
  const def = boonById(pick.id);
  if (!def) return boons;
  const kept = boons.filter((b) => {
    if (b.id === pick.id) return false;
    return def.slot === 'passive' || boonById(b.id)?.slot !== def.slot;
  });
  return [...kept, { id: pick.id, rarity: pick.rarity }];
}
