import { z } from 'zod';
import type { RunState } from '../../sim/run/run-state';
import type { KeyValueStore } from './settings';

const STORAGE_KEY = 'riftbrand.run';
export const RUN_SAVE_VERSION = 1;

const mapNodeSchema = z.object({
  id: z.number().int().min(0),
  layer: z.number().int().min(0),
  x: z.number(),
  type: z.enum(['combat', 'elite', 'horde', 'rest', 'boss']),
  next: z.array(z.number().int().min(0)),
});

const runSchema = z.object({
  seed: z.number().int().min(0),
  biomeId: z.string(),
  map: z.object({ nodes: z.array(mapNodeSchema), layers: z.array(z.array(z.number().int())) }),
  currentNodeId: z.number().int().min(-1),
  visited: z.array(z.number().int()),
  status: z.enum(['map', 'room', 'won', 'lost']),
  hp: z.number().min(0),
  maxHp: z.number().positive(),
  kills: z.number().int().min(0),
  roomsCleared: z.number().int().min(0),
  playTimeSec: z.number().min(0),
});

const saveSchema = z.object({
  version: z.literal(RUN_SAVE_VERSION),
  run: runSchema,
});

/**
 * Upgrades older saves step by step (vN → vN+1). Unknown or broken data yields null:
 * a lost mid-run save is annoying, a crash on load is worse.
 */
export function migrateRunSave(raw: unknown): RunState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const data = raw as { version?: unknown };
  // Future migrations go here, e.g. if (data.version === 1) raw = migrate1to2(raw).
  if (data.version !== RUN_SAVE_VERSION) return null;
  const parsed = saveSchema.safeParse(raw);
  if (!parsed.success) return null;
  const run = parsed.data.run;
  // A run that ended has nothing to continue.
  if (run.status === 'won' || run.status === 'lost') return null;
  // Saved mid-room means the room restarts from its entry state.
  return run;
}

export function loadRun(store: KeyValueStore | null): RunState | null {
  try {
    const raw = store?.getItem(STORAGE_KEY);
    return raw ? migrateRunSave(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveRun(store: KeyValueStore | null, run: RunState): void {
  try {
    store?.setItem(STORAGE_KEY, JSON.stringify({ version: RUN_SAVE_VERSION, run }));
  } catch {
    // Storage full or blocked: the run continues, it just can't be resumed after a reload.
  }
}

export function clearRun(store: KeyValueStore | null): void {
  try {
    store?.removeItem?.(STORAGE_KEY);
  } catch {
    // Ignore: an orphaned save is filtered out on load once its run has ended.
  }
}
