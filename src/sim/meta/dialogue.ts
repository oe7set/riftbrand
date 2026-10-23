import { DIALOGUE } from '../../content/dialogue';
import type { DialogueLineDef, Speaker } from '../../content/schema';
import type { Profile } from './profile';

function matches(line: DialogueLineDef, profile: Profile): boolean {
  const w = line.when;
  if (line.once && profile.seenDialogue.includes(line.id)) return false;
  if (!w) return true;
  const last = profile.lastRun;
  if (w.minRuns !== undefined && profile.runs < w.minRuns) return false;
  if (w.maxRuns !== undefined && profile.runs > w.maxRuns) return false;
  if (w.minWins !== undefined && profile.wins < w.minWins) return false;
  if (w.lastResult !== undefined && last?.result !== w.lastResult) return false;
  if (w.killedBy !== undefined && last?.killedBy !== w.killedBy) return false;
  if (w.lastDominant !== undefined && last?.dominant !== w.lastDominant) return false;
  if (w.reachedBoss !== undefined && (last?.reachedBoss ?? false) !== w.reachedBoss) return false;
  if (w.hasFlag !== undefined && !profile.flags.includes(w.hasFlag)) return false;
  if (w.lacksFlag !== undefined && profile.flags.includes(w.lacksFlag)) return false;
  return true;
}

/**
 * Picks what a hub character says now (GDD §2.6): the highest-priority matching line; among
 * repeatable fillers, rotate by run count so the same visit always shows the same line.
 */
export function pickLine(profile: Profile, speaker: Speaker): DialogueLineDef | null {
  let best: DialogueLineDef | null = null;
  const fillers: DialogueLineDef[] = [];
  for (const line of DIALOGUE) {
    if (line.speaker !== speaker || !matches(line, profile)) continue;
    if (!line.once) {
      fillers.push(line);
      continue;
    }
    if (!best || line.priority > best.priority) best = line;
  }
  if (best) return best;
  return fillers[profile.runs % Math.max(1, fillers.length)] ?? null;
}

/** Marks a shown line as seen and applies its story flag. */
export function markSeen(profile: Profile, line: DialogueLineDef): void {
  if (line.once && !profile.seenDialogue.includes(line.id)) profile.seenDialogue.push(line.id);
  if (line.setsFlag && !profile.flags.includes(line.setsFlag)) profile.flags.push(line.setsFlag);
}
