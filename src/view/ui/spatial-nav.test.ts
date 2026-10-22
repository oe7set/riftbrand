import { describe, expect, it } from 'vitest';
import { pickInDirection } from './spatial-nav';

const box = (x: number, y: number) => ({ x, y, width: 40, height: 40 });

describe('pickInDirection', () => {
  const from = box(100, 100);
  const candidates = [box(100, 20), box(180, 100), box(100, 200), box(20, 100), box(170, 30)];

  it('picks the closest element in each direction', () => {
    expect(pickInDirection(from, candidates, 'up')).toBe(0);
    expect(pickInDirection(from, candidates, 'right')).toBe(1);
    expect(pickInDirection(from, candidates, 'down')).toBe(2);
    expect(pickInDirection(from, candidates, 'left')).toBe(3);
  });

  it('prefers aligned targets over diagonal ones', () => {
    expect(pickInDirection(from, [box(170, 30), box(110, 0)], 'up')).toBe(1);
  });

  it('returns -1 when nothing lies in that direction', () => {
    expect(pickInDirection(from, [box(100, 300)], 'up')).toBe(-1);
  });
});
