import { describe, expect, it } from 'vitest';
import { MUSIC_TRACKS, WASTES_TRACK } from '../../content/audio/music';
import { loopSamples, renderMusicLayer } from './music-render';

/** Low rate keeps the test fast; the maths doesn't depend on it. */
const RATE = 4000;

describe('music rendering', () => {
  it('renders every layer as a full loop of finite, non-silent samples', () => {
    for (const track of MUSIC_TRACKS) {
      for (const layer of track.layers) {
        const samples = renderMusicLayer(track, layer, RATE);
        expect(samples.length).toBe(loopSamples(track, RATE));
        // One assertion per layer, not per sample: slow CI runners time out otherwise.
        let peak = 0;
        let finite = true;
        for (const s of samples) {
          if (!Number.isFinite(s)) finite = false;
          peak = Math.max(peak, Math.abs(s));
        }
        expect(finite, `${track.id}/${layer.id}`).toBe(true);
        expect(peak, `${track.id}/${layer.id}`).toBeGreaterThan(0.01);
        // Layers are mixed together later; keep headroom.
        expect(peak, `${track.id}/${layer.id}`).toBeLessThan(1.6);
      }
    }
  });

  it('is deterministic', () => {
    const layer = WASTES_TRACK.layers[0];
    if (!layer) throw new Error('no layer');
    const a = renderMusicLayer(WASTES_TRACK, layer, RATE);
    const b = renderMusicLayer(WASTES_TRACK, layer, RATE);
    expect(a.every((v, i) => v === b[i])).toBe(true);
  });
});
