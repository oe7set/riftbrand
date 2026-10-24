import type { Glyph } from '../../../content/schema';
import { FRAMES, GLYPH_SCALE, GLYPHS, type GlyphPart, type IconFrame } from './glyphs';

/** Everything that decides how an icon looks; equal specs give equal icons (cache key). */
export interface IconSpec {
  frame: IconFrame;
  glyph: Glyph;
  /** Glyph and frame colour (being, school or rarity colour), CSS hex like '#ff8a3d'. */
  color: string;
  /** Optional outer rim in a second colour, e.g. the rarity of a boon. */
  rim?: string;
}

/** Picture-book icons (ROADMAP M4.5): warm brown card, ink outline, inked glyph. */
const BACKGROUND = '#4a3428';
const CORE = '#fff6e6';
const INK = '#2a1d2e';
/** Extra stroke width of the ink line around glyph parts (box units). */
const GLYPH_INK = 1.7;

export function iconKey(spec: IconSpec): string {
  return `${spec.frame}|${spec.glyph}|${spec.color}|${spec.rim ?? ''}`;
}

/** CSS hex colour from a 0xRRGGBB number. */
export function cssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/** The ink silhouette of a glyph part, drawn under it. */
function inkSvg(part: GlyphPart): string {
  const width =
    (part.paint === 'fill' || part.paint === 'core' || part.paint === 'hole'
      ? 0
      : (part.width ?? 1.8)) + GLYPH_INK;
  const fill = part.paint === 'fill' || part.paint === 'core' ? INK : 'none';
  return `<path d="${part.d}" fill="${fill}" stroke="${INK}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function partSvg(part: GlyphPart, color: string): string {
  const width = part.width ?? 1.8;
  const stroke = (c: string) =>
    `fill="none" stroke="${c}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`;
  switch (part.paint) {
    case 'fill':
      return `<path d="${part.d}" fill="${color}"/>`;
    case 'core':
      return `<path d="${part.d}" fill="${CORE}"/>`;
    case 'hole':
      return `<path d="${part.d}" fill="${BACKGROUND}"/>`;
    case 'stroke':
      return `<path d="${part.d}" ${stroke(color)}/>`;
    case 'coreStroke':
      return `<path d="${part.d}" ${stroke(CORE)}/>`;
    case 'holeStroke':
      return `<path d="${part.d}" ${stroke(BACKGROUND)}/>`;
  }
}

/**
 * The icon as standalone SVG markup (ROADMAP M4.3, picture-book look since M4.5): a brown card in
 * the kind's shape with an ink border and a coloured band, the glyph inked on top. Menus show it
 * as an image; the game rasterises it into textures.
 */
export function iconSvg(spec: IconSpec): string {
  const frame = FRAMES[spec.frame];
  const scale = GLYPH_SCALE[spec.frame];
  // Centre the 24-box glyph in the 32-box frame.
  const offset = 16 - 12 * scale;
  const parts = GLYPHS[spec.glyph];
  const ink = parts.filter((p) => p.paint !== 'hole' && p.paint !== 'holeStroke').map(inkSvg);
  const glyph = parts.map((p) => partSvg(p, spec.color)).join('');
  const ring =
    spec.frame === 'aura'
      ? `<circle cx="16" cy="16" r="15" fill="none" stroke="${INK}" stroke-width="2.6"/>` +
        `<circle cx="16" cy="16" r="15" fill="none" stroke="${spec.color}" stroke-width="1.2"/>`
      : '';
  const chevrons =
    spec.frame === 'upgrade'
      ? `<path d="M10 7.5 L16 3.6 L22 7.5" fill="none" stroke="${INK}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>` +
        `<path d="M10 7.5 L16 3.6 L22 7.5" fill="none" stroke="${spec.color}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>`
      : '';
  const rim = spec.rim
    ? `<path d="${frame}" fill="none" stroke="${spec.rim}" stroke-width="4.6"/>`
    : '';
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 36 36" width="72" height="72">' +
    rim +
    `<path d="${frame}" fill="${BACKGROUND}" stroke="${INK}" stroke-width="3.4" stroke-linejoin="round"/>` +
    `<path d="${frame}" fill="none" stroke="${spec.color}" stroke-width="1.2" stroke-linejoin="round"/>` +
    ring +
    chevrons +
    `<g transform="translate(${offset} ${offset}) scale(${scale})">${ink.join('')}${glyph}</g>` +
    '</svg>'
  );
}

const urlCache = new Map<string, string>();

/** Data URL for <img src>, cached per spec. */
export function iconUrl(spec: IconSpec): string {
  const key = iconKey(spec);
  let url = urlCache.get(key);
  if (!url) {
    url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(iconSvg(spec))}`;
    urlCache.set(key, url);
  }
  return url;
}
