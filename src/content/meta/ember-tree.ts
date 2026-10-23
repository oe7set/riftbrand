import { defineTreeNode, type TreeNodeDef } from '../schema';

/**
 * Glutbaum (GDD §8.2): permanent upgrades bought from Maren with Glut (and some Rissstaub).
 * Capped on purpose: the whole tree costs roughly 15–20 runs of Glut, after that power comes
 * from unlocks and skill. Respec is always free.
 */
export const EMBER_TREE: readonly TreeNodeDef[] = [
  defineTreeNode({
    id: 'vitality',
    ranks: [
      { ember: 30, dust: 0 },
      { ember: 60, dust: 0 },
      { ember: 100, dust: 0 },
    ],
    effect: { kind: 'stat', stat: 'maxHp', perRank: 10 },
  }),
  defineTreeNode({
    id: 'keen_edge',
    ranks: [
      { ember: 40, dust: 0 },
      { ember: 80, dust: 0 },
      { ember: 130, dust: 0 },
    ],
    effect: { kind: 'stat', stat: 'allDamage', perRank: 0.06 },
  }),
  defineTreeNode({
    id: 'ember_mending',
    ranks: [
      { ember: 40, dust: 0 },
      { ember: 90, dust: 0 },
    ],
    effect: { kind: 'roomHeal', perRank: 4 },
  }),
  defineTreeNode({
    id: 'starting_shards',
    ranks: [
      { ember: 35, dust: 0 },
      { ember: 70, dust: 0 },
    ],
    effect: { kind: 'startShards', perRank: 30 },
  }),
  defineTreeNode({
    id: 'deep_breath',
    ranks: [
      { ember: 50, dust: 0 },
      { ember: 100, dust: 0 },
    ],
    effect: { kind: 'stat', stat: 'staminaRegen', perRank: 0.12 },
  }),
  defineTreeNode({
    id: 'last_spark',
    requires: 'vitality',
    ranks: [
      { ember: 120, dust: 2 },
      { ember: 200, dust: 4 },
    ],
    effect: { kind: 'lastSpark', healPerRank: [0, 0.4] },
  }),
  defineTreeNode({
    id: 'second_offer',
    ranks: [{ ember: 80, dust: 1 }],
    effect: { kind: 'boonReroll', perRank: 1 },
  }),
  defineTreeNode({
    id: 'fourth_segment',
    requires: 'deep_breath',
    ranks: [{ ember: 250, dust: 5 }],
    effect: { kind: 'staminaSegment', perRank: 1 },
  }),
  defineTreeNode({
    // M3.6: the equipped active spell starts at level 2.
    id: 'rune_lore',
    ranks: [{ ember: 160, dust: 3 }],
    effect: { kind: 'spellStartLevel', perRank: 1 },
  }),
];

const byId = new Map(EMBER_TREE.map((n) => [n.id, n]));

export function treeNodeById(id: string): TreeNodeDef | undefined {
  return byId.get(id);
}
