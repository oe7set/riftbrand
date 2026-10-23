import { BOONS, boonById, boonsOf, DUO_OFFER, RARITIES, RARITY_WEIGHTS } from '../../content/boons';
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

/** Duo boons whose prerequisites the build meets and that are not owned yet. */
export function unlockedDuos(being: BeingId, owned: readonly OwnedBoon[]): BoonDef[] {
  const ownedIds = new Set(owned.map((b) => b.id));
  return BOONS.filter(
    (b) =>
      b.partner !== undefined &&
      (b.being === being || b.partner === being) &&
      !ownedIds.has(b.id) &&
      (b.requires ?? []).every((group) => group.some((id) => ownedIds.has(id))),
  );
}

/** Duos have fixed values; they are shown at this rarity. */
export const DUO_RARITY: Rarity = 'epic';

/**
 * Three different boons of one being (GDD §7.1). Passive boons the player already owns are
 * excluded; slot boons may replace the current one in that slot. An unlocked duo may take
 * the last spot.
 */
export function rollBoonOffer(
  seed: number,
  nodeId: number,
  being: BeingId,
  owned: readonly OwnedBoon[],
  rarityBonus: number,
  /** Bumped by a reroll (Ember Tree), so the new offer differs but stays reproducible. */
  salt = 0,
): BoonOffer {
  const rng = createRng(
    hashString(salt === 0 ? `${seed}:offer:${nodeId}` : `${seed}:offer:${nodeId}:${salt}`),
  );
  const ownedIds = new Set(owned.map((b) => b.id));
  const pool: BoonDef[] = boonsOf(being).filter((b) => !ownedIds.has(b.id));
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
  // Drawn after the regular options so existing offers stay the same for a given seed.
  const duos = unlockedDuos(being, owned);
  if (duos.length > 0 && nextFloat(rng) < DUO_OFFER.chance) {
    const duo = duos[nextInt(rng, 0, duos.length)] as BoonDef;
    const option = { id: duo.id, rarity: DUO_RARITY, replaces: null };
    if (options.length < OFFER_SIZE) options.push(option);
    else options[options.length - 1] = option;
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
