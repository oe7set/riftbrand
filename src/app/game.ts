import { ENEMIES } from '../content/enemies';
import { AudioEngine } from '../platform/audio/audio-engine';
import {
  hasTouchScreen,
  nowMs,
  preferredLanguages,
  readViewport,
  watchFocusLoss,
  watchViewport,
} from '../platform/display';
import { Haptics } from '../platform/haptics';
import { InputManager } from '../platform/input/input-manager';
import {
  browserStore,
  loadSettings,
  type Settings,
  saveSettings,
} from '../platform/storage/settings';
import { resolveLocale, setLocale } from '../shared/i18n';
import { Button, createInputFrame } from '../shared/input-frame';
import { debugKillAllEnemies, debugNextWave, debugSpawnEnemy } from '../sim/debug';
import { C } from '../sim/ecs/components';
import { Ev, type EventBuffer } from '../sim/events';
import { hashSim } from '../sim/hash';
import {
  clearDrifters,
  createSim,
  drainEvents,
  type SimState,
  spawnDrifters,
  stepSim,
} from '../sim/sim';
import { TICK_DT_SEC } from '../sim/time';
import { GameView } from '../view/game-view';
import { DebugMenu, type DebugStats } from './debug/debug-menu';
import { FeedbackDirector, type SlowMoRequest } from './feedback';
import { FixedStepper } from './fixed-stepper';
import { DeathOverlay, PauseOverlay } from './overlays';

declare const __APP_VERSION__: string;
declare const __GIT_HASH__: string;

/** Longest frame we simulate; anything longer (tab switch, breakpoint) is treated as a hitch. */
const MAX_FRAME_DT_SEC = 0.25;
const STATS_SMOOTHING = 0.05;
/** Let the death animation and slow motion play before the overlay appears. */
const DEATH_OVERLAY_DELAY_SEC = 1.1;
const RESTART_BUTTONS = Button.Attack | Button.Dash | Button.Interact;

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
}

function seedFromUrl(): number | null {
  const raw = new URLSearchParams(window.location.search).get('seed');
  if (raw === null || raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n >>> 0 : null;
}

/** Test/debug hook for Playwright and the browser console. Read-only. */
export interface RiftbrandDebugHandle {
  ready: boolean;
  tick(): number;
  playerPosition(): { x: number; y: number };
  playerHp(): number;
  wave(): number;
  enemiesAlive(): number;
  enemyPositions(): Array<{ x: number; y: number; type: number }>;
  stateHash(): number;
}

declare global {
  interface Window {
    __riftbrand?: RiftbrandDebugHandle;
  }
}

export class Game {
  private sim: SimState;
  private readonly input: InputManager;
  private readonly audio = new AudioEngine();
  private readonly haptics: Haptics;
  private readonly feedback: FeedbackDirector;
  private readonly stepper = new FixedStepper(TICK_DT_SEC);
  private readonly frame = createInputFrame();
  private readonly debugMenu: DebugMenu;
  private readonly pauseOverlay: PauseOverlay;
  private readonly deathOverlay: DeathOverlay;
  private readonly settings: Settings;
  private paused = false;
  private debugTimeScale = 1;
  private slowMoScale = 1;
  private slowMoSec = 0;
  private deathOverlaySec = -1;
  private lastFrameMs = 0;
  private readonly stats: DebugStats;
  private readonly onEvents = (events: EventBuffer) => {
    this.feedback.consume(events);
    for (let i = 0; i < events.count; i++) {
      if (events.items[i]?.type === Ev.PlayerDied) this.deathOverlaySec = DEATH_OVERLAY_DELAY_SEC;
    }
  };

  private constructor(
    root: HTMLElement,
    private readonly view: GameView,
    seed: number,
  ) {
    this.sim = createSim(seed);
    root.append(view.canvas);
    this.input = new InputManager(view.canvas, hasTouchScreen());
    this.input.setPlayerScreenProvider((out) => this.view.playerScreenPosition(this.sim, out));
    this.input.resize(view.camera.viewWidth, view.camera.viewHeight);
    this.haptics = new Haptics((ms, strength) => this.input.gamepad.rumble(ms, strength));
    this.feedback = new FeedbackDirector(view, this.audio, this.haptics, (req) => this.slowMo(req));
    this.audio.unlockOnGesture();

    const store = browserStore();
    this.settings = loadSettings(store);
    this.applySettings();

    const version = `v${__APP_VERSION__} (${__GIT_HASH__})`;
    this.debugMenu = new DebugMenu(
      root,
      {
        restart: (s) => this.restart(s),
        spawnDrifters: (n) => spawnDrifters(this.sim, n),
        clearDrifters: () => clearDrifters(this.sim),
        spawnEnemy: (type) => debugSpawnEnemy(this.sim, type),
        killAllEnemies: () => debugKillAllEnemies(this.sim),
        nextWave: () => debugNextWave(this.sim),
        setWaves: (on) => {
          this.sim.debug.wavesEnabled = on;
        },
        setGodMode: (on) => {
          this.sim.debug.godMode = on;
        },
        setTimeScale: (scale) => {
          this.debugTimeScale = scale;
        },
        setHitboxes: (on) => {
          this.view.debugDraw.enabled = on;
        },
      },
      ENEMIES.map((e) => e.id),
      version,
    );
    this.debugMenu.setSeed(seed);
    this.pauseOverlay = new PauseOverlay(
      root,
      () => this.setPaused(false),
      this.settings,
      (s) => {
        this.applySettings();
        saveSettings(store, s);
      },
    );
    this.deathOverlay = new DeathOverlay(root, () => this.restart(randomSeed()));
    this.stats = {
      fps: 0,
      frameMsAvg: 0,
      frameMsMax: 0,
      simMsAvg: 0,
      renderMsAvg: 0,
      tick: 0,
      entities: 0,
      particles: 0,
      seed,
      wave: 0,
      device: '',
      gamepad: '',
      resolution: '',
    };

    watchViewport((size) => {
      this.view.resize(size);
      this.input.resize(size.width, size.height);
    });
    watchFocusLoss(() => this.setPaused(true));
  }

  static async start(root: HTMLElement): Promise<Game> {
    setLocale(resolveLocale(preferredLanguages()));
    const view = await GameView.create(readViewport());
    const game = new Game(root, view, seedFromUrl() ?? randomSeed());
    game.exposeDebugHandle();
    game.lastFrameMs = nowMs();
    requestAnimationFrame(game.loop);
    return game;
  }

  private applySettings(): void {
    const s = this.settings;
    this.audio.setVolumes(s.masterVolume, s.sfxVolume);
    this.view.shake.intensity = s.shake;
    this.view.hud.flashIntensity = s.flashes;
    this.view.damageNumbers.enabled = s.damageNumbers;
    this.view.setGlowQuality(s.quality);
    this.haptics.intensity = s.vibration;
  }

  private exposeDebugHandle(): void {
    const sim = () => this.sim;
    window.__riftbrand = {
      ready: true,
      tick: () => sim().tick,
      playerPosition: () => ({
        x: sim().c.posX[sim().playerEid] ?? 0,
        y: sim().c.posY[sim().playerEid] ?? 0,
      }),
      playerHp: () => sim().c.hp[sim().playerEid] ?? 0,
      wave: () => sim().waves.wave,
      enemiesAlive: () => sim().enemiesAlive,
      enemyPositions: () => {
        const s = sim();
        const out: Array<{ x: number; y: number; type: number }> = [];
        for (let eid = 0; eid < s.world.highWater; eid++) {
          if (((s.world.masks[eid] ?? 0) & C.Enemy) === 0) continue;
          out.push({ x: s.c.posX[eid] ?? 0, y: s.c.posY[eid] ?? 0, type: s.c.enemyType[eid] ?? 0 });
        }
        return out;
      },
      stateHash: () => hashSim(sim()),
    };
  }

  private slowMo(req: SlowMoRequest): void {
    // The strongest request wins; overlapping requests don't multiply.
    if (this.slowMoSec <= 0 || req.scale < this.slowMoScale) this.slowMoScale = req.scale;
    this.slowMoSec = Math.max(this.slowMoSec, req.durationSec);
  }

  private restart(seed: number): void {
    const debug = { ...this.sim.debug };
    this.sim = createSim(seed);
    Object.assign(this.sim.debug, debug);
    this.stats.seed = seed;
    this.stepper.reset();
    this.view.resetEffects();
    this.deathOverlay.hide();
    this.deathOverlaySec = -1;
    this.slowMoSec = 0;
    this.slowMoScale = 1;
    this.debugMenu.setSeed(seed);
  }

  private setPaused(paused: boolean): void {
    if (paused === this.paused) return;
    this.paused = paused;
    // Releasing on both edges avoids "stuck" keys from presses made while the overlay was up.
    this.input.releaseAll();
    if (paused) {
      this.pauseOverlay.show(this.input.lastDevice);
      this.audio.suspend();
    } else {
      this.pauseOverlay.hide();
      this.audio.resume();
      this.stepper.reset();
    }
  }

  private readonly loop = (timestamp: number): void => {
    requestAnimationFrame(this.loop);
    const frameStart = nowMs();
    const realDtSec = Math.min(
      Math.max(0, (timestamp - this.lastFrameMs) / 1000),
      MAX_FRAME_DT_SEC,
    );
    this.lastFrameMs = timestamp;

    this.input.poll();
    if (this.input.consumeAppAction('debug')) this.debugMenu.toggle();
    if (this.input.consumeAppAction('pause') && !this.deathOverlay.visible)
      this.setPaused(!this.paused);

    if (this.slowMoSec > 0) {
      this.slowMoSec -= realDtSec;
      if (this.slowMoSec <= 0) this.slowMoScale = 1;
    }
    const timeScale = this.debugTimeScale * this.slowMoScale;

    let simMs = 0;
    if (!this.paused) {
      this.stepper.timeScale = timeScale;
      const ticks = this.stepper.advance(realDtSec);
      const simStart = nowMs();
      for (let i = 0; i < ticks; i++) {
        this.input.sampleFrame(this.frame);
        if (this.deathOverlay.visible && (this.frame.pressed & RESTART_BUTTONS) !== 0) {
          this.deathOverlay.tryRestart();
        }
        stepSim(this.sim, this.frame);
      }
      simMs = nowMs() - simStart;
      drainEvents(this.sim, this.onEvents);
      if (this.deathOverlaySec > 0) {
        this.deathOverlaySec -= realDtSec;
        if (this.deathOverlaySec <= 0) {
          this.deathOverlay.show(
            this.sim.waves.wave,
            this.sim.player.kills,
            this.input.lastDevice,
            nowMs(),
          );
        }
      }
    }

    const renderStart = nowMs();
    const paused = this.paused;
    this.feedback.update(this.sim, paused ? 0 : realDtSec);
    this.view.render(
      this.sim,
      paused ? 1 : this.stepper.alpha,
      paused ? 0 : realDtSec * timeScale,
      paused ? 0 : realDtSec,
      this.input.touch,
      this.input.lastDevice,
    );
    const renderMs = nowMs() - renderStart;
    this.updateStats(realDtSec, simMs, renderMs, nowMs() - frameStart);
  };

  private updateStats(frameDtSec: number, simMs: number, renderMs: number, workMs: number): void {
    const s = this.stats;
    const k = STATS_SMOOTHING;
    const frameMs = frameDtSec * 1000;
    s.frameMsAvg += (frameMs - s.frameMsAvg) * k;
    s.frameMsMax = Math.max(frameMs, s.frameMsMax * 0.99);
    s.fps = s.frameMsAvg > 0 ? 1000 / s.frameMsAvg : 0;
    s.simMsAvg += (simMs - s.simMsAvg) * k;
    s.renderMsAvg += (renderMs - s.renderMsAvg) * k;
    s.tick = this.sim.tick;
    s.wave = this.sim.waves.wave;
    s.entities = this.sim.world.aliveCount;
    s.particles = this.view.particleCount;
    s.device = this.input.lastDevice;
    s.gamepad = this.input.gamepad.connected ? this.input.gamepadFamily : 'none';
    const r = this.view.renderer;
    s.resolution = `${r.width}×${r.height} @${r.resolution}  work ${workMs.toFixed(1)} ms`;
    this.debugMenu.update(nowMs(), s);
  }
}
