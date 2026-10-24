import { z } from 'zod';

/**
 * Art directions for the style prototype (ROADMAP M4.5, PO wish E15): the same game in three
 * friendlier moods next to today's neon look. A style only changes the view; the sim never
 * sees it. Switching bakes everything anew, so the game reloads.
 */
const color = z.number().int().min(0).max(0xffffff);

export const artStyleIdSchema = z.enum(['neon', 'firefly', 'storybook', 'moon']);
export type ArtStyleId = z.infer<typeof artStyleIdSchema>;

const rigColorsSchema = z.object({ body: color, accent: color, core: color });

const artStyleSchema = z.object({
  id: artStyleIdSchema,
  background: color,
  ground: z.object({
    /** What lies on the floor: today's ash cracks, grass and flowers, doodles or paint blots. */
    detail: z.enum(['cracks', 'meadow', 'doodles', 'watercolor']),
    /** Large soft patches (base colour variation). */
    patches: z.array(color).min(1),
    patchAlpha: z.number().min(0).max(1),
    /** Small details: grass tufts, flowers, doodle strokes. */
    accents: z.array(color).min(1),
    grid: z.boolean(),
  }),
  edge: color,
  obstacle: z.object({ fill: color, stroke: color, strokeWidthPx: z.number().positive() }),
  rigs: z.object({
    /** Explicit colours per rig (the player first). */
    overrides: z.record(z.string(), rigColorsSchema),
    /** Every other rig colour is blended this far towards `mixColor` (softer, friendlier). */
    mixColor: color,
    mixAmount: z.number().min(0).max(1),
    /** Dark outline behind every shape (picture-book look), in rig units; 0 = none. */
    outlineUnits: z.number().min(0).max(0.2),
    outlineColor: color,
    /** Scales the baked neon halos; 0 removes them. */
    glow: z.number().min(0).max(1),
    /** Turns small glowing eye dots into big friendly eyes. */
    eyes: z.boolean(),
  }),
  /** Bloom post effect on the high quality tier. */
  bloom: z.number().min(0).max(1.5),
  particles: z.object({
    kind: z.enum(['embers', 'fireflies', 'leaves', 'motes']),
    colors: z.array(color).min(1),
  }),
  /** Menu look: colours (CSS) and the font family loaded for it. */
  ui: z.object({
    bg: z.string(),
    fg: z.string(),
    accent: z.string(),
    panel: z.string(),
    title: z.string(),
    font: z.string(),
    radiusPx: z.number().int().min(0).max(32),
  }),
});

export type ArtStyleDef = z.infer<typeof artStyleSchema>;

function defineArtStyle(def: ArtStyleDef): ArtStyleDef {
  return artStyleSchema.parse(def);
}

export const ART_STYLES: readonly ArtStyleDef[] = [
  defineArtStyle({
    id: 'neon',
    background: 0x07060d,
    ground: {
      detail: 'cracks',
      patches: [0x0d0b16],
      patchAlpha: 0,
      accents: [0x1a1222, 0xff6a2a],
      grid: true,
    },
    edge: 0xff7a2f,
    obstacle: { fill: 0x120e1f, stroke: 0xff7a2f, strokeWidthPx: 2 },
    rigs: {
      overrides: {},
      mixColor: 0xffffff,
      mixAmount: 0,
      outlineUnits: 0,
      outlineColor: 0x000000,
      glow: 1,
      eyes: false,
    },
    bloom: 1,
    particles: { kind: 'embers', colors: [0xffa64d, 0xffd36b] },
    ui: {
      bg: '#07060d',
      fg: '#e9e6ff',
      accent: '#7ff6ff',
      panel: 'rgba(14, 12, 26, 0.92)',
      title: '#7ff6ff',
      font: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      radiusPx: 10,
    },
  }),
  defineArtStyle({
    // A: cosy, warm, magical. Dusk over a meadow, soft light, fireflies.
    id: 'firefly',
    background: 0x2a2440,
    ground: {
      detail: 'meadow',
      patches: [0x35405a, 0x3d4f4a, 0x463a5c],
      patchAlpha: 0.55,
      accents: [0x6f9a6a, 0x8fbf7a, 0xffb4a2, 0xffd59a, 0xc9a6ff],
      grid: false,
    },
    edge: 0xffc48a,
    obstacle: { fill: 0x4a3f5e, stroke: 0xffc48a, strokeWidthPx: 3 },
    rigs: {
      overrides: {
        vesper: { body: 0xffe2b8, accent: 0xc0607a, core: 0xfffaf0 },
      },
      mixColor: 0xffd9c2,
      mixAmount: 0.3,
      outlineUnits: 0.035,
      outlineColor: 0x2a1f33,
      glow: 0.45,
      eyes: true,
    },
    bloom: 0.55,
    particles: { kind: 'fireflies', colors: [0xfff3a0, 0xd8ff9a, 0xffd59a] },
    ui: {
      bg: '#2a2440',
      fg: '#fff3e6',
      accent: '#ffc48a',
      panel: 'rgba(52, 42, 70, 0.95)',
      title: '#ffd9a8',
      font: '"Nunito", system-ui, sans-serif',
      radiusPx: 18,
    },
  }),
  defineArtStyle({
    // B: picture book (closest to Cult of the Lamb). Bold colours, thick ink outlines, cute.
    id: 'storybook',
    background: 0x4e6b3f,
    ground: {
      detail: 'doodles',
      patches: [0x5a7a48, 0x45603a, 0x66884f],
      patchAlpha: 0.8,
      accents: [0x2c3a24, 0x7fa05e, 0xe8d9a8, 0xd9604a],
      grid: false,
    },
    edge: 0x2a1d2e,
    obstacle: { fill: 0x8a6a4e, stroke: 0x2a1d2e, strokeWidthPx: 5 },
    rigs: {
      overrides: {
        vesper: { body: 0xfff1d6, accent: 0xd94f4f, core: 0xffffff },
      },
      mixColor: 0xffffff,
      mixAmount: 0.12,
      outlineUnits: 0.09,
      outlineColor: 0x2a1d2e,
      glow: 0,
      eyes: true,
    },
    bloom: 0,
    particles: { kind: 'leaves', colors: [0xe8a04a, 0xd9604a, 0xf2d06b] },
    ui: {
      bg: '#3a2a22',
      fg: '#fff1d6',
      accent: '#ff8a5c',
      panel: 'rgba(58, 40, 32, 0.96)',
      title: '#ffe0a3',
      font: '"Baloo 2", system-ui, sans-serif',
      radiusPx: 22,
    },
  }),
  defineArtStyle({
    // C: moonlit watercolour. Cool washes, glow only where magic happens, drifting motes.
    id: 'moon',
    background: 0x18203d,
    ground: {
      detail: 'watercolor',
      patches: [0x2c3a6b, 0x3b4f82, 0x5a4f8f, 0x2f5a7a],
      patchAlpha: 0.32,
      accents: [0xa9c4ff, 0xe6ecff],
      grid: false,
    },
    edge: 0xa9c4ff,
    obstacle: { fill: 0x26305a, stroke: 0xa9c4ff, strokeWidthPx: 2 },
    rigs: {
      overrides: {
        vesper: { body: 0xdde8ff, accent: 0x7080d8, core: 0xffffff },
      },
      mixColor: 0xb8c4ff,
      mixAmount: 0.35,
      outlineUnits: 0,
      outlineColor: 0x000000,
      glow: 0.7,
      eyes: false,
    },
    bloom: 0.8,
    particles: { kind: 'motes', colors: [0xe6ecff, 0xa9c4ff, 0xd6c8ff] },
    ui: {
      bg: '#18203d',
      fg: '#e6ecff',
      accent: '#a9c4ff',
      panel: 'rgba(24, 32, 61, 0.94)',
      title: '#dde8ff',
      font: '"Quicksand", system-ui, sans-serif',
      radiusPx: 14,
    },
  }),
];

export function artStyleById(id: ArtStyleId): ArtStyleDef {
  return ART_STYLES.find((s) => s.id === id) ?? (ART_STYLES[0] as ArtStyleDef);
}

/** Blends two RGB colours; `t` = 0 keeps `a`. */
export function mixColor(a: number, b: number, t: number): number {
  const ch = (shift: number) => {
    const x = (a >> shift) & 0xff;
    const y = (b >> shift) & 0xff;
    return Math.round(x + (y - x) * t) << shift;
  };
  return ch(16) | ch(8) | ch(0);
}
