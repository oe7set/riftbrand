import { ART_STYLE, type ArtStyleDef } from './style';

/**
 * Each world dresses the picture-book style in its own colours (ROADMAP M6.1): ground, stones,
 * the page edge and what drifts through the air. Everything else (rigs, outlines, menus) stays
 * the shared style, so all worlds still read as one book.
 */
type WorldLook = Partial<
  Pick<ArtStyleDef, 'background' | 'ground' | 'edge' | 'obstacle' | 'particles'>
>;

const WORLD_LOOKS: Readonly<Record<string, WorldLook>> = {
  // The Ember Wastes are the base style: warm meadow, falling leaves.
  ember_wastes: {},
  // Gläserne See: a frozen sea under pale light, crystal stones, slow snow.
  glass_sea: {
    background: 0x47798a,
    ground: {
      detail: 'doodles',
      patches: [0x5891a3, 0x3d6b7a, 0x6aa6b6],
      patchAlpha: 0.75,
      accents: [0x23404a, 0xbfe9f2, 0xf2fbff, 0x9fd8ee],
    },
    edge: 0x1f2f3d,
    obstacle: { fill: 0x9db6d8, stroke: 0x1f2f3d, strokeWidthPx: 5, moss: 0xf2fbff },
    particles: { kind: 'snow', colors: [0xffffff, 0xe6f6ff, 0xcfeaff] },
  },
};

/** The art style for a world: the shared style with the world's own colours on top. */
export function worldStyle(worldId: string | null): ArtStyleDef {
  const look = worldId ? WORLD_LOOKS[worldId] : undefined;
  return look ? { ...ART_STYLE, ...look } : ART_STYLE;
}
