import { describe, expect, it } from 'vitest';
import { SFX } from '../../content/audio/sfx';
import { recipeDurationSec, renderSfx } from './synth';

describe('synth', () => {
  it.each(Object.entries(SFX))(
    'renders "%s" as finite, audible, unclipped audio',
    (_id, recipe) => {
      const samples = renderSfx(recipe, 22050);
      expect(samples.length).toBe(Math.ceil(recipeDurationSec(recipe) * 22050));
      let peak = 0;
      for (const s of samples) {
        expect(Number.isFinite(s)).toBe(true);
        peak = Math.max(peak, Math.abs(s));
      }
      expect(peak).toBeGreaterThan(0.05);
      expect(peak).toBeLessThanOrEqual(1);
    },
  );

  it('is deterministic for the same seed', () => {
    const recipe = SFX.hit;
    expect(renderSfx(recipe, 8000, 5)).toEqual(renderSfx(recipe, 8000, 5));
  });

  it('keeps every effect short enough for rapid combat', () => {
    for (const [id, recipe] of Object.entries(SFX)) {
      expect(recipeDurationSec(recipe), id).toBeLessThan(1.6);
    }
  });
});
