import { z } from 'zod';

/**
 * The art direction (ROADMAP M4.5, PO wish E15): the PO picked the picture-book look from the
 * style prototype. Kept as data so tuning colours, outlines and fonts needs no code. A style only
 * changes the view; the sim never sees it.
 */
const color = z.number().int().min(0).max(0xffffff);

const rigColorsSchema = z.object({ body: color, accent: color, core: color });

const artStyleSchema = z.object({
  id: z.string(),
  background: color,
  ground: z.object({
    /** What lies on the floor: ink doodles of grass, pebbles and mushrooms. */
    detail: z.enum(['doodles']),
    /** Large soft patches (base colour variation). */
    patches: z.array(color).min(1),
    patchAlpha: z.number().min(0).max(1),
    /** Small details: grass tufts, flowers, doodle strokes. */
    accents: z.array(color).min(1),
  }),
  edge: color,
  obstacle: z.object({
    fill: color,
    stroke: color,
    strokeWidthPx: z.number().positive(),
    /** Tufts on top of the stones: moss in the meadow, snow caps on ice. */
    moss: color.default(0x7fa05e),
  }),
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
    kind: z.enum(['leaves', 'snow']),
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

export const ART_STYLE: ArtStyleDef = defineArtStyle({
  // Picture book (closest to Cult of the Lamb): bold colours, thick ink outlines, cute.
  id: 'storybook',
  background: 0x4e6b3f,
  ground: {
    detail: 'doodles',
    patches: [0x5a7a48, 0x45603a, 0x66884f],
    patchAlpha: 0.8,
    accents: [0x2c3a24, 0x7fa05e, 0xe8d9a8, 0xd9604a],
  },
  edge: 0x2a1d2e,
  obstacle: { fill: 0x8a6a4e, stroke: 0x2a1d2e, strokeWidthPx: 5, moss: 0x7fa05e },
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
});

/** Blends two RGB colours; `t` = 0 keeps `a`. */
export function mixColor(a: number, b: number, t: number): number {
  const ch = (shift: number) => {
    const x = (a >> shift) & 0xff;
    const y = (b >> shift) & 0xff;
    return Math.round(x + (y - x) * t) << shift;
  };
  return ch(16) | ch(8) | ch(0);
}
