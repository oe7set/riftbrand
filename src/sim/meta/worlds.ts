import type { WorldDef } from '../../content/schema';
import { WORLDS, worldById } from '../../content/worlds';
import type { RunState } from '../run/run-state';
import type { Profile } from './profile';

/** What the profile remembers per world (ROADMAP M5.2). */
export interface WorldProgress {
  runs: number;
  /** World boss defeats; the first one opens the next world. */
  bossKills: number;
  /** Fastest winning run, seconds; null until the boss falls once. */
  bestTimeSec: number | null;
  /** Mini-bosses (duel champions, by enemy id) beaten at least once. */
  duelsWon: string[];
}

export function emptyWorldProgress(): WorldProgress {
  return { runs: 0, bossKills: 0, bestTimeSec: null, duelsWon: [] };
}

export function worldProgress(profile: Profile, worldId: string): WorldProgress {
  return profile.worlds[worldId] ?? emptyWorldProgress();
}

export function isWorldUnlocked(profile: Profile, world: WorldDef): boolean {
  if (world.unlock.kind === 'start') return true;
  return worldProgress(profile, world.unlock.world).bossKills > 0;
}

/** Built worlds can be entered; the others are on the map but arrive later (M6). */
export function isWorldPlayable(profile: Profile, world: WorldDef): boolean {
  return world.biome !== null && isWorldUnlocked(profile, world);
}

/** Mini-bosses a world has: one per duel line-up. */
export function worldDuelCount(world: WorldDef): number {
  return world.biome?.duelEncounters.length ?? 0;
}

/**
 * Books a finished run into its world's progress. Returns the worlds this run unlocked (first
 * boss kill), so the result screen can announce them.
 */
export function recordWorldRun(profile: Profile, run: RunState, result: 'won' | 'lost'): string[] {
  const before = WORLDS.filter((w) => isWorldUnlocked(profile, w)).map((w) => w.id);
  const progress = { ...worldProgress(profile, run.worldId) };
  progress.runs++;
  progress.duelsWon = [...progress.duelsWon];
  for (const id of run.duelsWon) if (!progress.duelsWon.includes(id)) progress.duelsWon.push(id);
  if (result === 'won') {
    progress.bossKills++;
    const time = Math.round(run.playTimeSec);
    progress.bestTimeSec =
      progress.bestTimeSec === null ? time : Math.min(progress.bestTimeSec, time);
  }
  profile.worlds[run.worldId] = progress;
  return WORLDS.filter((w) => isWorldUnlocked(profile, w) && !before.includes(w.id)).map(
    (w) => w.id,
  );
}

/** The world a new run should default to: the saved choice if still open, else the first. */
export function defaultWorld(profile: Profile, preferred: string | null): WorldDef {
  const pick = preferred ? worldById(preferred) : undefined;
  if (pick && isWorldPlayable(profile, pick)) return pick;
  return WORLDS[0] as WorldDef;
}
