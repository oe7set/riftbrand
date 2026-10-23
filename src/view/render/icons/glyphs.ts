import type { Glyph } from '../../../content/schema';

/**
 * How a glyph part is painted: in the icon colour (fill or stroke), bright white (core), or cut
 * out in the background colour (hole).
 */
export type GlyphPaint = 'fill' | 'stroke' | 'core' | 'coreStroke' | 'hole' | 'holeStroke';

export interface GlyphPart {
  /** SVG path data in a 24×24 box. */
  d: string;
  paint: GlyphPaint;
  /** Stroke width for stroke paints (box units). */
  width?: number;
}

/** A full circle as path data, so every part is a plain path. */
function circle(cx: number, cy: number, r: number): string {
  return `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 Z`;
}

/**
 * Icon glyphs (ROADMAP M4.3). Shapes differ by silhouette, not only by colour, so they stay
 * readable for colour-blind players and at thumb size.
 */
export const GLYPHS: Record<Glyph, readonly GlyphPart[]> = {
  flame: [
    {
      d: 'M12 3.5 C14.2 7.8 17.5 9.6 17.5 13.8 A5.5 5.5 0 0 1 6.5 13.8 C6.5 10.6 8.6 9.4 9.8 6.8 C11 8.9 12 9.6 12 3.5 Z',
      paint: 'fill',
    },
    {
      d: 'M12 11 C13.1 13 14.7 13.6 14.7 15.6 A2.7 2.7 0 0 1 9.3 15.6 C9.3 14 10.9 13.4 12 11 Z',
      paint: 'core',
    },
  ],
  snowflake: [
    { d: 'M12 3.5 V20.5 M4.6 7.8 L19.4 16.2 M4.6 16.2 L19.4 7.8', paint: 'stroke', width: 2 },
    { d: 'M9.5 4.8 L12 7 L14.5 4.8 M9.5 19.2 L12 17 L14.5 19.2', paint: 'stroke', width: 1.4 },
    { d: circle(12, 12, 1.8), paint: 'core' },
  ],
  drop: [
    {
      d: 'M12 3.5 C15 8.5 17.8 11.2 17.8 14.5 A5.8 5.8 0 0 1 6.2 14.5 C6.2 11.2 9 8.5 12 3.5 Z',
      paint: 'fill',
    },
    { d: circle(9.9, 14, 1.3), paint: 'core' },
  ],
  eye: [
    { d: 'M3.5 12 Q12 4.5 20.5 12 Q12 19.5 3.5 12 Z', paint: 'stroke', width: 1.8 },
    { d: circle(12, 12, 3), paint: 'fill' },
    { d: circle(12.9, 11.1, 1), paint: 'core' },
  ],
  ray: [
    { d: 'M4.5 19.5 L15.5 8.5', paint: 'stroke', width: 2.4 },
    {
      d: 'M16.5 3 L17.7 6.3 L21 7.5 L17.7 8.7 L16.5 12 L15.3 8.7 L12 7.5 L15.3 6.3 Z',
      paint: 'core',
    },
  ],
  nova: [
    {
      d: 'M12 3.5 V7 M12 17 V20.5 M3.5 12 H7 M17 12 H20.5 M6 6 L8.5 8.5 M15.5 15.5 L18 18 M6 18 L8.5 15.5 M15.5 8.5 L18 6',
      paint: 'stroke',
      width: 2,
    },
    { d: circle(12, 12, 2.8), paint: 'core' },
  ],
  meteor: [
    { d: 'M3.5 9.5 L10 16 M5.5 5.5 L13 13 M9.5 3.5 L14 8', paint: 'stroke', width: 1.4 },
    { d: circle(15.5, 15.5, 4.3), paint: 'fill' },
    { d: circle(16.6, 14.4, 1.5), paint: 'core' },
  ],
  cloud: [
    {
      d: 'M7 17.5 A3.6 3.6 0 0 1 7.4 10.3 A4.7 4.7 0 0 1 16.2 9.2 A4.2 4.2 0 0 1 17 17.5 Z',
      paint: 'fill',
    },
    { d: circle(10, 13, 1), paint: 'core' },
  ],
  heart: [
    {
      d: 'M12 19.5 C6 15 3.8 12.2 3.8 9 A4.1 4.1 0 0 1 12 7.6 A4.1 4.1 0 0 1 20.2 9 C20.2 12.2 18 15 12 19.5 Z',
      paint: 'fill',
    },
    { d: circle(8.6, 9.6, 1.2), paint: 'core' },
  ],
  blade: [
    { d: 'M12 3 L14.2 5.8 L14.2 15 L9.8 15 L9.8 5.8 Z', paint: 'fill' },
    { d: 'M12 5 L12.7 6.3 L12.7 14 L11.3 14 L11.3 6.3 Z', paint: 'core' },
    { d: 'M7 15.6 H17 M12 16 V21', paint: 'stroke', width: 2 },
  ],
  swirl: [
    {
      d: 'M12 12 C12 10.2 14 10.2 14 12 C14 14.8 9.6 14.8 9.6 12 C9.6 7.6 16.6 7.6 16.6 12 C16.6 17.8 7 17.8 7 12 C7 6.2 13 4.6 17.5 6.6',
      paint: 'stroke',
      width: 2,
    },
  ],
  shot: [
    { d: 'M20.5 12 L13 8 L6.5 12 L13 16 Z', paint: 'fill' },
    { d: 'M18 12 L13 10 L10 12 L13 14 Z', paint: 'core' },
    { d: 'M3 12 H5.5 M3.5 9 H6 M3.5 15 H6', paint: 'stroke', width: 1.4 },
  ],
  trail: [
    {
      d: 'M3.5 17.5 C7.5 17.5 8.5 14.5 11.5 14.5 M6.5 20.5 C10.5 20.5 11.5 17.5 15.5 17.5',
      paint: 'stroke',
      width: 1.8,
    },
    { d: 'M17 4 L18.2 7.8 L22 9 L18.2 10.2 L17 14 L15.8 10.2 L12 9 L15.8 7.8 Z', paint: 'fill' },
    { d: circle(17, 9, 1.1), paint: 'core' },
  ],
  spark: [
    { d: 'M12 3 L13.9 10.1 L21 12 L13.9 13.9 L12 21 L10.1 13.9 L3 12 L10.1 10.1 Z', paint: 'fill' },
    { d: circle(12, 12, 1.6), paint: 'core' },
  ],
  fang: [
    { d: 'M4.5 5.5 H19.5 L17.2 8 L15.6 18 L13.4 8.6 H10.6 L8.4 18 L6.8 8 Z', paint: 'fill' },
    { d: 'M7.6 8 L8.4 14 L9.2 8 Z', paint: 'core' },
  ],
  skull: [
    {
      d: 'M12 3.5 A7.3 7.3 0 0 1 19.3 10.8 C19.3 13.4 17.8 14.6 16.6 15.2 V19 H7.4 V15.2 C6.2 14.6 4.7 13.4 4.7 10.8 A7.3 7.3 0 0 1 12 3.5 Z',
      paint: 'fill',
    },
    { d: `${circle(9.2, 11, 1.8)} ${circle(14.8, 11, 1.8)}`, paint: 'hole' },
    { d: 'M10.4 16 V19 M13.6 16 V19', paint: 'holeStroke', width: 1.2 },
  ],
  wing: [
    {
      d: 'M3.5 15.5 C6.5 7 13 4.5 20.5 4.5 C18.6 7.6 16.5 8.8 13.4 9.4 C15.8 9.8 17.5 10.4 18.5 11.6 C15.4 12.8 12.8 12.8 10.6 12.2 C12.2 13.2 13.2 14.4 13.8 16 C10.2 17 6.8 17 3.5 15.5 Z',
      paint: 'fill',
    },
    { d: 'M6 14.5 C9 11 12 9 16 7', paint: 'coreStroke', width: 1 },
  ],
  ring: [
    { d: circle(12, 14, 5.6), paint: 'stroke', width: 2.3 },
    { d: 'M12 3.2 L14.8 6.3 L12 9.4 L9.2 6.3 Z', paint: 'fill' },
    { d: 'M12 4.6 L13.4 6.3 L12 8 Z', paint: 'core' },
  ],
  shard: [
    { d: 'M12 3 L16.4 8.8 L14.2 20.5 L9.8 20.5 L7.6 8.8 Z', paint: 'fill' },
    { d: 'M12 5.5 L13.8 9 L12 17.5 Z', paint: 'core' },
  ],
  boot: [
    { d: 'M8.5 3.5 H13.5 V12.6 L19.5 14.6 V19.5 H8.5 Z', paint: 'fill' },
    { d: 'M8.5 17 H19.5', paint: 'holeStroke', width: 1.2 },
    { d: 'M2.8 8.5 H6 M3.6 12.5 H6.4', paint: 'stroke', width: 1.6 },
  ],
  hand: [
    {
      d: 'M7.5 20 V11 A1.25 1.25 0 0 1 10 11 V6 A1.25 1.25 0 0 1 12.5 6 V10 V5 A1.25 1.25 0 0 1 15 5 V10 V7 A1.25 1.25 0 0 1 17.5 7 V15 C17.5 18 15.7 20 13 20 Z',
      paint: 'fill',
    },
    { d: 'M5 15 C3.5 13 4 11 5.5 10', paint: 'stroke', width: 1.4 },
  ],
  hourglass: [
    {
      d: 'M6.5 3.5 H17.5 M6.5 20.5 H17.5 M8 3.5 C8 9 12 10 12 12 C12 14 8 15 8 20.5 M16 3.5 C16 9 12 10 12 12 C12 14 16 15 16 20.5',
      paint: 'stroke',
      width: 1.8,
    },
    { d: 'M9.4 19 C10 17 11.4 15.8 12 15.4 C12.6 15.8 14 17 14.6 19 Z', paint: 'fill' },
    { d: 'M10.5 7.5 H13.5 L12 9.5 Z', paint: 'core' },
  ],
  shield: [
    {
      d: 'M12 3 L19.5 5.8 V11.4 C19.5 15.6 16.3 18.8 12 21 C7.7 18.8 4.5 15.6 4.5 11.4 V5.8 Z',
      paint: 'fill',
    },
    { d: 'M12 6 V18 M7.5 10.5 H16.5', paint: 'holeStroke', width: 1.3 },
  ],
  gem: [
    { d: 'M7.8 4.5 H16.2 L20.5 10 L12 20.5 L3.5 10 Z', paint: 'fill' },
    { d: 'M3.5 10 H20.5 M7.8 4.5 L10 10 L12 20.5 L14 10 L16.2 4.5', paint: 'holeStroke', width: 1 },
    { d: 'M8.5 6 L9.6 9 H6 Z', paint: 'core' },
  ],
  stone: [
    { d: 'M5.5 15.5 L4.5 10 L8.8 5.5 L15.2 5 L19.5 9 L19 15.2 L13.2 19 L8 18.5 Z', paint: 'fill' },
    { d: 'M10 7.5 L12.2 11 L10.4 14.6', paint: 'coreStroke', width: 1.3 },
  ],
  wind: [
    {
      d: 'M3.5 9 H14 A3 3 0 1 0 11 6 M3.5 13 H17 A3 3 0 1 1 14 16 M3.5 17 H9.5',
      paint: 'stroke',
      width: 2,
    },
  ],
  bone: [
    { d: 'M8 8 L16 16', paint: 'stroke', width: 3 },
    {
      d: `${circle(6.6, 9, 2.1)} ${circle(9, 6.6, 2.1)} ${circle(15, 17.4, 2.1)} ${circle(17.4, 15, 2.1)}`,
      paint: 'fill',
    },
  ],
  coin: [
    { d: circle(12, 12, 7.5), paint: 'fill' },
    { d: circle(12, 12, 5.3), paint: 'holeStroke', width: 1 },
    { d: 'M12 8.3 L14.4 12 L12 15.7 L9.6 12 Z', paint: 'core' },
  ],
  crown: [
    { d: 'M4 17.5 L5 7 L9.5 11.5 L12 4.5 L14.5 11.5 L19 7 L20 17.5 Z', paint: 'fill' },
    { d: 'M4 20 H20', paint: 'stroke', width: 1.8 },
    { d: circle(12, 14, 1.4), paint: 'core' },
  ],
};

/** Frames (ROADMAP M4.3): the frame shape tells the kind of thing at a glance. */
export type IconFrame =
  | 'boon'
  | 'relic'
  | 'spell'
  | 'aura'
  | 'upgrade'
  | 'status'
  | 'material'
  | 'quest';

/** Frame outlines in a 32×32 box, centred on 16,16. */
export const FRAMES: Record<IconFrame, string> = {
  boon: circle(16, 16, 14),
  relic: 'M16 1.8 L28.3 8.9 V23.1 L16 30.2 L3.7 23.1 V8.9 Z',
  spell: 'M16 1.5 L30.5 16 L16 30.5 L1.5 16 Z',
  aura: 'M16 3.5 L28.5 16 L16 28.5 L3.5 16 Z',
  upgrade: 'M16 1.5 L29 10.5 V29.5 H3 V10.5 Z',
  status: circle(16, 16, 12.5),
  material: 'M4 4 H28 V28 H4 Z',
  quest: 'M4 3 H28 V15 C28 22 22.5 27 16 30 C9.5 27 4 22 4 15 Z',
};

/** How much of the 32-box the 24-box glyph fills inside each frame. */
export const GLYPH_SCALE: Record<IconFrame, number> = {
  boon: 0.82,
  relic: 0.8,
  spell: 0.62,
  aura: 0.56,
  upgrade: 0.7,
  status: 0.74,
  material: 0.8,
  quest: 0.72,
};
