/**
 * Registry of live-tunable numbers for the debug menu. Content modules register the plain
 * objects the sim reads, so a slider change takes effect on the next tick, and the diff
 * against the registered defaults can be exported as code.
 */
export interface TunableRange {
  min: number;
  max: number;
  step: number;
}

export interface TunableGroup {
  /** Shown as section title, e.g. "player" or "enemy: slag". */
  readonly label: string;
  /** Where the values live in source, used in the export comment. */
  readonly source: string;
  readonly target: Record<string, number>;
  readonly keys: readonly string[];
  readonly defaults: Readonly<Record<string, number>>;
  readonly ranges: Readonly<Record<string, TunableRange>>;
}

const groups: TunableGroup[] = [];

/** Default slider range when a value has no explicit range: 0 … 3× the default. */
export function autoRange(value: number): TunableRange {
  if (value === 0) return { min: 0, max: 1, step: 0.01 };
  const max = Math.abs(value) * 3;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  return { min: value < 0 ? -max : 0, max, step: magnitude / 100 };
}

export function registerTunables(
  label: string,
  source: string,
  target: object,
  ranges: Partial<Record<string, TunableRange>> = {},
  keys?: readonly string[],
): void {
  const record = target as Record<string, unknown>;
  const numericKeys = (keys ?? Object.keys(record)).filter((k) => typeof record[k] === 'number');
  const defaults: Record<string, number> = {};
  const resolved: Record<string, TunableRange> = {};
  for (const key of numericKeys) {
    const value = record[key] as number;
    defaults[key] = value;
    resolved[key] = ranges[key] ?? autoRange(value);
  }
  groups.push({
    label,
    source,
    target: target as Record<string, number>,
    keys: numericKeys,
    defaults: Object.freeze(defaults),
    ranges: resolved,
  });
}

export function tunableGroups(): readonly TunableGroup[] {
  return groups;
}

export function resetTunables(): void {
  for (const g of groups) Object.assign(g.target, g.defaults);
}

/** Changed values grouped by source file, ready to paste. */
export function exportTunablesDiff(): string {
  const blocks: string[] = [];
  for (const g of groups) {
    const lines = g.keys
      .filter((k) => g.target[k] !== g.defaults[k])
      .map((k) => `  ${k}: ${g.target[k]},`);
    if (lines.length > 0) blocks.push(`// ${g.label} (${g.source})\n${lines.join('\n')}`);
  }
  return blocks.length === 0 ? '// No tuning changes.' : blocks.join('\n\n');
}
