import type { Instrument, MusicLayer, MusicTrack, Note } from '../../content/audio/music';
import { renderSfx } from './synth';

/** Music renders at a lower rate than effects: it is mostly low/mid frequencies. */
export const MUSIC_SAMPLE_RATE = 22050;

export function stepSec(track: MusicTrack): number {
  return 60 / track.bpm / 4;
}

export function loopSamples(track: MusicTrack, sampleRate = MUSIC_SAMPLE_RATE): number {
  return Math.round(track.bars * 16 * stepSec(track) * sampleRate);
}

function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

function noteRecipe(inst: Instrument, note: Note, step: number, gain: number) {
  const freq = midiToHz(note.midi);
  const sustain = Math.max(inst.sustainSec, note.len * step - inst.attackSec);
  const { slide, ...layer } = inst;
  return [
    {
      ...layer,
      freq,
      freqEnd: slide !== undefined ? freq * slide : freq,
      // Drums keep their fixed envelope; pitched notes hold for their length.
      sustainSec: slide !== undefined || inst.wave === 'noise' ? inst.sustainSec : sustain,
      volume: inst.volume * (note.velocity ?? 1) * gain,
    },
  ];
}

/**
 * Renders one layer of a track into a seamless loop: note tails that run past the end wrap
 * around to the start. Identical notes are rendered once and mixed many times. Pure and
 * deterministic (seeded noise), so it is testable without Web Audio.
 */
export function renderMusicLayer(
  track: MusicTrack,
  layer: MusicLayer,
  sampleRate = MUSIC_SAMPLE_RATE,
): Float32Array<ArrayBuffer> {
  const length = loopSamples(track, sampleRate);
  const out = new Float32Array(length);
  const step = stepSec(track);
  const cache = new Map<string, Float32Array>();
  for (const note of layer.notes) {
    const key = `${note.midi}|${note.len}|${note.velocity ?? 1}`;
    let samples = cache.get(key);
    if (!samples) {
      samples = renderSfx(
        noteRecipe(layer.instrument, note, step, layer.gain),
        sampleRate,
        note.midi * 31 + 7,
      );
      cache.set(key, samples);
    }
    const start = Math.round(note.step * step * sampleRate);
    for (let i = 0; i < samples.length; i++) {
      const j = (start + i) % length;
      out[j] = (out[j] as number) + (samples[i] as number);
    }
  }
  return out;
}
