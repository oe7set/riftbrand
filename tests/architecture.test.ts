import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SIM_DIR = join(__dirname, '..', 'src', 'sim');

function listSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...listSourceFiles(full));
    else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) files.push(full);
  }
  return files;
}

/** The sim must stay pure and deterministic so it runs headless and replays exactly. */
const FORBIDDEN: Array<[RegExp, string]> = [
  [/from\s+['"]pixi\.js['"]/, 'imports pixi.js'],
  [/from\s+['"][^'"]*\/(view|platform|app)\//, 'imports view/platform/app'],
  [/from\s+['"]node:/, 'imports Node built-ins'],
  [/\bMath\.random\b/, 'uses Math.random'],
  [/\bDate\.now\b|\bnew Date\b/, 'reads the wall clock'],
  [/\bperformance\.now\b/, 'reads performance.now'],
  [/\b(window|document|navigator|localStorage)\./, 'touches browser globals'],
  [/\basync\s|\bawait\s/, 'uses async logic'],
];

describe('architecture', () => {
  const files = listSourceFiles(SIM_DIR);

  it('finds sim sources', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((f) => [relative(SIM_DIR, f), f]))('sim/%s stays pure', (_name, file) => {
    const source = readFileSync(file, 'utf8');
    const violations = FORBIDDEN.filter(([pattern]) => pattern.test(source)).map(([, why]) => why);
    expect(violations).toEqual([]);
  });
});
