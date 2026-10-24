import { describe, expect, it } from 'vitest';
import { ART_STYLES, artStyleById, mixColor } from '../../../content/art/styles';
import { RIGS } from '../../../content/rigs';
import { styleRig } from './style-rig';

describe('art styles (ROADMAP M4.5)', () => {
  const vesper = RIGS.find((r) => r.id === 'vesper');
  if (!vesper) throw new Error('missing vesper');

  it('neon leaves every rig as it is', () => {
    const neon = artStyleById('neon');
    for (const rig of RIGS) {
      const styled = styleRig(rig, neon);
      expect(styled.colors).toEqual(rig.colors);
      expect(styled.parts).toEqual(rig.parts);
    }
  });

  it('the player gets its explicit colours, other rigs are blended', () => {
    const firefly = artStyleById('firefly');
    expect(styleRig(vesper, firefly).colors).toEqual(firefly.rigs.overrides.vesper);
    const slag = RIGS.find((r) => r.id === 'slag');
    if (!slag) throw new Error('missing slag');
    expect(styleRig(slag, firefly).colors.body).toBe(
      mixColor(slag.colors.body, firefly.rigs.mixColor, firefly.rigs.mixAmount),
    );
  });

  it('eye styles turn glowing eye dots into eyes with pupils', () => {
    const head = (rig: typeof vesper) => rig.parts.find((p) => p.id === 'head')?.shapes ?? [];
    const before = head(vesper).length;
    const styled = styleRig(vesper, artStyleById('storybook'));
    expect(head(styled).length).toBe(before + 2);
    expect(head(styled).some((s) => s.fill === 0xffffff)).toBe(true);
  });

  it('every style keeps the player readable against its ground', () => {
    const luminance = (c: number) =>
      (0.2126 * ((c >> 16) & 0xff) + 0.7152 * ((c >> 8) & 0xff) + 0.0722 * (c & 0xff)) / 255;
    for (const style of ART_STYLES) {
      const body = styleRig(vesper, style).colors.body;
      // The player is the brightest thing on screen (GDD §12.1 rule 1).
      expect(luminance(body) - luminance(style.background), style.id).toBeGreaterThan(0.35);
    }
  });

  it('mixColor blends channel by channel', () => {
    expect(mixColor(0x000000, 0xffffff, 0.5)).toBe(0x808080);
    expect(mixColor(0x123456, 0xffffff, 0)).toBe(0x123456);
  });
});
