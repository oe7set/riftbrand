import { type BoonDef, defineBoon } from '../schema';

const BURN_SOURCES = ['searing_strike', 'inferno_whirl', 'ember_shot', 'spark_trail', 'ignition'];
const FROST_SOURCES = [
  'frost_strike',
  'glacial_whirl',
  'ice_shard',
  'frost_step',
  'ice_age',
  'glacier_skin',
];

/** Duo boons (GDD §7.1): offered once the build owns a matching boon of both beings. */
export const DUO_BOONS: readonly BoonDef[] = [
  defineBoon({
    id: 'steam_burst',
    being: 'ignara',
    partner: 'vaelis',
    requires: [BURN_SOURCES, FROST_SOURCES],
    slot: 'passive',
    tags: ['fire', 'frost', 'duo'],
    // Duos have no rarity scaling: step 0.
    values: { damage: { base: 45, step: 0 } },
    effects: [
      {
        kind: 'trigger',
        trigger: 'onFreeze',
        condition: { targetBurnStacksAtLeast: 1 },
        action: {
          type: 'nova',
          at: 'target',
          radiusPx: 110,
          damage: 'damage',
          consumeStatuses: true,
        },
      },
      {
        kind: 'trigger',
        trigger: 'onBurnApplied',
        condition: { targetFrozen: true },
        action: {
          type: 'nova',
          at: 'target',
          radiusPx: 110,
          damage: 'damage',
          consumeStatuses: true,
        },
      },
    ],
  }),
];
