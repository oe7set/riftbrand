import { Texture } from 'pixi.js';
import { type IconSpec, iconUrl } from './icon-svg';

/** Texture size of rasterised icons; HUD sprites scale by their texture width. */
export const ICON_TEXTURE_PX = 96;

async function rasterize(spec: IconSpec): Promise<Texture> {
  const img = new Image();
  img.src = iconUrl(spec);
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = ICON_TEXTURE_PX;
  canvas.height = ICON_TEXTURE_PX;
  canvas.getContext('2d')?.drawImage(img, 0, 0, ICON_TEXTURE_PX, ICON_TEXTURE_PX);
  return Texture.from(canvas);
}

/**
 * Rasterises the SVG icons once at startup (ROADMAP M4.3): the HUD shows the same icons as the
 * menus without drawing them twice.
 */
export function rasterizeIcons(specs: readonly IconSpec[]): Promise<Texture[]> {
  return Promise.all(specs.map(rasterize));
}
