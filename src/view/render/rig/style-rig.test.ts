import { describe, expect, it } from 'vitest';
import { ART_STYLE, mixColor } from '../../../content/art/style';
import { RIGS } from '../../../content/rigs';
import { styleRig } from './style-rig';

describe('picture-book style (ROADMAP M4.5)', () => {
  const vesper = RIGS.find((r) => r.id === 'vesper');
  if (!vesper) throw new Error('missing vesper');

  it('the player gets its explicit colours, other rigs are blended', () => {
    expect(styleRig(vesper, ART_STYLE).colors).toEqual(ART_STYLE.rigs.overrides.vesper);
    const slag = RIGS.find((r) => r.id === 'slag');
    if (!slag) throw new Error('missing slag');
    expect(styleRig(slag, ART_STYLE).colors.body).toBe(
      mixColor(slag.colors.body, ART_STYLE.rigs.mixColor, ART_STYLE.rigs.mixAmount),
    );
  });

  it('glowing eye dots become blinking eyes with pupils, right after the head', () => {
    const styled = styleRig(vesper, ART_STYLE);
    const ids = styled.parts.map((p) => p.id);
    expect(ids.indexOf('eyes')).toBe(ids.indexOf('head') + 1);
    const eyes = styled.parts.find((p) => p.id === 'eyes');
    expect(eyes?.parent).toBe('head');
    expect(eyes?.motion.blink).toBe(1);
    expect(eyes?.shapes.some((s) => s.fill === 0xffffff)).toBe(true);
    // The head keeps everything but the eye dot.
    const before = vesper.parts.find((p) => p.id === 'head')?.shapes.length ?? 0;
    expect(styled.parts.find((p) => p.id === 'head')?.shapes.length).toBe(before - 1);
  });

  it('every styled rig still has unique part ids and valid parents', () => {
    for (const rig of RIGS) {
      const styled = styleRig(rig, ART_STYLE);
      const ids = styled.parts.map((p) => p.id);
      expect(new Set(ids).size, rig.id).toBe(ids.length);
      styled.parts.forEach((p, i) => {
        if (p.parent) expect(ids.indexOf(p.parent), `${rig.id}.${p.id}`).toBeLessThan(i);
      });
    }
  });

  it('keeps the player readable against the ground', () => {
    const luminance = (c: number) =>
      (0.2126 * ((c >> 16) & 0xff) + 0.7152 * ((c >> 8) & 0xff) + 0.0722 * (c & 0xff)) / 255;
    const body = styleRig(vesper, ART_STYLE).colors.body;
    // The player is the brightest thing on screen (GDD §12.1 rule 1).
    expect(luminance(body) - luminance(ART_STYLE.background)).toBeGreaterThan(0.35);
  });

  it('mixColor blends channel by channel', () => {
    expect(mixColor(0x000000, 0xffffff, 0.5)).toBe(0x808080);
    expect(mixColor(0x123456, 0xffffff, 0)).toBe(0x123456);
  });
});
