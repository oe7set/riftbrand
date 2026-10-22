import { defineRelic, type RelicDef, type RelicRarity } from '../schema';
import { registerTunables } from '../tunables';

/**
 * Stackable relics (GDD §7.2). Every copy strengthens the effect: flat values grow linearly,
 * chances grow hyperbolically so they never reach 100 %. Curses are strong with a real cost
 * and are only offered in shops and events, never forced.
 */
export const RELICS: readonly RelicDef[] = [
  defineRelic({
    id: 'spark_ring',
    rarity: 'rare',
    tags: ['fire', 'kill'],
    price: 70,
    values: {
      chance: { base: 0.2, perStack: 0, hyperbolic: true, percent: true },
      damage: { base: 10, perStack: 5 },
    },
    effects: [
      {
        kind: 'trigger',
        trigger: 'onKill',
        chance: 'chance',
        action: {
          type: 'nova',
          at: 'target',
          radiusPx: 80,
          damage: 'damage',
          status: 'burn',
          stacks: 1,
        },
      },
    ],
  }),
  defineRelic({
    id: 'cold_core',
    rarity: 'rare',
    tags: ['frost'],
    price: 70,
    values: { chance: { base: 0.15, perStack: 0, hyperbolic: true, percent: true } },
    effects: [
      {
        kind: 'trigger',
        trigger: 'onHit',
        source: 'any',
        chance: 'chance',
        action: { type: 'applyStatus', status: 'chill', stacks: 1 },
      },
    ],
  }),
  defineRelic({
    id: 'ember_stone',
    rarity: 'common',
    tags: ['damage'],
    price: 45,
    values: { bonus: { base: 0.08, perStack: 0.08, percent: true } },
    effects: [{ kind: 'stat', stat: 'allDamage', add: 'bonus' }],
  }),
  defineRelic({
    id: 'heart_shard',
    rarity: 'common',
    tags: ['defense'],
    price: 45,
    values: { hp: { base: 15, perStack: 15, int: true } },
    effects: [{ kind: 'stat', stat: 'maxHp', add: 'hp' }],
  }),
  defineRelic({
    id: 'light_soles',
    rarity: 'common',
    tags: ['movement'],
    price: 40,
    values: { bonus: { base: 0.07, perStack: 0.07, percent: true } },
    effects: [{ kind: 'stat', stat: 'moveSpeed', add: 'bonus' }],
  }),
  defineRelic({
    id: 'whetstone',
    rarity: 'common',
    tags: ['crit'],
    price: 45,
    values: { bonus: { base: 0.06, perStack: 0.06, percent: true } },
    effects: [{ kind: 'stat', stat: 'critChance', add: 'bonus' }],
  }),
  defineRelic({
    id: 'executioner_mark',
    rarity: 'rare',
    tags: ['crit'],
    price: 70,
    values: { bonus: { base: 0.3, perStack: 0.3, percent: true } },
    effects: [{ kind: 'stat', stat: 'critDamage', add: 'bonus' }],
  }),
  defineRelic({
    id: 'breath_stone',
    rarity: 'rare',
    tags: ['dash'],
    price: 65,
    values: { bonus: { base: 0.2, perStack: 0.2, percent: true } },
    effects: [{ kind: 'stat', stat: 'staminaRegen', add: 'bonus' }],
  }),
  defineRelic({
    id: 'leech_charm',
    rarity: 'epic',
    tags: ['heal', 'kill'],
    price: 110,
    values: { heal: { base: 1, perStack: 1, int: true } },
    effects: [{ kind: 'trigger', trigger: 'onKill', action: { type: 'heal', amount: 'heal' } }],
  }),
  defineRelic({
    id: 'second_wind',
    rarity: 'common',
    tags: ['heal'],
    price: 40,
    values: { heal: { base: 6, perStack: 6, int: true } },
    effects: [
      { kind: 'trigger', trigger: 'onRoomClear', action: { type: 'heal', amount: 'heal' } },
    ],
  }),
  defineRelic({
    id: 'greedy_heart',
    rarity: 'curse',
    tags: ['damage', 'curse'],
    price: 30,
    values: {
      bonus: { base: 0.4, perStack: 0.4, percent: true },
      penalty: { base: -0.5, perStack: -0.2, percent: true },
    },
    effects: [
      { kind: 'stat', stat: 'allDamage', add: 'bonus' },
      { kind: 'stat', stat: 'healing', add: 'penalty' },
    ],
  }),
  defineRelic({
    id: 'glass_bones',
    rarity: 'curse',
    tags: ['crit', 'curse'],
    price: 30,
    values: {
      crit: { base: 0.15, perStack: 0.1, percent: true },
      critDamage: { base: 1, perStack: 0.5, percent: true },
      hp: { base: -30, perStack: -20, int: true },
    },
    effects: [
      { kind: 'stat', stat: 'critChance', add: 'crit' },
      { kind: 'stat', stat: 'critDamage', add: 'critDamage' },
      { kind: 'stat', stat: 'maxHp', add: 'hp' },
    ],
  }),
];

const byId = new Map(RELICS.map((r) => [r.id, r]));

export function relicById(id: string): RelicDef | undefined {
  return byId.get(id);
}

export function relicsOfRarity(rarity: RelicRarity): RelicDef[] {
  return RELICS.filter((r) => r.rarity === rarity);
}

/** Resolves a named relic value for a stack count. */
export function relicValue(relic: RelicDef, name: string, stacks: number): number {
  const v = relic.values[name];
  if (!v || stacks <= 0) return 0;
  if (v.hyperbolic) return 1 - 1 / (1 + v.base * stacks);
  const raw = v.base + v.perStack * (stacks - 1);
  return v.int ? Math.round(raw) : raw;
}

export function relicDescParams(relic: RelicDef, stacks: number): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [name, v] of Object.entries(relic.values)) {
    const value = relicValue(relic, name, Math.max(1, stacks));
    params[name] = v.percent
      ? `${Math.round(Math.abs(value) * 100)}%`
      : String(Math.abs(Math.round(value * 10) / 10));
  }
  return params;
}

/** Room-clear shard bonus and relic drop weights per rarity. */
export const RELIC_ECONOMY = {
  combatClearShards: 10,
  eliteClearShards: 25,
  hordeClearShards: 20,
  shardsRewardAmount: 45,
  weightCommon: 60,
  weightRare: 30,
  weightEpic: 10,
};

registerTunables('relics & shards', 'src/content/relics/index.ts', RELIC_ECONOMY);
