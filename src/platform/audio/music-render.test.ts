import { describe, expect, it } from 'vitest';
import { MUSIC_TRACKS, WASTES_TRACK } from '../../content/audio/music';
import { loopSamples, renderMusicLayer } from './music-render';

describe('music rendering', () => {
  it('renders every layer as a full loop of finite, non-silent samples', () => {
    for (const track of MUSIC_TRACKS) {
      for (const layer of track.layers) {
        const samples = renderMusicLayer(track, layer, 8000);
        expect(samples.length).toBe(loopSamples(track, 8000));
        let peak = 0;
        for (const s of samples) {
          expect(Number.isFinite(s)).toBe(true);
          peak = Math.max(peak, Math.abs(s));
        }
        expect(peak, `${track.id}/${layer.id}`).toBeGreaterThan(0.01);
        // Layers are mixed together later; keep headroom.
        expect(peak, `${track.id}/${layer.id}`).toBeLessThan(1.6);
      }
    }
  });

  it('is deterministic', () => {
    const layer = WASTES_TRACK.layers[0];
    if (!layer) throw new Error('no layer');
    expect(renderMusicLayer(WASTES_TRACK, layer, 8000)).toEqual(
      renderMusicLayer(WASTES_TRACK, layer, 8000),
    );
  });
});
