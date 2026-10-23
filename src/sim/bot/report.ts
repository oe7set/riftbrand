import { ENEMIES } from '../../content/enemies';
import type { RunReport } from './autoplay';

interface PickStats {
  picked: number;
  won: number;
}

/** Balancing summary over many simulated runs (TECH_DESIGN §13). */
export interface SimSummary {
  runs: number;
  winRate: number;
  timeoutRate: number;
  avgRoomsCleared: number;
  avgRunSec: number;
  deathCauses: Record<string, number>;
  /** Average seconds per room type. */
  roomSec: Record<string, number>;
  bossSec: { min: number; avg: number; max: number } | null;
  /** How often each boon/relic ended up in a build, and how often that build won. */
  boons: Record<string, PickStats>;
  relics: Record<string, PickStats>;
  spells: Record<string, PickStats>;
  damageBySource: Record<string, number>;
  /** Share of all damage dealt per player source (0..1). */
  dealtShare: Record<string, number>;
  /** Spells, auras and status effects together (ROADMAP M3.7 target: 15–30 %). */
  magicShare: number;
  /** Active spell casts per minute of run time. */
  spellCastsPerMin: number;
  /** Runs lost to a champion (duel mini-boss), as a share of all runs. */
  championDeathRate: number;
}

/** Player sources that count as magic for the M3.7 target. */
const MAGIC_SOURCES = ['spell', 'aura', 'status'];

function bump(map: Record<string, PickStats>, id: string, won: boolean): void {
  const s = map[id] ?? { picked: 0, won: 0 };
  s.picked++;
  if (won) s.won++;
  map[id] = s;
}

export function summarize(reports: readonly RunReport[]): SimSummary {
  const n = Math.max(1, reports.length);
  const deathCauses: Record<string, number> = {};
  const roomTotals: Record<string, { sec: number; count: number }> = {};
  const boons: Record<string, PickStats> = {};
  const relics: Record<string, PickStats> = {};
  const spells: Record<string, PickStats> = {};
  const damageBySource: Record<string, number> = {};
  const dealt: Record<string, number> = {};
  const boss: number[] = [];
  let wins = 0;
  let timeouts = 0;
  let rooms = 0;
  let sec = 0;
  let casts = 0;
  let championDeaths = 0;
  for (const r of reports) {
    casts += r.spellCasts ?? 0;
    if (r.result === 'lost' && ENEMIES.find((e) => e.id === r.killedBy)?.role === 'champion') {
      championDeaths++;
    }
    const won = r.result === 'won';
    if (won) wins++;
    if (r.result === 'timeout') timeouts++;
    if (r.result === 'lost') {
      const cause = r.killedBy ?? 'unknown';
      deathCauses[cause] = (deathCauses[cause] ?? 0) + 1;
    }
    rooms += r.roomsCleared;
    sec += r.timeSec;
    for (const room of r.rooms) {
      const t = roomTotals[room.type] ?? { sec: 0, count: 0 };
      t.sec += room.timeSec;
      t.count++;
      roomTotals[room.type] = t;
      if (room.type === 'boss' && room.cleared) boss.push(room.timeSec);
    }
    for (const id of r.boons) bump(boons, id, won);
    for (const id of r.relics) bump(relics, id, won);
    for (const id of r.spells ?? []) bump(spells, id, won);
    for (const [id, amount] of Object.entries(r.damageBySource)) {
      damageBySource[id] = (damageBySource[id] ?? 0) + amount;
    }
    for (const [id, amount] of Object.entries(r.damageDealt)) {
      dealt[id] = (dealt[id] ?? 0) + amount;
    }
  }
  const dealtTotal = Object.values(dealt).reduce((a, b) => a + b, 0) || 1;
  const dealtShare: Record<string, number> = {};
  for (const [id, amount] of Object.entries(dealt)) dealtShare[id] = amount / dealtTotal;
  const roomSec: Record<string, number> = {};
  for (const [type, t] of Object.entries(roomTotals)) roomSec[type] = t.sec / t.count;
  return {
    runs: reports.length,
    winRate: wins / n,
    timeoutRate: timeouts / n,
    avgRoomsCleared: rooms / n,
    avgRunSec: sec / n,
    deathCauses,
    roomSec,
    bossSec:
      boss.length > 0
        ? {
            min: Math.min(...boss),
            avg: boss.reduce((a, b) => a + b, 0) / boss.length,
            max: Math.max(...boss),
          }
        : null,
    boons,
    relics,
    spells,
    damageBySource,
    dealtShare,
    magicShare: MAGIC_SOURCES.reduce((sum, id) => sum + (dealtShare[id] ?? 0), 0),
    spellCastsPerMin: sec > 0 ? casts / (sec / 60) : 0,
    championDeathRate: championDeaths / n,
  };
}

/** One row per run, for spreadsheets. */
export function toCsv(reports: readonly RunReport[]): string {
  const header = 'seed,strategy,result,rooms,kills,time_sec,killed_by,dominant,boons,relics';
  const rows = reports.map((r) =>
    [
      r.seed,
      r.strategy,
      r.result,
      r.roomsCleared,
      r.kills,
      r.timeSec,
      r.killedBy ?? '',
      r.dominant ?? '',
      r.boons.join('|'),
      r.relics.join('|'),
    ].join(','),
  );
  return [header, ...rows].join('\n');
}
