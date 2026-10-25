import { describe, expect, it } from 'vitest';
import { QUESTS, questById } from '../../content/quests';
import { createRun } from '../run/run-state';
import { createProfile } from './profile';
import {
  acceptQuest,
  applyRunToQuests,
  claimQuest,
  liveProgress,
  questFrom,
  questItemToFind,
  questNodeTypes,
  questStatus,
} from './quests';
import { addMaterials } from './refuge';

function quest(id: string) {
  const q = questById(id);
  if (!q) throw new Error(`missing ${id}`);
  return q;
}

describe('quests (ROADMAP M5.6)', () => {
  it('the story chain unlocks step by step', () => {
    const p = createProfile();
    expect(questStatus(p, 'story_first_spark')).toBe('available');
    expect(questStatus(p, 'story_rekindle_forge')).toBe('locked');
    expect(questFrom(p, 'maren')?.id).toBe('story_first_spark');
    acceptQuest(p, 'story_first_spark');
    const run = createRun(1);
    run.reachedBoss = true;
    applyRunToQuests(p, run, 'lost');
    expect(questStatus(p, 'story_first_spark')).toBe('ready');
    const ember = p.ember;
    expect(claimQuest(p, 'story_first_spark')).toBe(true);
    expect(p.ember).toBe(ember + quest('story_first_spark').reward.ember);
    expect(questStatus(p, 'story_first_spark')).toBe('done');
    expect(questStatus(p, 'story_rekindle_forge')).toBe('available');
    expect(questFrom(p, 'maren')?.id).toBe('story_rekindle_forge');
  });

  it('status kills, flawless rooms and materials count across runs', () => {
    const p = createProfile();
    p.quests.done.push('story_first_spark', 'story_rekindle_forge', 'story_twin_fire');
    p.quests.done.push('story_warden_ash', 'story_warden_falls');
    acceptQuest(p, 'errand_maren_burn');
    acceptQuest(p, 'errand_toll_iron');
    const run = createRun(2);
    run.tally.statusKills.burn = 18;
    run.materials.slag_iron = 7;
    applyRunToQuests(p, run, 'lost');
    applyRunToQuests(p, run, 'lost');
    expect(p.quests.progress.errand_maren_burn).toEqual([30]);
    expect(p.quests.progress.errand_toll_iron).toEqual([12]);
    expect(questStatus(p, 'errand_maren_burn')).toBe('ready');
  });

  it('defeating: a duel champion always counts, the world boss only on a win', () => {
    const p = createProfile();
    p.quests.done.push(
      'story_first_spark',
      'story_rekindle_forge',
      'story_twin_fire',
      'story_warden_ash',
    );
    acceptQuest(p, 'story_warden_falls');
    acceptQuest(p, 'errand_nix_duelist');
    const run = createRun(3);
    run.duelsWon.push('ember_duelist');
    applyRunToQuests(p, run, 'lost');
    expect(questStatus(p, 'errand_nix_duelist')).toBe('ready');
    expect(questStatus(p, 'story_warden_falls')).toBe('active');
    applyRunToQuests(p, run, 'won');
    expect(questStatus(p, 'story_warden_falls')).toBe('ready');
  });

  it('deliveries are checked against the stash and taken on hand-in', () => {
    const p = createProfile();
    acceptQuest(p, 'errand_toll_cores');
    expect(questStatus(p, 'errand_toll_cores')).toBe('active');
    addMaterials(p, { ember_core: 5 });
    expect(questStatus(p, 'errand_toll_cores')).toBe('ready');
    expect(claimQuest(p, 'errand_toll_cores')).toBe(true);
    expect(p.materials.ember_core).toBe(2);
    // Errands rotate: Toll's next one is a different job.
    expect(questFrom(p, 'toll')?.id).toBe('errand_toll_iron');
  });

  it('a quest item turns up once in its world while the quest is open', () => {
    const p = createProfile();
    p.quests.done.push('story_first_spark', 'story_rekindle_forge', 'story_twin_fire');
    const run = createRun(4);
    expect(questItemToFind(p, run)).toBeNull();
    acceptQuest(p, 'story_warden_ash');
    expect(questItemToFind(p, run)).toBe('warden_ash');
    run.tally.items.push('warden_ash');
    expect(questItemToFind(p, run)).toBeNull();
    expect(liveProgress(p, run, 'story_warden_ash')).toEqual([[1, 1]]);
    applyRunToQuests(p, run, 'lost');
    const before = p.spellsUnlocked.length;
    expect(claimQuest(p, 'story_warden_ash')).toBe(true);
    expect(p.spellsUnlocked).toContain('meteor');
    expect(p.spellsUnlocked.length).toBeGreaterThanOrEqual(before);
    expect(p.flags).toContain('knows_warden');
  });

  it('map symbols: boss, duel and event nodes for the goals that live there', () => {
    expect(questNodeTypes(quest('story_first_spark'))).toEqual(['boss']);
    expect(questNodeTypes(quest('story_twin_fire'))).toEqual(['duel']);
    expect(questNodeTypes(quest('story_warden_ash'))).toEqual(['event']);
    expect(questNodeTypes(quest('story_warden_falls'))).toEqual(['boss']);
    expect(questNodeTypes(quest('errand_maren_burn'))).toEqual([]);
  });

  it('content: 10 errands, a 5-step story chain, every requirement exists', () => {
    expect(QUESTS.filter((q) => q.kind === 'errand').length).toBe(10);
    expect(QUESTS.filter((q) => q.kind === 'story').length).toBe(5);
    for (const q of QUESTS) for (const r of q.requires) expect(questById(r), r).toBeDefined();
  });
});
