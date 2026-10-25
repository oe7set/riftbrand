import {
  COSMETICS,
  cosmeticById,
  DEFAULT_CAPE,
  MARKET,
  TRADES,
  tradeById,
} from '../../content/hub/market';
import { createRng, hashString, nextInt } from '../rng/rng';
import type { Profile } from './profile';
import { type CostCheck, canAfford, pay } from './refuge';

export interface WeeklyOffer {
  trades: string[];
  capes: string[];
}

/** Picks `count` distinct entries, deterministically from the rng. */
function pickDistinct(ids: readonly string[], count: number, seed: number): string[] {
  const rng = createRng(seed);
  const pool = [...ids];
  const out: string[] = [];
  while (out.length < count && pool.length > 0) {
    out.push(pool.splice(nextInt(rng, 0, pool.length), 1)[0] as string);
  }
  return out;
}

/**
 * Nix's offer for a week (ROADMAP M5.5): the same for every player in the same week, from the
 * week number alone. The app derives the week from the date; this stays pure.
 */
export function weeklyOffer(week: number): WeeklyOffer {
  return {
    trades: pickDistinct(
      TRADES.map((t) => t.id),
      MARKET.tradesPerWeek,
      hashString(`market:trades:${week}`),
    ),
    capes: pickDistinct(
      COSMETICS.filter((c) => c.ember > 0).map((c) => c.id),
      MARKET.capesPerWeek,
      hashString(`market:capes:${week}`),
    ),
  };
}

/** A new week clears what was bought from the old offer. */
export function syncMarketWeek(profile: Profile, week: number): void {
  if (profile.market.week === week) return;
  profile.market = { week, bought: {} };
}

export function tradesLeft(profile: Profile, id: string): number {
  return Math.max(0, (tradeById(id)?.stock ?? 0) - (profile.market.bought[id] ?? 0));
}

export function canTrade(profile: Profile, id: string, week: number): CostCheck {
  const def = tradeById(id);
  if (!def) return 'unknown';
  if (!weeklyOffer(week).trades.includes(id)) return 'locked';
  if (profile.market.week === week && tradesLeft(profile, id) <= 0) return 'maxed';
  return canAfford(profile, def.give);
}

export function trade(profile: Profile, id: string, week: number): boolean {
  const def = tradeById(id);
  if (!def || canTrade(profile, id, week) !== 'ok') return false;
  syncMarketWeek(profile, week);
  pay(profile, def.give);
  profile.dust += def.get.dust;
  for (const [m, n] of Object.entries(def.get.materials)) {
    profile.materials[m] = (profile.materials[m] ?? 0) + n;
  }
  profile.market.bought[id] = (profile.market.bought[id] ?? 0) + 1;
  return true;
}

export function ownsCosmetic(profile: Profile, id: string): boolean {
  return id === DEFAULT_CAPE || profile.cosmetics.includes(id);
}

export function canBuyCosmetic(profile: Profile, id: string, week: number): CostCheck | 'ember' {
  const def = cosmeticById(id);
  if (!def) return 'unknown';
  if (ownsCosmetic(profile, id)) return 'owned';
  if (!weeklyOffer(week).capes.includes(id)) return 'locked';
  return profile.ember < def.ember ? 'ember' : 'ok';
}

/** Buys a cape and puts it on right away. */
export function buyCosmetic(profile: Profile, id: string, week: number): boolean {
  const def = cosmeticById(id);
  if (!def || canBuyCosmetic(profile, id, week) !== 'ok') return false;
  profile.ember -= def.ember;
  profile.cosmetics.push(id);
  profile.cape = id;
  return true;
}

export function wearCape(profile: Profile, id: string): boolean {
  if (!cosmeticById(id) || !ownsCosmetic(profile, id)) return false;
  profile.cape = id;
  return true;
}

/** Colour of the cape Vesper wears (falls back to the starting red). */
export function capeColor(profile: Profile): number {
  return (cosmeticById(profile.cape) ?? cosmeticById(DEFAULT_CAPE))?.color ?? 0xd94f4f;
}
