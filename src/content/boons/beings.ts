import type { BeingId } from '../schema';

/** The rift beings who grant boons (GDD §2.4). Colors double as the UI accent per being. */
export const BEINGS: Record<BeingId, { color: number; css: string }> = {
  ignara: { color: 0xff8a3d, css: '#ff8a3d' },
  vaelis: { color: 0x8fe3ff, css: '#8fe3ff' },
};

export const BEING_IDS: readonly BeingId[] = ['ignara', 'vaelis'];
