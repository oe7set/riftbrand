import { describe, expect, it } from 'vitest';
import { computeTouchLayout, hitTestButton } from './touch-layout';

const SCREENS: Array<[string, number, number]> = [
  ['phone landscape', 915, 412],
  ['phone portrait', 412, 915],
  ['tablet landscape', 1280, 800],
  ['desktop', 1920, 1080],
];

describe('touch layout', () => {
  it.each(SCREENS)('%s: all buttons on screen and not overlapping', (_name, w, h) => {
    const layout = computeTouchLayout(w, h);
    for (const b of layout.buttons) {
      expect(b.x - b.radius).toBeGreaterThanOrEqual(0);
      expect(b.y - b.radius).toBeGreaterThanOrEqual(0);
      expect(b.x + b.radius).toBeLessThanOrEqual(w);
      expect(b.y + b.radius).toBeLessThanOrEqual(h);
    }
    const bs = layout.buttons;
    for (let i = 0; i < bs.length; i++) {
      for (let j = i + 1; j < bs.length; j++) {
        const a = bs[i];
        const b = bs[j];
        if (!a || !b) continue;
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(a.radius + b.radius);
      }
    }
  });

  it('detects orientation', () => {
    expect(computeTouchLayout(900, 400).orientation).toBe('landscape');
    expect(computeTouchLayout(400, 900).orientation).toBe('portrait');
  });

  it('hit-tests buttons with grace radius', () => {
    const layout = computeTouchLayout(915, 412);
    const attack = layout.buttons.find((b) => b.id === 'attack');
    expect(attack).toBeDefined();
    if (!attack) return;
    expect(hitTestButton(layout, attack.x, attack.y)?.id).toBe('attack');
    expect(hitTestButton(layout, attack.x + attack.radius * 1.1, attack.y)?.id).toBe('attack');
    expect(hitTestButton(layout, 10, 10)).toBeNull();
  });
});
