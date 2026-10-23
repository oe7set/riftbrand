import { SFX, type SfxId } from '../../content/audio/sfx';
import { type MusicMode, MusicPlayer } from './music-player';
import { renderSfx } from './synth';

const MAX_VOICES_TOTAL = 32;
const MAX_VOICES_PER_SOUND = 6;
const DEFAULT_PITCH_VARIATION = 0.08;
const DEFAULT_VOLUME_VARIATION_DB = 2;

export interface PlayOptions {
  volume?: number;
  /** Playback-rate multiplier; 1.06^n climbs a combo. */
  pitch?: number;
  pitchVariation?: number;
  /** -1 (left) … 1 (right). */
  pan?: number;
}

/**
 * Web Audio playback of the pre-rendered effects. The context is created on the first user
 * gesture (mobile browsers block audio before that).
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private readonly buffers = new Map<SfxId, AudioBuffer>();
  private readonly voices = new Map<SfxId, number>();
  private totalVoices = 0;
  private masterVolume = 1;
  private sfxVolume = 1;
  private musicVolume = 0.7;
  private musicBus: GainNode | null = null;
  private music: MusicPlayer | null = null;
  /** Wanted before the context existed; applied once audio unlocks. */
  private musicMode: MusicMode = 'silent';

  /** Installs one-shot listeners that unlock audio on the first interaction. */
  unlockOnGesture(target: EventTarget = window): void {
    const unlock = () => {
      this.ensureContext();
      if (this.ctx?.state === 'suspended') void this.ctx.resume();
      if (this.ctx?.state === 'running') {
        for (const type of ['pointerdown', 'keydown', 'touchend'])
          target.removeEventListener(type, unlock);
      }
    };
    for (const type of ['pointerdown', 'keydown', 'touchend'])
      target.addEventListener(type, unlock);
  }

  private ensureContext(): void {
    if (this.ctx || typeof AudioContext === 'undefined') return;
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain();
    this.musicBus.connect(this.master);
    this.master.connect(ctx.destination);
    this.applyVolumes();
    this.music = new MusicPlayer(ctx, this.musicBus);
    this.music.setMode(this.musicMode);
    for (const id of Object.keys(SFX) as SfxId[]) {
      const samples = renderSfx(SFX[id], ctx.sampleRate, id.length * 7919);
      const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
      buffer.copyToChannel(samples, 0);
      this.buffers.set(id, buffer);
    }
  }

  setVolumes(master: number, sfx: number, music: number): void {
    this.masterVolume = master;
    this.sfxVolume = sfx;
    this.musicVolume = music;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.master || !this.sfxBus || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.masterVolume, now, 0.02);
    this.sfxBus.gain.setTargetAtTime(this.sfxVolume, now, 0.02);
    this.musicBus?.gain.setTargetAtTime(this.musicVolume, now, 0.02);
  }

  /** Switches the music layers (explore, combat, boss) with a crossfade. */
  setMusic(mode: MusicMode): void {
    this.musicMode = mode;
    this.music?.setMode(mode);
  }

  /** Lowers the music for a moment so an important sound is heard. */
  duckMusic(amount = 0.6, holdSec = 0.25): void {
    this.music?.duck(amount, holdSec);
  }

  /** Pauses all audio output, e.g. while the game is paused or hidden. */
  suspend(): void {
    if (this.ctx?.state === 'running') void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  play(id: SfxId, options: PlayOptions = {}): void {
    const ctx = this.ctx;
    const buffer = this.buffers.get(id);
    if (!ctx || !buffer || !this.sfxBus || ctx.state !== 'running') return;
    const active = this.voices.get(id) ?? 0;
    if (active >= MAX_VOICES_PER_SOUND || this.totalVoices >= MAX_VOICES_TOTAL) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const variation = options.pitchVariation ?? DEFAULT_PITCH_VARIATION;
    source.playbackRate.value = (options.pitch ?? 1) * (1 + (Math.random() * 2 - 1) * variation);
    const gain = ctx.createGain();
    const db = (Math.random() * 2 - 1) * DEFAULT_VOLUME_VARIATION_DB;
    gain.gain.value = (options.volume ?? 1) * 10 ** (db / 20);
    let node: AudioNode = gain;
    source.connect(gain);
    if (options.pan !== undefined && typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, options.pan));
      gain.connect(panner);
      node = panner;
    }
    node.connect(this.sfxBus);
    this.voices.set(id, active + 1);
    this.totalVoices++;
    source.onended = () => {
      this.voices.set(id, (this.voices.get(id) ?? 1) - 1);
      this.totalVoices--;
      node.disconnect();
    };
    source.start();
  }
}
