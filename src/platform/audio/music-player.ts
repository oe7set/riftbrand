import {
  EXPLORE_LAYERS,
  type MusicTrack,
  REFUGE_LAYERS,
  WARDEN_TRACK,
  WASTES_TRACK,
} from '../../content/audio/music';
import { MUSIC_SAMPLE_RATE, renderMusicLayer } from './music-render';

/** What the music should be doing (GDD §12.2). */
export type MusicMode = 'silent' | 'refuge' | 'explore' | 'combat' | 'boss';

const FADE_SEC = 0.6;
const DUCK_RECOVER_SEC = 0.5;

interface LoadedTrack {
  track: MusicTrack;
  buffers: Map<string, AudioBuffer>;
  sources: AudioBufferSourceNode[];
  gains: Map<string, GainNode>;
  playing: boolean;
}

/**
 * Layered music: all layers of a track loop in sync and fade in or out with the game state
 * (exploring: pad + arpeggio; fighting: + bass and drums; boss: its own track). Loops are
 * rendered one layer per idle slice after audio unlocks, so startup never hitches.
 */
export class MusicPlayer {
  private readonly bus: GainNode;
  private readonly duckGain: GainNode;
  private readonly tracks: LoadedTrack[];
  private mode: MusicMode = 'silent';
  private ready = false;

  constructor(
    private readonly ctx: AudioContext,
    destination: AudioNode,
  ) {
    this.bus = ctx.createGain();
    this.duckGain = ctx.createGain();
    this.bus.connect(this.duckGain);
    this.duckGain.connect(destination);
    this.tracks = [WASTES_TRACK, WARDEN_TRACK].map((track) => ({
      track,
      buffers: new Map(),
      sources: [],
      gains: new Map(),
      playing: false,
    }));
    this.renderNext(0, 0);
  }

  get output(): GainNode {
    return this.bus;
  }

  private renderNext(trackIndex: number, layerIndex: number): void {
    const loaded = this.tracks[trackIndex];
    if (!loaded) {
      this.ready = true;
      this.apply();
      return;
    }
    const layer = loaded.track.layers[layerIndex];
    if (!layer) {
      this.renderNext(trackIndex + 1, 0);
      return;
    }
    // One layer per macrotask keeps every frame short while the loops are prepared.
    setTimeout(() => {
      const samples = renderMusicLayer(loaded.track, layer, MUSIC_SAMPLE_RATE);
      const buffer = this.ctx.createBuffer(1, samples.length, MUSIC_SAMPLE_RATE);
      buffer.copyToChannel(samples, 0);
      loaded.buffers.set(layer.id, buffer);
      this.renderNext(trackIndex, layerIndex + 1);
    }, 0);
  }

  private start(loaded: LoadedTrack): void {
    if (loaded.playing) return;
    const when = this.ctx.currentTime + 0.05;
    for (const layer of loaded.track.layers) {
      const buffer = loaded.buffers.get(layer.id);
      if (!buffer) continue;
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      source.connect(gain);
      gain.connect(this.bus);
      source.start(when);
      loaded.sources.push(source);
      loaded.gains.set(layer.id, gain);
    }
    loaded.playing = true;
  }

  private stop(loaded: LoadedTrack): void {
    if (!loaded.playing) return;
    const end = this.ctx.currentTime + FADE_SEC * 3;
    for (const source of loaded.sources) source.stop(end);
    loaded.sources = [];
    const gains = [...loaded.gains.values()];
    loaded.gains.clear();
    setTimeout(
      () => {
        for (const g of gains) g.disconnect();
      },
      FADE_SEC * 3000 + 100,
    );
    loaded.playing = false;
  }

  private fade(loaded: LoadedTrack, layerOn: (id: string) => boolean): void {
    const now = this.ctx.currentTime;
    for (const [id, gain] of loaded.gains) {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(layerOn(id) ? 1 : 0, now, FADE_SEC / 3);
    }
  }

  private apply(): void {
    if (!this.ready) return;
    const [wastes, warden] = this.tracks;
    if (!wastes || !warden) return;
    const mode = this.mode;
    if (mode === 'refuge' || mode === 'explore' || mode === 'combat') {
      this.start(wastes);
      this.fade(
        wastes,
        (id) =>
          mode === 'combat' || (mode === 'refuge' ? REFUGE_LAYERS : EXPLORE_LAYERS).includes(id),
      );
      this.fade(warden, () => false);
      this.stop(warden);
    } else if (mode === 'boss') {
      this.start(warden);
      this.fade(warden, () => true);
      this.fade(wastes, () => false);
      this.stop(wastes);
    } else {
      this.fade(wastes, () => false);
      this.fade(warden, () => false);
      this.stop(wastes);
      this.stop(warden);
    }
  }

  setMode(mode: MusicMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.apply();
  }

  /** Briefly lowers the music so an important sound cuts through (GDD §12.2 ducking). */
  duck(amount: number, holdSec: number): void {
    const g = this.duckGain.gain;
    const now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setTargetAtTime(1 - amount, now, 0.02);
    g.setTargetAtTime(1, now + holdSec, DUCK_RECOVER_SEC / 3);
  }
}
