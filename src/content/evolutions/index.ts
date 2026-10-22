import { defineEvolution, type EvolutionDef } from '../schema';

/**
 * Weapon evolutions (GDD §4.9): a specific combination in the run unlocks a big upgrade,
 * offered at the next altar or rest.
 */
export const EVOLUTIONS: readonly EvolutionDef[] = [
  defineEvolution({
    id: 'phoenix_blade',
    weapon: 'brand_blade',
    requires: { boons: ['searing_strike'], relics: ['spark_ring'] },
    effects: [
      {
        kind: 'trigger',
        trigger: 'onComboFinisher',
        action: {
          type: 'projectile',
          kind: 'firebird',
          damage: 28,
          speedPxPerSec: 520,
          radiusPx: 16,
          rangePx: 520,
          pierce: true,
          status: 'burn',
          stacks: 3,
        },
      },
      { kind: 'stat', stat: 'attackDamage', add: 0.1 },
    ],
  }),
];

const byId = new Map(EVOLUTIONS.map((e) => [e.id, e]));

export function evolutionById(id: string): EvolutionDef | undefined {
  return byId.get(id);
}
