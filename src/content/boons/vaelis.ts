import { type BoonDef, defineBoon } from '../schema';

/** Vaelis, frost: slow, freeze, shatter, control (GDD §2.4). */
export const VAELIS_BOONS: readonly BoonDef[] = [
  defineBoon({
    id: 'frost_strike',
    icon: { glyph: 'blade' },
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
    icon: { glyph: 'swirl' },
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
    id: 'ice_shard',
    icon: { glyph: 'shard' },
    being: 'vaelis',
    slot: 'cast',
    tags: ['frost', 'cast'],
    values: {
      stacks: { base: 2, step: 1, int: true },
      damage: { base: 0.25, step: 0.15, percent: true },
    },
    effects: [
      {
        kind: 'trigger',
        trigger: 'onHit',
        source: 'cast',
        action: { type: 'applyStatus', status: 'chill', stacks: 'stacks' },
      },
      { kind: 'stat', stat: 'castDamage', add: 'damage' },
    ],
  }),
  defineBoon({
    id: 'frost_step',
    icon: { glyph: 'boot' },
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
    icon: { glyph: 'hand' },
    being: 'vaelis',
    slot: 'passive',
    tags: ['frost'],
    values: { bonus: { base: 0.5, step: 0.25, percent: true } },
    effects: [{ kind: 'stat', stat: 'freezeDuration', add: 'bonus' }],
  }),
  defineBoon({
    id: 'shatter',
    icon: { glyph: 'nova' },
    being: 'vaelis',
    slot: 'passive',
    tags: ['frost'],
    values: { bonus: { base: 0.5, step: 0.25, percent: true } },
    effects: [{ kind: 'stat', stat: 'damageVsFrozen', add: 'bonus' }],
  }),
  defineBoon({
    id: 'ice_age',
    icon: { glyph: 'hourglass' },
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
    icon: { glyph: 'shield' },
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
    icon: { glyph: 'fang' },
    being: 'vaelis',
    slot: 'passive',
    tags: ['frost'],
    values: { bonus: { base: 0.05, step: 0.025, percent: true } },
    effects: [{ kind: 'stat', stat: 'damageVsChilledPerStack', add: 'bonus' }],
  }),
  defineBoon({
    // M3.3: the frost being rewards patience with faster spells.
    id: 'cold_focus',
    icon: { glyph: 'eye' },
    being: 'vaelis',
    slot: 'passive',
    tags: ['frost', 'spell'],
    values: { bonus: { base: 0.15, step: 0.07, percent: true } },
    effects: [{ kind: 'stat', stat: 'cooldownReduction', add: 'bonus' }],
  }),
];
