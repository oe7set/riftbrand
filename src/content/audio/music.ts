import type { SfxLayer } from '../../platform/audio/synth';

/**
 * Procedural music (GDD §12.2): looping tracks in layers that crossfade with the game state.
 * Darksynth in minor keys. Everything is rendered once at startup by the same synth as the
 * sound effects, so there are no audio files to load or license.
 */

/** An instrument is a synth layer without pitch; notes supply the frequency. */
export type Instrument = Omit<SfxLayer, 'freq' | 'freqEnd' | 'delaySec'> & {
  /** Pitch slide factor over the note (drums: kick drops in pitch). */
  slide?: number;
};

export interface Note {
  /** 16th-note step within the loop. */
  step: number;
  /** MIDI note number (69 = A4); ignored for pure noise. */
  midi: number;
  /** Length in 16th steps (sets the sustain). */
  len: number;
  velocity?: number;
}

export interface MusicLayer {
  id: string;
  instrument: Instrument;
  notes: Note[];
  /** Mix level of the whole layer. */
  gain: number;
}

export interface MusicTrack {
  id: string;
  bpm: number;
  /** Loop length in bars of 16 steps. */
  bars: number;
  layers: MusicLayer[];
}

const STEPS_PER_BAR = 16;

/** Repeats `make(bar, step)` notes for every bar; handy for drums and pulses. */
function everyBar(bars: number, make: (bar: number) => Note[]): Note[] {
  const out: Note[] = [];
  for (let bar = 0; bar < bars; bar++) out.push(...make(bar));
  return out;
}

const at = (bar: number, step: number) => bar * STEPS_PER_BAR + step;

// ── Instruments ──────────────────────────────────────────────────────────

const PAD: Instrument = {
  wave: 'saw',
  attackSec: 0.35,
  sustainSec: 0,
  releaseSec: 0.9,
  volume: 0.12,
  lowpass: 900,
  vibratoHz: 0.6,
  vibratoDepth: 0.004,
};

const ARP: Instrument = {
  wave: 'triangle',
  attackSec: 0.004,
  sustainSec: 0,
  releaseSec: 0.18,
  volume: 0.16,
  lowpass: 3000,
};

const BASS: Instrument = {
  wave: 'saw',
  attackSec: 0.005,
  sustainSec: 0,
  releaseSec: 0.12,
  volume: 0.32,
  lowpass: 520,
  distortion: 0.35,
};

const LEAD: Instrument = {
  wave: 'square',
  attackSec: 0.01,
  sustainSec: 0,
  releaseSec: 0.25,
  volume: 0.1,
  lowpass: 2200,
  vibratoHz: 5.5,
  vibratoDepth: 0.01,
};

const KICK: Instrument = {
  wave: 'sine',
  attackSec: 0.001,
  sustainSec: 0.03,
  releaseSec: 0.2,
  volume: 0.7,
  slide: 0.3,
  distortion: 0.3,
};

const SNARE: Instrument = {
  wave: 'noise',
  attackSec: 0.001,
  sustainSec: 0.02,
  releaseSec: 0.16,
  volume: 0.32,
  lowpass: 5200,
};

const HAT: Instrument = {
  wave: 'noise',
  attackSec: 0.001,
  sustainSec: 0,
  releaseSec: 0.04,
  volume: 0.12,
  lowpass: 9000,
};

// ── Aschefelder: A minor, Am – F – Dm – E ───────────────────────────────

const WASTES_BARS = 4;
/** Chord tones per bar (MIDI): root, third, fifth. */
const WASTES_CHORDS = [
  [57, 60, 64],
  [53, 57, 60],
  [50, 53, 57],
  [52, 56, 59],
];

function chordTones(chords: number[][], bar: number): number[] {
  return chords[bar % chords.length] ?? [57, 60, 64];
}

export const WASTES_TRACK: MusicTrack = {
  id: 'wastes',
  bpm: 110,
  bars: WASTES_BARS,
  layers: [
    {
      id: 'pad',
      instrument: PAD,
      gain: 1,
      notes: everyBar(WASTES_BARS, (bar) =>
        chordTones(WASTES_CHORDS, bar).map((midi) => ({ step: at(bar, 0), midi, len: 15 })),
      ),
    },
    {
      id: 'arp',
      instrument: ARP,
      gain: 1,
      notes: everyBar(WASTES_BARS, (bar) => {
        const [r = 57, t = 60, f = 64] = chordTones(WASTES_CHORDS, bar);
        const pattern = [r, t, f, t + 12, f, t, r + 12, f];
        return pattern.map((n, i) => ({
          step: at(bar, i * 2),
          midi: n + 12,
          len: 1,
          velocity: i % 2 ? 0.7 : 1,
        }));
      }),
    },
    {
      id: 'bass',
      instrument: BASS,
      gain: 1,
      notes: everyBar(WASTES_BARS, (bar) => {
        const root = (chordTones(WASTES_CHORDS, bar)[0] ?? 57) - 24;
        return [0, 2, 4, 6, 8, 10, 12, 14].map((s, i) => ({
          step: at(bar, s),
          midi: i === 6 ? root + 12 : root,
          len: 1,
          velocity: s % 4 === 0 ? 1 : 0.75,
        }));
      }),
    },
    {
      id: 'drums',
      instrument: KICK,
      gain: 1,
      notes: everyBar(WASTES_BARS, (bar) =>
        [0, 4, 8, 12].map((s) => ({ step: at(bar, s), midi: 45, len: 1 })),
      ),
    },
    {
      id: 'snare',
      instrument: SNARE,
      gain: 1,
      notes: everyBar(WASTES_BARS, (bar) =>
        [4, 12].map((s) => ({ step: at(bar, s), midi: 0, len: 1 })),
      ),
    },
    {
      id: 'hats',
      instrument: HAT,
      gain: 1,
      notes: everyBar(WASTES_BARS, (bar) =>
        [2, 6, 10, 14].map((s) => ({ step: at(bar, s), midi: 0, len: 1 })),
      ),
    },
  ],
};

/** Which layers of the wastes track play while exploring (map, hub) vs. fighting. */
export const EXPLORE_LAYERS = ['pad', 'arp'];

/** The walkable refuge (ROADMAP M5.1): only the calm pad, the quietest layer. */
export const REFUGE_LAYERS = ['pad'];

// ── Der Glutwächter: D minor, Dm – Bb – Gm – A, faster and heavier ──────

const BOSS_BARS = 4;
const BOSS_CHORDS = [
  [50, 53, 57],
  [46, 50, 53],
  [43, 46, 50],
  [45, 49, 52],
];
const BOSS_MELODY = [74, 72, 69, 70, 69, 65, 67, 69];

export const WARDEN_TRACK: MusicTrack = {
  id: 'warden',
  bpm: 128,
  bars: BOSS_BARS,
  layers: [
    {
      id: 'pad',
      instrument: PAD,
      gain: 0.9,
      notes: everyBar(BOSS_BARS, (bar) =>
        chordTones(BOSS_CHORDS, bar).map((midi) => ({ step: at(bar, 0), midi, len: 15 })),
      ),
    },
    {
      id: 'bass',
      instrument: BASS,
      gain: 1,
      notes: everyBar(BOSS_BARS, (bar) => {
        const root = (chordTones(BOSS_CHORDS, bar)[0] ?? 50) - 24;
        const out: Note[] = [];
        for (let s = 0; s < 16; s++) {
          if (s % 4 === 3) continue;
          out.push({
            step: at(bar, s),
            midi: s === 14 ? root + 12 : root,
            len: 1,
            velocity: s % 4 === 0 ? 1 : 0.65,
          });
        }
        return out;
      }),
    },
    {
      id: 'lead',
      instrument: LEAD,
      gain: 1,
      notes: everyBar(BOSS_BARS, (bar) =>
        [0, 3, 6, 8, 10, 12].map((s, i) => ({
          step: at(bar, s),
          midi: BOSS_MELODY[(bar * 2 + i) % BOSS_MELODY.length] ?? 69,
          len: i === 5 ? 4 : 2,
        })),
      ),
    },
    {
      id: 'drums',
      instrument: KICK,
      gain: 1,
      notes: everyBar(BOSS_BARS, (bar) =>
        [0, 4, 8, 10, 12].map((s) => ({ step: at(bar, s), midi: 45, len: 1 })),
      ),
    },
    {
      id: 'snare',
      instrument: SNARE,
      gain: 1,
      notes: everyBar(BOSS_BARS, (bar) =>
        [4, 12, ...(bar === 3 ? [14, 15] : [])].map((s) => ({ step: at(bar, s), midi: 0, len: 1 })),
      ),
    },
    {
      id: 'hats',
      instrument: HAT,
      gain: 1,
      notes: everyBar(BOSS_BARS, (bar) =>
        [1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15].map((s) => ({
          step: at(bar, s),
          midi: 0,
          len: 1,
          velocity: s % 2 ? 0.6 : 1,
        })),
      ),
    },
  ],
};

export const MUSIC_TRACKS = [WASTES_TRACK, WARDEN_TRACK];
