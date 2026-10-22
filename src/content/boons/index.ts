import type { BeingId, BoonDef, Rarity } from '../schema';
import { registerTunables } from '../tunables';
import { IGNARA_BOONS } from './ignara';
import { VAELIS_BOONS } from './vaelis';

export const BOONS: readonly BoonDef[] = [...IGNARA_BOONS, ...VAELIS_BOONS];

const byId = new Map(BOONS.map((b) => [b.id, b]));

export function boonById(id: string): BoonDef | undefined {
  return byId.get(id);
}

export function boonsOf(being: BeingId): BoonDef[] {
  return BOONS.filter((b) => b.being === being);
}

export const RARITIES: readonly Rarity[] = ['common', 'rare', 'epic', 'heroic'];

/** Base chances for an offer slot; elites and altars shift weight upwards (GDD §7.1). */
export const RARITY_WEIGHTS = { common: 60, rare: 28, epic: 10, heroic: 2 };

export function rarityIndex(rarity: Rarity): number {
  return RARITIES.indexOf(rarity);
}

/** Resolves a named boon value for a rarity. */
export function boonValue(boon: BoonDef, name: string, rarity: Rarity): number {
  const v = boon.values[name];
  if (!v) return 0;
  const raw = v.base + v.step * rarityIndex(rarity);
  return v.int ? Math.round(raw) : raw;
}

registerTunables('boons: rarity weights', 'src/content/boons/index.ts', RARITY_WEIGHTS);

/** Description parameters for i18n: every named value, formatted for the given rarity. */
export function boonDescParams(boon: BoonDef, rarity: Rarity): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [name, v] of Object.entries(boon.values)) {
    const value = boonValue(boon, name, rarity);
    params[name] = v.percent ? `${Math.round(value * 100)}%` : String(Math.round(value * 10) / 10);
  }
  return params;
}
