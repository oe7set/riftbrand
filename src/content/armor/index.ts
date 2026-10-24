import {
  type ArmorDef,
  type ArmorSetDef,
  type ArmorSlot,
  type CostDef,
  defineArmor,
  defineArmorSet,
} from '../schema';

/**
 * Armour at Toll's forge (ROADMAP M5.4): four slots, levels 1–3, one set per world. Values are
 * capped by design: a full set at level 3 is the planned end state (like the Ember Tree), so it
 * never breaks balancing. Text in `armor.<id>.name` / `.desc` and `armor_set.<id>.*`.
 */
export const ARMOR_SLOTS: readonly ArmorSlot[] = ['head', 'chest', 'hands', 'feet'];

export const EMBER = 0xff7a2e;
const EMBER_HOT = 0xffd36b;

const setCraft: CostDef = { dust: 1, materials: { slag_iron: 4, ember_core: 1 } };
const setUpgrades: CostDef[] = [
  { dust: 2, materials: { slag_iron: 4, ember_core: 2 } },
  { dust: 4, materials: { slag_iron: 6, ember_core: 3 } },
];
const singleCraft: CostDef = { dust: 1, materials: { slag_iron: 3 } };
const singleUpgrades: CostDef[] = [
  { dust: 2, materials: { slag_iron: 4, ember_core: 1 } },
  { dust: 3, materials: { slag_iron: 5, ember_core: 2 } },
];

export const ARMOR: readonly ArmorDef[] = [
  // ── Glut set (Aschefelder) ──────────────────────────────────────────────
  defineArmor({
    id: 'ember_helm',
    slot: 'head',
    set: 'ember_set',
    icon: { glyph: 'crown' },
    values: {
      hp: { levels: [6, 9, 12], int: true },
      heal: { levels: [2, 3, 4], int: true },
    },
    effects: [
      { kind: 'stat', stat: 'maxHp', add: 'hp' },
      { kind: 'trigger', trigger: 'onRoomClear', action: { type: 'heal', amount: 'heal' } },
    ],
    craftCost: setCraft,
    upgradeCosts: setUpgrades,
    look: {
      part: 'head',
      shapes: [
        {
          kind: 'poly',
          points: [-0.24, -0.4, 0.02, -0.62, 0.3, -0.42, 0.22, -0.3, -0.14, -0.3],
          fill: EMBER,
          fillAlpha: 0.45,
          stroke: EMBER,
          strokeWidth: 0.06,
        },
        {
          kind: 'line',
          points: [0.02, -0.62, -0.04, -0.78],
          stroke: EMBER_HOT,
          strokeWidth: 0.05,
          glow: true,
        },
      ],
    },
  }),
  defineArmor({
    id: 'ember_plate',
    slot: 'chest',
    set: 'ember_set',
    icon: { glyph: 'shield' },
    values: {
      hp: { levels: [10, 14, 18], int: true },
      damage: { levels: [6, 9, 12], int: true },
    },
    effects: [
      { kind: 'stat', stat: 'maxHp', add: 'hp' },
      {
        kind: 'trigger',
        trigger: 'onDamaged',
        action: {
          type: 'nova',
          at: 'player',
          radiusPx: 90,
          damage: 'damage',
          status: 'burn',
          stacks: 1,
        },
      },
    ],
    craftCost: setCraft,
    upgradeCosts: setUpgrades,
    look: {
      part: 'torso',
      shapes: [
        {
          kind: 'poly',
          points: [-0.2, -0.14, 0.18, -0.14, 0.24, -0.55, 0.1, -0.74, -0.16, -0.74, -0.25, -0.5],
          fill: EMBER,
          fillAlpha: 0.35,
          stroke: EMBER,
          strokeWidth: 0.07,
        },
        {
          kind: 'line',
          points: [-0.12, -0.44, 0.16, -0.44],
          stroke: EMBER_HOT,
          strokeWidth: 0.05,
          glow: true,
        },
      ],
    },
  }),
  defineArmor({
    id: 'ember_gauntlets',
    slot: 'hands',
    set: 'ember_set',
    icon: { glyph: 'hand' },
    values: {
      bonus: { levels: [0.06, 0.09, 0.12], percent: true },
      chance: { levels: [0.12, 0.16, 0.2], percent: true },
    },
    effects: [
      { kind: 'stat', stat: 'attackDamage', add: 'bonus' },
      {
        kind: 'trigger',
        trigger: 'onHit',
        source: 'attack',
        chance: 'chance',
        action: { type: 'applyStatus', status: 'burn', stacks: 1 },
      },
    ],
    craftCost: setCraft,
    upgradeCosts: setUpgrades,
    look: {
      part: 'arm_front',
      shapes: [
        { kind: 'line', points: [0, 0.2, 0, 0.4], stroke: EMBER, strokeWidth: 0.17 },
        {
          kind: 'ellipse',
          x: 0,
          y: 0.46,
          rx: 0.11,
          ry: 0.11,
          fill: EMBER,
          fillAlpha: 0.7,
          stroke: EMBER_HOT,
          strokeWidth: 0.04,
          glow: true,
        },
      ],
    },
  }),
  defineArmor({
    id: 'ember_greaves',
    slot: 'feet',
    set: 'ember_set',
    icon: { glyph: 'boot' },
    values: {
      speed: { levels: [0.04, 0.06, 0.08], percent: true },
      damage: { levels: [5, 8, 11], int: true },
    },
    effects: [
      { kind: 'stat', stat: 'moveSpeed', add: 'speed' },
      {
        kind: 'trigger',
        trigger: 'onDash',
        action: {
          type: 'nova',
          at: 'player',
          radiusPx: 70,
          damage: 'damage',
          status: 'burn',
          stacks: 1,
        },
      },
    ],
    craftCost: setCraft,
    upgradeCosts: setUpgrades,
    look: {
      part: 'leg_front',
      shapes: [
        { kind: 'line', points: [0, 0.38, 0.02, 0.64], stroke: EMBER, strokeWidth: 0.18 },
        {
          kind: 'ellipse',
          x: 0.08,
          y: 0.69,
          rx: 0.13,
          ry: 0.06,
          fill: EMBER,
          stroke: EMBER_HOT,
          strokeWidth: 0.03,
          glow: true,
        },
      ],
    },
  }),

  // ── Single pieces ───────────────────────────────────────────────────────
  defineArmor({
    id: 'frost_hood',
    slot: 'head',
    icon: { glyph: 'snowflake' },
    values: {
      bonus: { levels: [0.05, 0.08, 0.1], percent: true },
      heal: { levels: [1, 2, 3], int: true },
    },
    effects: [
      { kind: 'stat', stat: 'cooldownReduction', add: 'bonus' },
      { kind: 'trigger', trigger: 'onFreeze', action: { type: 'heal', amount: 'heal' } },
    ],
    craftCost: singleCraft,
    upgradeCosts: singleUpgrades,
    look: {
      part: 'head',
      shapes: [
        {
          kind: 'poly',
          points: [
            -0.3, -0.1, -0.26, -0.48, 0.04, -0.6, 0.3, -0.46, 0.2, -0.4, -0.12, -0.42, -0.18, -0.08,
          ],
          fill: 0x8fe8ff,
          fillAlpha: 0.4,
          stroke: 0x8fe8ff,
          strokeWidth: 0.05,
        },
      ],
    },
  }),
  defineArmor({
    id: 'runner_vest',
    slot: 'chest',
    icon: { glyph: 'wind' },
    values: {
      bonus: { levels: [0.08, 0.12, 0.15], percent: true },
      stamina: { levels: [1, 1, 1], int: true },
    },
    effects: [
      { kind: 'stat', stat: 'staminaRegen', add: 'bonus' },
      {
        kind: 'trigger',
        trigger: 'onPerfectDash',
        action: { type: 'refundStamina', amount: 'stamina' },
      },
    ],
    craftCost: singleCraft,
    upgradeCosts: singleUpgrades,
    look: {
      part: 'torso',
      shapes: [
        {
          kind: 'line',
          points: [-0.18, -0.7, 0.16, -0.12],
          stroke: 0x7ff6c8,
          strokeWidth: 0.06,
          glow: true,
        },
        { kind: 'line', points: [0.14, -0.7, -0.2, -0.12], stroke: 0x7ff6c8, strokeWidth: 0.06 },
      ],
    },
  }),
  defineArmor({
    id: 'spark_gloves',
    slot: 'hands',
    icon: { glyph: 'spark' },
    values: {
      bonus: { levels: [0.04, 0.06, 0.08], percent: true },
      damage: { levels: [6, 9, 12], int: true },
    },
    effects: [
      { kind: 'stat', stat: 'critChance', add: 'bonus' },
      {
        kind: 'trigger',
        trigger: 'onKill',
        chance: 0.25,
        action: { type: 'nova', at: 'target', radiusPx: 60, damage: 'damage' },
      },
    ],
    craftCost: singleCraft,
    upgradeCosts: singleUpgrades,
    look: {
      part: 'arm_front',
      shapes: [
        {
          kind: 'ellipse',
          x: 0,
          y: 0.46,
          rx: 0.1,
          ry: 0.1,
          fill: 0xffe066,
          fillAlpha: 0.6,
          stroke: 0xffe066,
          strokeWidth: 0.04,
          glow: true,
        },
      ],
    },
  }),
  defineArmor({
    id: 'shard_boots',
    slot: 'feet',
    icon: { glyph: 'coin' },
    values: {
      bonus: { levels: [0.1, 0.15, 0.2], percent: true },
      speed: { levels: [0.02, 0.03, 0.04], percent: true },
    },
    effects: [
      { kind: 'stat', stat: 'shardGain', add: 'bonus' },
      { kind: 'stat', stat: 'moveSpeed', add: 'speed' },
    ],
    craftCost: singleCraft,
    upgradeCosts: singleUpgrades,
    look: {
      part: 'leg_front',
      shapes: [
        {
          kind: 'ellipse',
          x: 0.08,
          y: 0.68,
          rx: 0.13,
          ry: 0.06,
          fill: 0xc46bff,
          stroke: 0xc46bff,
          strokeWidth: 0.03,
          glow: true,
        },
      ],
    },
  }),
];

export const ARMOR_SETS: readonly ArmorSetDef[] = [
  defineArmorSet({
    id: 'ember_set',
    // 2 pieces: burn hurts more. 4 pieces: every attack sets enemies on fire.
    bonus2: [{ kind: 'stat', stat: 'burnDamage', add: 0.25 }],
    bonus4: [
      {
        kind: 'trigger',
        trigger: 'onHit',
        source: 'attack',
        action: { type: 'applyStatus', status: 'burn', stacks: 1 },
      },
      { kind: 'stat', stat: 'damageVsBurning', add: 0.15 },
    ],
  }),
];

export function armorById(id: string): ArmorDef | undefined {
  return ARMOR.find((a) => a.id === id);
}

export function armorSetById(id: string): ArmorSetDef | undefined {
  return ARMOR_SETS.find((s) => s.id === id);
}

/** A piece's value at its level (1–3), for effects and descriptions. */
export function armorValue(def: ArmorDef, name: string, level: number): number {
  const v = def.values[name];
  return v?.levels[Math.min(3, Math.max(1, level)) - 1] ?? 0;
}

export function armorDescParams(def: ArmorDef, level: number): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [name, v] of Object.entries(def.values)) {
    const value = armorValue(def, name, level);
    params[name] = v.percent ? `${Math.round(value * 100)}%` : String(value);
  }
  return params;
}
