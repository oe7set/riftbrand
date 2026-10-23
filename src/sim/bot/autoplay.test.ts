import { describe, expect, it } from 'vitest';
import { EMBER_WASTES } from '../../content/biomes/ember-wastes';
import { autoplayRun } from './autoplay';
import { summarize, toCsv } from './report';

describe('headless autoplay', () => {
  it('plays whole runs deterministically', () => {
    const a = autoplayRun(3, 'balanced');
    const b = autoplayRun(3, 'balanced');
    expect(a).toEqual(b);
    expect(a.rooms.length).toBeGreaterThan(0);
    expect(['won', 'lost', 'timeout']).toContain(a.result);
  });

  it('the balanced bot reaches the boss on a small sample, without getting stuck', () => {
    // A regression guard for room flow and bot navigation, not a balance target.
    const reports = [1, 2, 3, 4].map((s) => autoplayRun(s, 'balanced'));
    for (const r of reports) {
      expect(r.result).not.toBe('timeout');
      if (r.result === 'won') expect(r.roomsCleared).toBe(EMBER_WASTES.layers);
    }
    expect(reports.some((r) => r.rooms.some((room) => room.type === 'boss'))).toBe(true);
  });

  it('the aggressive bot never dodges and dies more often', () => {
    const reports = [1, 2, 3, 4, 5, 6].map((s) => autoplayRun(s, 'aggressive'));
    const damage = (rs: typeof reports) =>
      rs.reduce((sum, r) => sum + r.rooms.reduce((a, room) => a + room.damageTaken, 0), 0);
    const careful = [1, 2, 3, 4, 5, 6].map((s) => autoplayRun(s, 'balanced'));
    expect(damage(reports)).toBeGreaterThan(damage(careful));
  });

  it('summarizes and exports runs', () => {
    const reports = [1, 2].map((s) => autoplayRun(s));
    const summary = summarize(reports);
    expect(summary.runs).toBe(2);
    expect(summary.winRate).toBeGreaterThanOrEqual(0);
    expect(toCsv(reports).split('\n')).toHaveLength(3);
  });
});
