/**
 * Headless simulator (TECH_DESIGN §13): bots play whole runs without rendering and print a
 * balancing summary. Run: pnpm sim --runs 200 --seed-start 1 --bot balanced [--csv] [--fresh]
 * Results are also written to sim-results/ (git-ignored).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { autoplayRun, type RunReport } from '../src/sim/bot/autoplay';
import type { BotStrategy } from '../src/sim/bot/bot';
import { summarize, toCsv } from '../src/sim/bot/report';
import { createProfile, emptyRunMeta, lockedRelics } from '../src/sim/meta/profile';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback;
}

const runs = Number(arg('runs', '100'));
const seedStart = Number(arg('seed-start', '1'));
const bot = arg('bot', 'balanced') as BotStrategy;
// --fresh: a brand-new profile (locked relics, no Ember Tree), the first-run experience.
const locked = process.argv.includes('--fresh') ? lockedRelics(createProfile()) : [];
if (bot !== 'balanced' && bot !== 'aggressive') throw new Error(`unknown bot "${bot}"`);

const started = Date.now();
const reports: RunReport[] = [];
for (let i = 0; i < runs; i++) {
  reports.push(autoplayRun(seedStart + i, bot, emptyRunMeta(), locked));
}
const summary = summarize(reports);

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const top = (map: Record<string, { picked: number; won: number }>) =>
  Object.entries(map)
    .sort((a, b) => b[1].picked - a[1].picked)
    .map(
      ([id, s]) =>
        `  ${id.padEnd(18)} picked ${String(s.picked).padStart(4)}  win ${pct(s.won / s.picked)}`,
    )
    .join('\n');

console.log(
  `Riftbrand sim: ${runs} runs, bot "${bot}", seeds ${seedStart}…${seedStart + runs - 1}`,
);
console.log(
  `win ${pct(summary.winRate)} · timeout ${pct(summary.timeoutRate)} · rooms ${summary.avgRoomsCleared.toFixed(1)} · run ${summary.avgRunSec.toFixed(0)} s`,
);
if (summary.bossSec) {
  const b = summary.bossSec;
  console.log(
    `boss fight: ${b.min.toFixed(0)}–${b.max.toFixed(0)} s (avg ${b.avg.toFixed(0)} s, GDD target 120–240 s)`,
  );
}
console.log(
  'room time:',
  Object.entries(summary.roomSec)
    .map(([t, s]) => `${t} ${s.toFixed(0)} s`)
    .join(' · '),
);
console.log('deaths:', JSON.stringify(summary.deathCauses));
console.log(
  'damage taken by source:',
  JSON.stringify(
    Object.fromEntries(Object.entries(summary.damageBySource).map(([k, v]) => [k, Math.round(v)])),
  ),
);
console.log(`boons:\n${top(summary.boons)}`);
console.log(`relics:\n${top(summary.relics)}`);

mkdirSync('sim-results', { recursive: true });
const base = `sim-results/sim-${bot}-${seedStart}-${runs}`;
writeFileSync(`${base}.json`, JSON.stringify({ summary, reports }, null, 2));
if (process.argv.includes('--csv')) writeFileSync(`${base}.csv`, toCsv(reports));
console.log(`wrote ${base}.json in ${((Date.now() - started) / 1000).toFixed(1)} s`);
