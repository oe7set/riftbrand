import { describe, expect, it } from 'vitest';
import { glyphSchema } from '../../../content/schema';
import { FRAMES, GLYPHS, type IconFrame } from './glyphs';
import { iconKey, iconSvg, iconUrl } from './icon-svg';

describe('icon set (ROADMAP M4.3)', () => {
  it('draws every glyph in every frame', () => {
    for (const glyph of glyphSchema.options) {
      expect(GLYPHS[glyph].length, glyph).toBeGreaterThan(0);
      for (const frame of Object.keys(FRAMES) as IconFrame[]) {
        const svg = iconSvg({ frame, glyph, color: '#ff8a3d' });
        expect(svg.startsWith('<svg')).toBe(true);
        expect(svg).toContain(FRAMES[frame]);
      }
    }
  });

  it('gives frames distinct shapes so kinds differ without colour', () => {
    expect(new Set(Object.values(FRAMES)).size).toBe(Object.keys(FRAMES).length);
  });

  it('caches data URLs per spec', () => {
    const spec = { frame: 'relic' as const, glyph: 'gem' as const, color: '#6bff9a' };
    expect(iconUrl(spec)).toBe(iconUrl({ ...spec }));
    expect(iconKey(spec)).not.toBe(iconKey({ ...spec, rim: '#ffd36b' }));
    expect(iconUrl(spec).startsWith('data:image/svg+xml')).toBe(true);
  });
});
