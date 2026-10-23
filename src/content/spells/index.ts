import type { SpellDef } from '../schema';
import { registerTunables } from '../tunables';
import { EMBER_MANTLE } from './ember-mantle';
import { FROST_NOVA } from './frost-nova';

/**
 * Spells (ROADMAP M3.2): one active spell with a cooldown and one aura. The index is the
 * spell id stored in the sim (append only).
 */
export const SPELLS: readonly SpellDef[] = [FROST_NOVA, EMBER_MANTLE];

export function spellIndex(id: string): number {
  return SPELLS.findIndex((s) => s.id === id);
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
}
