import type { RoomReport } from '../../sim/bot/autoplay';
import type { KeyValueStore } from './settings';

const STORAGE_KEY = 'riftbrand.runlog';
/** TECH_DESIGN §13: the last 50 runs are kept. */
export const RUN_LOG_LIMIT = 50;

/** One finished run as seen by a real player (same room shape as the simulator's reports). */
export interface RunLogEntry {
  date: string;
  version: string;
  seed: number;
  result: 'won' | 'lost';
  roomsCleared: number;
  kills: number;
  timeSec: number;
  killedBy: string | null;
  dominant: string | null;
  boons: string[];
  relics: string[];
  evolutions: string[];
  /** Ember Tree ranks at the time of the run. */
  tree: Record<string, number>;
  rooms: RoomReport[];
  damageBySource: Record<string, number>;
}

export function loadRunLog(store: KeyValueStore | null): RunLogEntry[] {
  try {
    const raw = store?.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    // Diagnostics only: anything unreadable is simply dropped.
    return Array.isArray(parsed) ? (parsed as RunLogEntry[]) : [];
  } catch {
    return [];
  }
}

export function appendRunLog(store: KeyValueStore | null, entry: RunLogEntry): void {
  try {
    const log = loadRunLog(store);
    log.push(entry);
    store?.setItem(STORAGE_KEY, JSON.stringify(log.slice(-RUN_LOG_LIMIT)));
  } catch {
    // Full storage: the log is a nice-to-have, the game goes on.
  }
}

/** Offers a text file for download (run log export). */
export function downloadText(filename: string, text: string): void {
  try {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    // No download support: nothing else to do.
  }
}
