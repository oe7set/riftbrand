import { type BoonDef, defineBoon } from '../schema';

/** Vaelis, frost: slow, freeze, shatter, control (GDD §2.4). */
export const VAELIS_BOONS: readonly BoonDef[] = [
  defineBoon({
    id: 'frost_strike',
    being: 'vaelis',
    slot: 'attack',
    tags: ['frost'],
    values: { stacks: { base: 1, step: 1, int: true } },
    effects: [
      {
        kind: 'trigger',
        trigger: 'onHit',
        source: 'attack',
        action: { type: 'applyStatus', status: 'chill', stacks: 'stacks' },
      },
    ],
  }),
  defineBoon({
    id: 'glacial_whirl',
    being: 'vaelis',
    slot: 'special',
    tags: ['frost'],
    values: {
      stacks: { base: 2, step: 1, int: true },
      damage: { base: 0.2, step: 0.1, percent: true },
    },
    effects: [
      {
        kind: 'trigger',
        trigger: 'onHit',
        source: 'special',
        action: { type: 'applyStatus', status: 'chill', stacks: 'stacks' },
      },
      { kind: 'stat', stat: 'specialDamage', add: 'damage' },
    ],
  }),
  defineBoon({
    id: 'frost_step',
    being: 'vaelis',
    slot: 'dash',
    tags: ['frost', 'dash'],
    values: { stacks: { base: 2, step: 1, int: true } },
    effects: [
      {
        kind: 'trigger',
        trigger: 'onDash',
        action: {
          type: 'nova',
          at: 'player',
          radiusPx: 100,
          damage: 0,
          status: 'chill',
          stacks: 'stacks',
        },
      },
    ],
  }),
  defineBoon({
    id: 'cold_grip',
    being: 'vaelis',
    slot: 'passive',
    tags: ['frost'],
    values: { bonus: { base: 0.5, step: 0.25, percent: true } },
    effects: [{ kind: 'stat', stat: 'freezeDuration', add: 'bonus' }],
  }),
  defineBoon({
    id: 'shatter',
    being: 'vaelis',
    slot: 'passive',
    tags: ['frost'],
    values: { bonus: { base: 0.5, step: 0.25, percent: true } },
    effects: [{ kind: 'stat', stat: 'damageVsFrozen', add: 'bonus' }],
  }),
  defineBoon({
    id: 'ice_age',
    being: 'vaelis',
    slot: 'passive',
    tags: ['frost', 'dash'],
    values: { radius: { base: 140, step: 30 } },
    effects: [
      {
        kind: 'trigger',
        trigger: 'onPerfectDash',
        action: { type: 'nova', at: 'player', radiusPx: 'radius', damage: 0, freeze: true },
      },
    ],
  }),
  defineBoon({
    id: 'glacier_skin',
    being: 'vaelis',
    slot: 'passive',
    tags: ['frost'],
    values: { stacks: { base: 3, step: 1, int: true } },
    effects: [
      {
        kind: 'trigger',
        trigger: 'onDamaged',
        action: {
          type: 'nova',
          at: 'player',
          radiusPx: 150,
          damage: 0,
          status: 'chill',
          stacks: 'stacks',
        },
      },
    ],
  }),
  defineBoon({
    id: 'biting_cold',
    being: 'vaelis',
    slot: 'passive',
    tags: ['frost'],
    values: { bonus: { base: 0.05, step: 0.025, percent: true } },
    effects: [{ kind: 'stat', stat: 'damageVsChilledPerStack', add: 'bonus' }],
  }),
];
