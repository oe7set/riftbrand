import { Graphics, Rectangle, type Renderer, type Texture } from 'pixi.js';
import { PALETTE } from './palette';

/** Base radius the textures are drawn at; sprites scale by actualRadius / BAKE_RADIUS_PX. */
export const BAKE_RADIUS_PX = 16;
/** Extra room around the body for the glow halo, as a multiple of the radius. */
const GLOW_EXTENT = 2.2;
const BAKE_RESOLUTION = 3;

export interface BakedTextures {
  player: Texture;
  drifter: Texture;
}

function glowHalo(g: Graphics, color: number, radius: number): void {
  // Cheap fake bloom: stacked translucent discs. Real bloom filter comes with quality tiers.
  for (let i = 6; i >= 1; i--) {
    g.circle(0, 0, radius * (1 + i * 0.2)).fill({ color, alpha: 0.035 * (7 - i) });
  }
}

function bake(renderer: Renderer, g: Graphics): Texture {
  const extent = BAKE_RADIUS_PX * GLOW_EXTENT;
  // Fixed frame centred on the origin so anchor 0.5 is the body centre, regardless of shape.
  const frame = new Rectangle(-extent, -extent, extent * 2, extent * 2);
  const texture = renderer.generateTexture({ target: g, frame, resolution: BAKE_RESOLUTION });
  g.destroy();
  return texture;
}

/** Procedural vector art (GDD §12.1), rendered once into textures at startup. */
export function bakeTextures(renderer: Renderer): BakedTextures {
  const r = BAKE_RADIUS_PX;

  const player = new Graphics();
  glowHalo(player, PALETTE.player, r);
  player.circle(0, 0, r).fill({ color: PALETTE.player, alpha: 0.25 });
  player.circle(0, 0, r).stroke({ color: PALETTE.player, width: 2.5 });
  player.circle(0, 0, r * 0.45).fill({ color: PALETTE.playerCore });
  // Facing notch: the sprite rotates so this always points along the aim/move direction.
  player
    .poly([r * 1.15, 0, r * 0.7, -r * 0.38, r * 0.7, r * 0.38])
    .fill({ color: PALETTE.playerCore });

  const drifter = new Graphics();
  glowHalo(drifter, PALETTE.drifter, r * 0.8);
  drifter
    .poly([0, -r, r, 0, 0, r, -r, 0])
    .fill({ color: PALETTE.drifter, alpha: 0.2 })
    .stroke({ color: PALETTE.drifter, width: 2.5 });

  return { player: bake(renderer, player), drifter: bake(renderer, drifter) };
}
