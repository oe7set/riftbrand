import {
  hasTouchScreen,
  nowMs,
  preferredLanguages,
  readViewport,
  watchFocusLoss,
  watchViewport,
} from '../platform/display';
import { InputManager } from '../platform/input/input-manager';
import { resolveLocale, setLocale } from '../shared/i18n';
import { createInputFrame } from '../shared/input-frame';
import { hashSim } from '../sim/hash';
import { clearDrifters, createSim, type SimState, spawnDrifters, stepSim } from '../sim/sim';
import { TICK_DT_SEC } from '../sim/time';
import { GameView } from '../view/game-view';
import { DebugMenu, type DebugStats } from './debug/debug-menu';
import { FixedStepper } from './fixed-stepper';
import { PauseOverlay } from './pause-overlay';

declare const __APP_VERSION__: string;
declare const __GIT_HASH__: string;

/** Longest frame we simulate; anything longer (tab switch, breakpoint) is treated as a hitch. */
const MAX_FRAME_DT_SEC = 0.25;
const STATS_SMOOTHING = 0.05;

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
  private readonly stepper = new FixedStepper(TICK_DT_SEC);
  private readonly frame = createInputFrame();
  private readonly debugMenu: DebugMenu;
  private readonly pauseOverlay: PauseOverlay;
  private paused = false;
  private lastFrameMs = 0;
  private readonly stats: DebugStats;

  private constructor(
    private readonly root: HTMLElement,
    private readonly view: GameView,
    seed: number,
  ) {
    this.sim = createSim(seed);
    root.append(view.canvas);
    this.input = new InputManager(view.canvas, hasTouchScreen());
    this.input.setPlayerScreenProvider((out) => this.view.playerScreenPosition(this.sim, out));
    this.input.resize(view.camera.viewWidth, view.camera.viewHeight);

    const version = `v${__APP_VERSION__} (${__GIT_HASH__})`;
    this.debugMenu = new DebugMenu(
      root,
      {
        restart: (s) => this.restart(s),
        spawnDrifters: (n) => spawnDrifters(this.sim, n),
        clearDrifters: () => clearDrifters(this.sim),
        setTimeScale: (scale) => {
          this.stepper.timeScale = scale;
        },
        setHitboxes: (on) => {
          this.view.debugDraw.enabled = on;
        },
      },
      version,
    );
    this.debugMenu.setSeed(seed);
    this.pauseOverlay = new PauseOverlay(root, () => this.setPaused(false));
    this.stats = {
      fps: 0,
      frameMsAvg: 0,
      frameMsMax: 0,
      simMsAvg: 0,
      renderMsAvg: 0,
      tick: 0,
      entities: 0,
      seed,
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

  private exposeDebugHandle(): void {
    window.__riftbrand = {
      ready: true,
      tick: () => this.sim.tick,
      playerPosition: () => ({
        x: this.sim.c.posX[this.sim.playerEid] ?? 0,
        y: this.sim.c.posY[this.sim.playerEid] ?? 0,
      }),
      stateHash: () => hashSim(this.sim),
    };
  }

  private restart(seed: number): void {
    this.sim = createSim(seed);
    this.stats.seed = seed;
    this.stepper.reset();
    this.view.resetCamera();
    this.debugMenu.setSeed(seed);
  }

  private setPaused(paused: boolean): void {
    if (paused === this.paused) return;
    this.paused = paused;
    // Releasing on both edges avoids "stuck" keys from presses made while the overlay was up.
    this.input.releaseAll();
    if (paused) this.pauseOverlay.show(this.input.lastDevice);
    else {
      this.pauseOverlay.hide();
      this.stepper.reset();
    }
  }

  private readonly loop = (timestamp: number): void => {
    requestAnimationFrame(this.loop);
    const frameStart = nowMs();
    const frameDtSec = Math.min((timestamp - this.lastFrameMs) / 1000, MAX_FRAME_DT_SEC);
    this.lastFrameMs = timestamp;

    this.input.poll();
    if (this.input.consumeAppAction('debug')) this.debugMenu.toggle();
    if (this.input.consumeAppAction('pause')) this.setPaused(!this.paused);

    let simMs = 0;
    if (!this.paused) {
      const ticks = this.stepper.advance(frameDtSec);
      const simStart = nowMs();
      for (let i = 0; i < ticks; i++) {
        this.input.sampleFrame(this.frame);
        stepSim(this.sim, this.frame);
      }
      simMs = nowMs() - simStart;
    }

    const renderStart = nowMs();
    this.view.render(
      this.sim,
      this.paused ? 1 : this.stepper.alpha,
      this.paused ? 0 : frameDtSec,
      this.input.touch,
      this.input.lastDevice,
    );
    const renderMs = nowMs() - renderStart;
    this.updateStats(frameDtSec, simMs, renderMs, nowMs() - frameStart);
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
    s.entities = this.sim.world.aliveCount;
    s.device = this.input.lastDevice;
    s.gamepad = this.input.gamepad.connected ? this.input.gamepadFamily : 'none';
    const r = this.view.renderer;
    s.resolution = `${r.width}×${r.height} @${r.resolution}  work ${workMs.toFixed(1)} ms`;
    this.debugMenu.update(nowMs(), s);
  }

  get rootElement(): HTMLElement {
    return this.root;
  }
}
