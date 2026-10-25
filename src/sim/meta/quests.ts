import { QUESTS, questById } from '../../content/quests';
import type { QuestDef, QuestObjective, RoomType, Speaker } from '../../content/schema';
import { WORLDS, worldById } from '../../content/worlds';
import type { RunState } from '../run/run-state';
import type { Profile } from './profile';
import { buildingLevel } from './refuge';

/** Where a quest stands for the player (ROADMAP M5.6). */
export type QuestStatus = 'locked' | 'available' | 'active' | 'ready' | 'done';

export interface QuestState {
  /** Accepted, not yet handed in. */
  active: string[];
  /** Finished story quests (each happens once). */
  done: string[];
  /** Counter per objective of an active quest. */
  progress: Record<string, number[]>;
  /** Finished errands per giver; picks the next one in rotation. */
  errandsDone: Partial<Record<Speaker, number>>;
  /** Quest shown in the run HUD. */
  tracked: string | null;
}

export function emptyQuestState(): QuestState {
  return { active: [], done: [], progress: {}, errandsDone: {}, tracked: null };
}

/** How much an objective needs. */
export function objectiveNeed(o: QuestObjective): number {
  return 'count' in o ? o.count : o.kind === 'build' ? o.level : 1;
}

/** What one run adds to an objective; the boss only counts when the run was won. */
export function runContribution(
  o: QuestObjective,
  run: RunState,
  result: 'won' | 'lost' | null,
): number {
  switch (o.kind) {
    case 'collect':
      return run.materials[o.material] ?? 0;
    case 'statusKills':
      return run.tally.statusKills[o.status] ?? 0;
    case 'flawless':
      return run.tally.flawlessRooms;
    case 'defeat': {
      const boss = worldById(run.worldId)?.bossName;
      const duel = run.duelsWon.includes(o.enemy) ? 1 : 0;
      return duel + (result === 'won' && boss === o.enemy ? 1 : 0);
    }
    case 'reachBoss':
      return run.reachedBoss && run.worldId === o.world ? 1 : 0;
    case 'findItem':
      return run.tally.items.includes(o.item) ? 1 : 0;
    case 'deliver':
    case 'build':
      return 0;
  }
}

/** Progress of one objective: stored progress, or the live stash and buildings. */
export function objectiveHave(profile: Profile, quest: QuestDef, index: number): number {
  const o = quest.objectives[index];
  if (!o) return 0;
  if (o.kind === 'deliver') return Math.min(o.count, profile.materials[o.material] ?? 0);
  if (o.kind === 'build') return Math.min(o.level, buildingLevel(profile, o.building));
  return Math.min(objectiveNeed(o), profile.quests.progress[quest.id]?.[index] ?? 0);
}

export function isQuestComplete(profile: Profile, quest: QuestDef): boolean {
  return quest.objectives.every((o, i) => objectiveHave(profile, quest, i) >= objectiveNeed(o));
}

export function questStatus(profile: Profile, id: string): QuestStatus {
  const quest = questById(id);
  if (!quest) return 'locked';
  const q = profile.quests;
  if (q.active.includes(id)) return isQuestComplete(profile, quest) ? 'ready' : 'active';
  if (quest.kind === 'story' && q.done.includes(id)) return 'done';
  return quest.requires.every((r) => q.done.includes(r)) ? 'available' : 'locked';
}

/**
 * The quest a figure has for you now: an open one of theirs first, then the next story step,
 * then the next errand in their rotation.
 */
export function questFrom(profile: Profile, giver: Speaker): QuestDef | null {
  const mine = QUESTS.filter((q) => q.giver === giver);
  const active = mine.find((q) => profile.quests.active.includes(q.id));
  if (active) return active;
  const story = mine.find((q) => q.kind === 'story' && questStatus(profile, q.id) === 'available');
  if (story) return story;
  const errands = mine.filter((q) => q.kind === 'errand');
  if (errands.length === 0) return null;
  return errands[(profile.quests.errandsDone[giver] ?? 0) % errands.length] ?? null;
}

export function acceptQuest(profile: Profile, id: string): boolean {
  const quest = questById(id);
  if (!quest || questStatus(profile, id) !== 'available') return false;
  profile.quests.active.push(id);
  profile.quests.progress[id] = quest.objectives.map(() => 0);
  profile.quests.tracked ??= id;
  return true;
}

/** Hands a finished quest in: deliveries are taken, rewards paid. */
export function claimQuest(profile: Profile, id: string): boolean {
  const quest = questById(id);
  if (!quest || questStatus(profile, id) !== 'ready') return false;
  for (const o of quest.objectives) {
    if (o.kind === 'deliver')
      profile.materials[o.material] = (profile.materials[o.material] ?? 0) - o.count;
  }
  const r = quest.reward;
  profile.ember += r.ember;
  profile.dust += r.dust;
  for (const [m, n] of Object.entries(r.materials)) {
    profile.materials[m] = (profile.materials[m] ?? 0) + n;
  }
  if (r.spell && !profile.spellsUnlocked.includes(r.spell)) {
    profile.spellsUnlocked.push(r.spell);
    profile.spellsDiscovered = profile.spellsDiscovered.filter((s) => s !== r.spell);
  }
  if (r.flag && !profile.flags.includes(r.flag)) profile.flags.push(r.flag);
  const q = profile.quests;
  q.active = q.active.filter((a) => a !== id);
  delete q.progress[id];
  if (quest.kind === 'story') q.done.push(id);
  else q.errandsDone[quest.giver] = (q.errandsDone[quest.giver] ?? 0) + 1;
  if (q.tracked === id) q.tracked = q.active[0] ?? null;
  return true;
}

/** Books a finished run into every open quest (called when the run is settled). */
export function applyRunToQuests(profile: Profile, run: RunState, result: 'won' | 'lost'): void {
  for (const id of profile.quests.active) {
    const quest = questById(id);
    const progress = profile.quests.progress[id];
    if (!quest || !progress) continue;
    quest.objectives.forEach((o, i) => {
      progress[i] = Math.min(
        objectiveNeed(o),
        (progress[i] ?? 0) + runContribution(o, run, result),
      );
    });
  }
}

/** Progress including the run in progress, for the HUD tracker: [have, need] per objective. */
export function liveProgress(
  profile: Profile,
  run: RunState | null,
  id: string,
): Array<[have: number, need: number]> {
  const quest = questById(id);
  if (!quest) return [];
  return quest.objectives.map((o, i) => {
    const need = objectiveNeed(o);
    const extra = run ? runContribution(o, run, null) : 0;
    return [Math.min(need, objectiveHave(profile, quest, i) + extra), need];
  });
}

/** The quest item an event room of this run should hold, if an open quest still needs one. */
export function questItemToFind(profile: Profile, run: RunState): string | null {
  for (const id of profile.quests.active) {
    const quest = questById(id);
    if (!quest) continue;
    for (const [i, o] of quest.objectives.entries()) {
      if (o.kind !== 'findItem' || o.world !== run.worldId) continue;
      if (run.tally.items.includes(o.item)) continue;
      if (objectiveHave(profile, quest, i) >= 1) continue;
      return o.item;
    }
  }
  return null;
}

export function trackQuest(profile: Profile, id: string): boolean {
  if (!profile.quests.active.includes(id)) return false;
  profile.quests.tracked = id;
  return true;
}

/** Map node types where a quest's goals can be met, for the quest symbol on the run map. */
export function questNodeTypes(quest: QuestDef): RoomType[] {
  const types = new Set<RoomType>();
  for (const o of quest.objectives) {
    if (o.kind === 'reachBoss') types.add('boss');
    else if (o.kind === 'findItem') types.add('event');
    else if (o.kind === 'defeat') {
      types.add(WORLDS.some((w) => w.bossName === o.enemy) ? 'boss' : 'duel');
    }
  }
  return [...types];
}
