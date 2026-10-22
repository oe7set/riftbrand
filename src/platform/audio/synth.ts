/**
 * Tiny offline synthesizer in the spirit of ZzFX/sfxr: renders a sound effect from a few
 * numbers into a sample buffer once at load time. Pure and deterministic (seeded noise),
 * so it is unit-testable without Web Audio.
 */
export type Waveform = 'sine' | 'square' | 'saw' | 'triangle' | 'noise';

export interface SfxLayer {
  wave: Waveform;
  /** Start frequency in Hz (ignored for pure noise unless `lowpass` is set). */
  freq: number;
  /** Frequency at the end of the sound; exponential slide. Defaults to `freq`. */
  freqEnd?: number;
  attackSec: number;
  sustainSec: number;
  releaseSec: number;
  volume: number;
  /** Delay before this layer starts, for multi-note sounds. */
  delaySec?: number;
  /** 0..1 amount of noise mixed into the tone. */
  noise?: number;
  vibratoHz?: number;
  /** Vibrato depth as a fraction of the frequency. */
  vibratoDepth?: number;
  /** One-pole low-pass cutoff in Hz. */
  lowpass?: number;
  /** 0..1 soft-clip drive for grit. */
  distortion?: number;
}

export type SfxRecipe = readonly SfxLayer[];

const TWO_PI = Math.PI * 2;

function oscillator(wave: Waveform, phase: number): number {
  const p = phase - Math.floor(phase);
  switch (wave) {
    case 'sine':
      return Math.sin(p * TWO_PI);
    case 'square':
      return p < 0.5 ? 1 : -1;
    case 'saw':
      return 2 * p - 1;
    case 'triangle':
      return 1 - 4 * Math.abs(p - 0.5);
    case 'noise':
      return 0;
  }
}

export function recipeDurationSec(recipe: SfxRecipe): number {
  let end = 0;
  for (const l of recipe) {
    end = Math.max(end, (l.delaySec ?? 0) + l.attackSec + l.sustainSec + l.releaseSec);
  }
  return end;
}

export function renderSfx(
  recipe: SfxRecipe,
  sampleRate: number,
  seed = 1,
): Float32Array<ArrayBuffer> {
  const out = new Float32Array(Math.max(1, Math.ceil(recipeDurationSec(recipe) * sampleRate)));
  let noiseState = seed >>> 0 || 1;
  const nextNoise = () => {
    // xorshift32: cheap, deterministic white noise.
    noiseState ^= noiseState << 13;
    noiseState ^= noiseState >>> 17;
    noiseState ^= noiseState << 5;
    return ((noiseState >>> 0) / 4294967296) * 2 - 1;
  };

  for (const layer of recipe) {
    const start = Math.floor((layer.delaySec ?? 0) * sampleRate);
    const length = Math.ceil((layer.attackSec + layer.sustainSec + layer.releaseSec) * sampleRate);
    const attack = layer.attackSec * sampleRate;
    const sustainEnd = attack + layer.sustainSec * sampleRate;
    const release = Math.max(1, layer.releaseSec * sampleRate);
    const freqEnd = layer.freqEnd ?? layer.freq;
    const noiseMix = layer.wave === 'noise' ? 1 : (layer.noise ?? 0);
    const lpAlpha =
      layer.lowpass !== undefined ? 1 - Math.exp((-TWO_PI * layer.lowpass) / sampleRate) : 1;
    let phase = 0;
    let filtered = 0;
    for (let i = 0; i < length && start + i < out.length; i++) {
      const t = i / length;
      let freq = layer.freq * (freqEnd / layer.freq) ** t;
      if (layer.vibratoHz) {
        freq *=
          1 + (layer.vibratoDepth ?? 0.05) * Math.sin((TWO_PI * layer.vibratoHz * i) / sampleRate);
      }
      phase += freq / sampleRate;
      let sample = oscillator(layer.wave, phase) * (1 - noiseMix) + nextNoise() * noiseMix;
      filtered += (sample - filtered) * lpAlpha;
      sample = filtered;
      if (layer.distortion) {
        const drive = 1 + layer.distortion * 8;
        sample = Math.tanh(sample * drive) / Math.tanh(drive);
      }
      const env =
        i < attack ? i / attack : i < sustainEnd ? 1 : Math.max(0, 1 - (i - sustainEnd) / release);
      out[start + i] = (out[start + i] as number) + sample * env * env * layer.volume;
    }
  }
  // Soft-limit the mix so stacked layers never clip harshly.
  for (let i = 0; i < out.length; i++) out[i] = Math.tanh(out[i] as number);
  return out;
}
