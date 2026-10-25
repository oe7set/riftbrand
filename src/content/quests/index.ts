import { defineQuest, type QuestDef } from '../schema';

/**
 * Quests (ROADMAP M5.6). Text in `quest.<id>.name`, `.desc`, `.offer` and `.done`.
 * Story: the Ember Wastes chain from Maren (5 steps). Errands: rotating jobs per figure.
 */
export const QUESTS: readonly QuestDef[] = [
  // ── Story: "Embers of the Wastes" (Maren) ───────────────────────────────
  defineQuest({
    id: 'story_first_spark',
    kind: 'story',
    giver: 'maren',
    objectives: [{ kind: 'reachBoss', world: 'ember_wastes' }],
    reward: { ember: 40 },
  }),
  defineQuest({
    id: 'story_rekindle_forge',
    kind: 'story',
    giver: 'maren',
    requires: ['story_first_spark'],
    objectives: [{ kind: 'build', building: 'forge', level: 1 }],
    reward: { dust: 3, materials: { ember_core: 2 } },
  }),
  defineQuest({
    id: 'story_twin_fire',
    kind: 'story',
    giver: 'maren',
    requires: ['story_rekindle_forge'],
    objectives: [{ kind: 'defeat', enemy: 'twin_spark', count: 1 }],
    reward: { ember: 60, dust: 2 },
  }),
  defineQuest({
    id: 'story_warden_ash',
    kind: 'story',
    giver: 'maren',
    requires: ['story_twin_fire'],
    objectives: [{ kind: 'findItem', item: 'warden_ash', world: 'ember_wastes' }],
    reward: { spell: 'meteor', flag: 'knows_warden' },
  }),
  defineQuest({
    id: 'story_warden_falls',
    kind: 'story',
    giver: 'maren',
    requires: ['story_warden_ash'],
    objectives: [{ kind: 'defeat', enemy: 'ember_warden', count: 1 }],
    reward: { ember: 120, dust: 5, flag: 'warden_defeated' },
  }),

  // ── Errands ─────────────────────────────────────────────────────────────
  defineQuest({
    id: 'errand_toll_cores',
    kind: 'errand',
    giver: 'toll',
    objectives: [{ kind: 'deliver', material: 'ember_core', count: 3 }],
    reward: { dust: 3 },
  }),
  defineQuest({
    id: 'errand_toll_iron',
    kind: 'errand',
    giver: 'toll',
    objectives: [{ kind: 'collect', material: 'slag_iron', count: 12 }],
    reward: { ember: 40, materials: { ember_core: 1 } },
  }),
  defineQuest({
    id: 'errand_maren_burn',
    kind: 'errand',
    giver: 'maren',
    objectives: [{ kind: 'statusKills', status: 'burn', count: 30 }],
    reward: { ember: 50 },
  }),
  defineQuest({
    id: 'errand_maren_flawless',
    kind: 'errand',
    giver: 'maren',
    objectives: [{ kind: 'flawless', count: 3 }],
    reward: { ember: 40, dust: 1 },
  }),
  defineQuest({
    id: 'errand_sel_frost',
    kind: 'errand',
    giver: 'sel',
    objectives: [{ kind: 'statusKills', status: 'chill', count: 25 }],
    reward: { dust: 2 },
  }),
  defineQuest({
    id: 'errand_sel_poison',
    kind: 'errand',
    giver: 'sel',
    objectives: [{ kind: 'statusKills', status: 'poison', count: 20 }],
    reward: { dust: 2, ember: 20 },
  }),
  defineQuest({
    id: 'errand_nix_iron',
    kind: 'errand',
    giver: 'nix',
    objectives: [{ kind: 'deliver', material: 'slag_iron', count: 8 }],
    reward: { dust: 2 },
  }),
  defineQuest({
    id: 'errand_nix_duelist',
    kind: 'errand',
    giver: 'nix',
    objectives: [{ kind: 'defeat', enemy: 'ember_duelist', count: 1 }],
    reward: { ember: 60 },
  }),
  defineQuest({
    id: 'errand_iskra_boss',
    kind: 'errand',
    giver: 'iskra',
    objectives: [{ kind: 'reachBoss', world: 'ember_wastes' }],
    reward: { ember: 30, materials: { slag_iron: 4 } },
  }),
  defineQuest({
    id: 'errand_archivist_cores',
    kind: 'errand',
    giver: 'archivist',
    objectives: [{ kind: 'collect', material: 'ember_core', count: 5 }],
    reward: { dust: 3 },
  }),
];

export function questById(id: string): QuestDef | undefined {
  return QUESTS.find((q) => q.id === id);
}
