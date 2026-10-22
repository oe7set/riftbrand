import { type BoonDef, defineBoon } from '../schema';

/** Ignara, flame: burn damage over time, explosions, stacking (GDD §2.4). */
export const IGNARA_BOONS: readonly BoonDef[] = [
  defineBoon({
    id: 'searing_strike',
    being: 'ignara',
    slot: 'attack',
    tags: ['fire'],
    values: { stacks: { base: 1, step: 1, int: true } },
    effects: [
      {
        kind: 'trigger',
        trigger: 'onHit',
        source: 'attack',
        action: { type: 'applyStatus', status: 'burn', stacks: 'stacks' },
      },
    ],
  }),
  defineBoon({
    id: 'inferno_whirl',
    being: 'ignara',
    slot: 'special',
    tags: ['fire'],
    values: {
      stacks: { base: 3, step: 1, int: true },
      damage: { base: 0.3, step: 0.15, percent: true },
    },
    effects: [
      {
        kind: 'trigger',
        trigger: 'onHit',
        source: 'special',
        action: { type: 'applyStatus', status: 'burn', stacks: 'stacks' },
      },
      { kind: 'stat', stat: 'specialDamage', add: 'damage' },
    ],
  }),
  defineBoon({
    id: 'spark_trail',
    being: 'ignara',
    slot: 'dash',
    tags: ['fire', 'dash'],
    values: { damage: { base: 8, step: 4 }, stacks: { base: 1, step: 1, int: true } },
    effects: [
      {
        kind: 'trigger',
        trigger: 'onDash',
        action: {
          type: 'nova',
          at: 'player',
          radiusPx: 90,
          damage: 'damage',
          status: 'burn',
          stacks: 'stacks',
        },
      },
    ],
  }),
  defineBoon({
    id: 'ignition',
    being: 'ignara',
    slot: 'passive',
    tags: ['fire', 'kill'],
    values: { damage: { base: 15, step: 7 }, stacks: { base: 2, step: 1, int: true } },
    effects: [
      {
        kind: 'trigger',
        trigger: 'onKill',
        condition: { targetBurnStacksAtLeast: 3 },
        action: {
          type: 'nova',
          at: 'target',
          radiusPx: 100,
          damage: 'damage',
          status: 'burn',
          stacks: 'stacks',
        },
      },
    ],
  }),
  defineBoon({
    id: 'ember_heart',
    being: 'ignara',
    slot: 'passive',
    tags: ['fire'],
    values: { bonus: { base: 0.2, step: 0.1, percent: true } },
    effects: [{ kind: 'stat', stat: 'damageVsBurning', add: 'bonus' }],
  }),
  defineBoon({
    id: 'blazing_fury',
    being: 'ignara',
    slot: 'passive',
    tags: ['fire'],
    values: { bonus: { base: 0.15, step: 0.08, percent: true } },
    effects: [{ kind: 'stat', stat: 'attackDamage', add: 'bonus' }],
  }),
  defineBoon({
    id: 'ashes_to_ashes',
    being: 'ignara',
    slot: 'passive',
    tags: ['fire'],
    values: { bonus: { base: 0.4, step: 0.2, percent: true } },
    effects: [{ kind: 'stat', stat: 'burnDamage', add: 'bonus' }],
  }),
  defineBoon({
    id: 'phoenix_ember',
    being: 'ignara',
    slot: 'passive',
    tags: ['fire', 'kill', 'heal'],
    values: { heal: { base: 2, step: 1, int: true } },
    effects: [
      {
        kind: 'trigger',
        trigger: 'onKill',
        condition: { targetBurnStacksAtLeast: 1 },
        action: { type: 'heal', amount: 'heal' },
      },
    ],
  }),
];
