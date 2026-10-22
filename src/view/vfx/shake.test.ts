import { describe, expect, it } from 'vitest';
import { ScreenShake } from './shake';

describe('ScreenShake', () => {
  it('scales quadratically with trauma and decays to rest', () => {
    const s = new ScreenShake();
    s.add(0.5);
    s.add(0.8);
    expect(s.trauma).toBe(1);
    for (let i = 0; i < 120; i++) s.update(1 / 60, 10, 0.02, 2);
    expect(s.trauma).toBe(0);
    expect(s.offsetX).toBe(0);
  });

  it('respects the intensity setting', () => {
    const s = new ScreenShake();
    s.intensity = 0;
    s.add(1);
    s.update(0.05, 10, 0.02, 2);
    expect(s.offsetX).toBe(0);
    expect(s.offsetY).toBe(0);
  });
});
