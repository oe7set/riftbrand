import type { SpellDef } from '../schema';
import { registerTunables } from '../tunables';
import { EMBER_MANTLE } from './ember-mantle';
import { FROST_BREATH } from './frost-breath';
import { FROST_NOVA } from './frost-nova';
import { HALO } from './halo';
import { LIGHT_LANCE } from './light-lance';
import { METEOR } from './meteor';
import { PLAGUE_BREATH } from './plague-breath';
import { POISON_CLOUD } from './poison-cloud';

/**
 * Spells (ROADMAP M3.2): one active spell with a cooldown and one aura. The index is the
 * spell id stored in the sim (append only).
 */
export const SPELLS: readonly SpellDef[] = [
  FROST_NOVA,
  EMBER_MANTLE,
  METEOR,
  POISON_CLOUD,
  LIGHT_LANCE,
  FROST_BREATH,
  PLAGUE_BREATH,
  HALO,
];

export function spellIndex(id: string): number {
  return SPELLS.findIndex((s) => s.id === id);
}

/** How far ahead a spell reaches (aim range and preview); 0 = it centres on the player. */
export function spellReachPx(def: SpellDef): number {
  const fx = def.effect;
  if (fx.type === 'beam') return fx.lengthPx;
  if ((fx.type === 'burst' || fx.type === 'zone') && fx.at === 'target') return fx.rangePx;
  return 0;
}

/** Radius of the spell's area (half the width for beams), for previews and VFX. */
export function spellRadiusPx(def: SpellDef): number {
  const fx = def.effect;
  return fx.type === 'beam' ? fx.widthPx / 2 : fx.radiusPx;
}

export function spellById(id: string): SpellDef | undefined {
  return SPELLS.find((s) => s.id === id);
}

/** Spells a new run starts with until the spell teacher lets players choose (M3.6). */
export const START_SPELLS = { active: FROST_NOVA.id, aura: EMBER_MANTLE.id } as const;

for (const def of SPELLS) {
  const source = `src/content/spells/${def.id.replace(/_/g, '-')}.ts`;
  registerTunables(`spell: ${def.id}`, source, def);
  registerTunables(`spell: ${def.id} effect`, source, def.effect);
  if (def.onKill) registerTunables(`spell: ${def.id} on kill`, source, def.onKill);
}
