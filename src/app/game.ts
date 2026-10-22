import { EMBER_WASTES } from '../content/biomes/ember-wastes';
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
import { MenuAction } from '../platform/input/bindings';
import { InputManager } from '../platform/input/input-manager';
import { clearRun, loadRun, saveRun } from '../platform/storage/run-save';
import {
  browserStore,
  loadSettings,
  type Settings,
  saveSettings,
} from '../platform/storage/settings';
import { resolveLocale, setLocale, t } from '../shared/i18n';
import { Button, createInputFrame } from '../shared/input-frame';
import { debugClearRoom, debugKillAllEnemies, debugNextWave, debugSpawnEnemy } from '../sim/debug';
import { C } from '../sim/ecs/components';
import { Ev, type EventBuffer } from '../sim/events';
import { hashSim } from '../sim/hash';
import {
  completeRoom,
  createRun,
  enterNode,
  failRun,
  type RunState,
  rest,
  roomSeed,
  roomSetupFor,
} from '../sim/run/run-state';
import {
  clearDrifters,
  createSim,
  drainEvents,
  type SimState,
  spawnDrifters,
  stepSim,
} from '../sim/sim';
import { TICK_DT_SEC, TICK_RATE_HZ } from '../sim/time';
import { GameView } from '../view/game-view';
import { type NavDirection, navigate } from '../view/ui/spatial-nav';
import { Ui } from '../view/ui/ui';
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
/** Let the portal effect play before switching to the map. */
const EXIT_TRANSITION_SEC = 0.35;
const RESTART_BUTTONS = Button.Attack | Button.Dash | Button.Interact;

/** Where the player is in the game flow (title → map ⇄ room/rest → victory or death). */
type Mode = 'title' | 'map' | 'rest' | 'room' | 'arena' | 'victory';

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
  mode(): string;
  tick(): number;
  playerPosition(): { x: number; y: number };
  playerHp(): number;
  wave(): number;
  enemiesAlive(): number;
  enemyPositions(): Array<{ x: number; y: number; type: number }>;
  roomsCleared(): number;
  stateHash(): number;
}

declare global {
  interface Window {
    __riftbrand?: RiftbrandDebugHandle;
  }
}

export class Game {
  private sim: SimState;
  private mode: Mode = 'title';
  private run: RunState | null = null;
  private readonly store = browserStore();
  private readonly input: InputManager;
  private readonly audio = new AudioEngine();
  private readonly haptics: Haptics;
  private readonly feedback: FeedbackDirector;
  private readonly stepper = new FixedStepper(TICK_DT_SEC);
  private readonly frame = createInputFrame();
  private readonly ui: Ui;
  private readonly debugMenu: DebugMenu;
  private readonly pauseOverlay: PauseOverlay;
  private readonly deathOverlay: DeathOverlay;
  private readonly settings: Settings;
  private readonly version = `v${__APP_VERSION__} (${__GIT_HASH__})`;
  private paused = false;
  private debugTimeScale = 1;
  private slowMoScale = 1;
  private slowMoSec = 0;
  private deathOverlaySec = -1;
  private exitTransitionSec = -1;
  private lastFrameMs = 0;
  private readonly stats: DebugStats;
  private readonly onEvents = (events: EventBuffer) => {
    this.feedback.consume(events);
    for (let i = 0; i < events.count; i++) {
      const type = events.items[i]?.type;
      if (type === Ev.PlayerDied) this.deathOverlaySec = DEATH_OVERLAY_DELAY_SEC;
      if (type === Ev.ExitReached) this.exitTransitionSec = EXIT_TRANSITION_SEC;
    }
  };

  private constructor(
    root: HTMLElement,
    private readonly view: GameView,
  ) {
    this.sim = this.backdropSim();
    root.append(view.canvas);
    this.input = new InputManager(view.canvas, hasTouchScreen());
    this.input.setPlayerScreenProvider((out) => this.view.playerScreenPosition(this.sim, out));
    this.input.resize(view.camera.viewWidth, view.camera.viewHeight);
    this.haptics = new Haptics((ms, strength) => this.input.gamepad.rumble(ms, strength));
    this.feedback = new FeedbackDirector(view, this.audio, this.haptics, (req) => this.slowMo(req));
    this.audio.unlockOnGesture();

    this.settings = loadSettings(this.store);
    this.applySettings();

    this.ui = new Ui(root);
    this.debugMenu = new DebugMenu(
      root,
      {
        restart: (s) => this.startArena(s),
        spawnDrifters: (n) => spawnDrifters(this.sim, n),
        clearDrifters: () => clearDrifters(this.sim),
        spawnEnemy: (type) => debugSpawnEnemy(this.sim, type),
        killAllEnemies: () => debugKillAllEnemies(this.sim),
        clearRoom: () => debugClearRoom(this.sim),
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
      this.version,
    );
    this.pauseOverlay = new PauseOverlay(
      root,
      {
        resume: () => this.setPaused(false),
        toTitle: () => {
          this.setPaused(false);
          this.showTitle();
        },
        toggleDebug: () => this.debugMenu.toggle(),
      },
      this.settings,
      (s) => {
        this.applySettings();
        saveSettings(this.store, s);
      },
    );
    this.deathOverlay = new DeathOverlay(root, () => this.afterDeath());
    this.stats = {
      fps: 0,
      frameMsAvg: 0,
      frameMsMax: 0,
      simMsAvg: 0,
      renderMsAvg: 0,
      tick: 0,
      entities: 0,
      particles: 0,
      seed: this.sim.seed,
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
    const game = new Game(root, view);
    game.exposeDebugHandle();
    // ?seed=… jumps straight into the endless arena, handy for tuning and bug reports.
    const urlSeed = seedFromUrl();
    if (urlSeed !== null) game.startArena(urlSeed);
    else game.showTitle();
    game.lastFrameMs = nowMs();
    requestAnimationFrame(game.loop);
    return game;
  }

  // ── Flow ────────────────────────────────────────────────────────────────

  /** Empty, quiet arena drawn behind menus. */
  private backdropSim(): SimState {
    const sim = createSim(1);
    sim.debug.wavesEnabled = false;
    return sim;
  }

  private setMode(mode: Mode): void {
    this.mode = mode;
    const playing = mode === 'room' || mode === 'arena';
    this.input.setGameplayEnabled(playing);
    this.deathOverlay.hide();
    this.deathOverlaySec = -1;
    this.exitTransitionSec = -1;
    this.slowMoSec = 0;
    this.slowMoScale = 1;
    this.stepper.reset();
    if (playing) this.ui.show({ kind: 'none' });
  }

  private loadSim(sim: SimState): void {
    const debug = { ...this.sim.debug };
    this.sim = sim;
    // Keep debug toggles (god mode, waves) across rooms.
    sim.debug.godMode = debug.godMode;
    this.view.resetEffects();
    this.stats.seed = sim.seed;
    this.debugMenu.setSeed(sim.seed);
  }

  private showTitle(): void {
    if (this.mode === 'room' || this.mode === 'arena') this.loadSim(this.backdropSim());
    this.setMode('title');
    const saved = loadRun(this.store);
    this.ui.show({
      kind: 'title',
      canContinue: saved !== null,
      version: this.version,
      onContinue: () => this.continueRun(),
      onNewRun: () => this.startRun(),
      onArena: () => this.startArena(randomSeed()),
    });
  }

  private startRun(): void {
    this.run = createRun(randomSeed());
    saveRun(this.store, this.run);
    this.showMap();
  }

  private continueRun(): void {
    const run = loadRun(this.store);
    if (!run) {
      this.showTitle();
      return;
    }
    this.run = run;
    const node = run.map.nodes[run.currentNodeId];
    // Saved on room entry: the room restarts from its entry state.
    if (run.status === 'room' && node) {
      if (node.type === 'rest') this.showRest();
      else this.startRoom();
    } else this.showMap();
  }

  private showMap(): void {
    const run = this.run;
    if (!run) return;
    if (this.mode === 'room') this.loadSim(this.backdropSim());
    this.setMode('map');
    this.ui.show({ kind: 'map', run, onEnter: (id) => this.enterNode(id) });
  }

  private enterNode(nodeId: number): void {
    const run = this.run;
    if (!run) return;
    const node = enterNode(run, nodeId);
    saveRun(this.store, run);
    if (node.type === 'rest') this.showRest();
    else this.startRoom();
  }

  private showRest(): void {
    const run = this.run;
    if (!run) return;
    this.setMode('rest');
    const healAmount = Math.min(
      run.maxHp - run.hp,
      Math.round(run.maxHp * EMBER_WASTES.restHealFraction),
    );
    this.ui.show({
      kind: 'rest',
      run,
      healAmount,
      onRest: () => {
        rest(run);
        saveRun(this.store, run);
        this.audio.play('waveCleared', { pitch: 0.8, pitchVariation: 0 });
        this.showMap();
      },
    });
  }

  private startRoom(): void {
    const run = this.run;
    const node = run?.map.nodes[run.currentNodeId];
    if (!run || !node) return;
    this.loadSim(createSim(roomSeed(run, node.id), roomSetupFor(run, node)));
    this.setMode('room');
  }

  private roomResult() {
    return {
      hp: this.sim.c.hp[this.sim.playerEid] ?? 0,
      kills: this.sim.player.kills,
      timeSec: this.sim.room.elapsedTicks / TICK_RATE_HZ,
    };
  }

  private finishRoom(): void {
    const run = this.run;
    if (!run) return;
    completeRoom(run, this.roomResult());
    if (run.status === 'won') {
      clearRun(this.store);
      this.loadSim(this.backdropSim());
      this.setMode('victory');
      this.ui.show({ kind: 'victory', run, onTitle: () => this.showTitle() });
      return;
    }
    saveRun(this.store, run);
    this.showMap();
  }

  private startArena(seed: number): void {
    this.run = null;
    this.loadSim(createSim(seed));
    this.setMode('arena');
  }

  private showDeath(): void {
    const run = this.run;
    let stats: string;
    if (this.mode === 'room' && run) {
      failRun(run, this.roomResult());
      clearRun(this.store);
      stats = t('death.run_stats', { rooms: run.roomsCleared + 1, kills: run.kills });
    } else {
      stats = t('death.stats', { wave: this.sim.waves.wave, kills: this.sim.player.kills });
    }
    this.deathOverlay.show(stats, this.input.lastDevice, nowMs());
  }

  private afterDeath(): void {
    if (this.mode === 'arena') this.startArena(randomSeed());
    else {
      this.run = null;
      this.showTitle();
    }
  }

  // ── Misc ────────────────────────────────────────────────────────────────

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
      mode: () => this.mode,
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
      roomsCleared: () => this.run?.roomsCleared ?? 0,
      stateHash: () => hashSim(sim()),
    };
  }

  private slowMo(req: SlowMoRequest): void {
    // The strongest request wins; overlapping requests don't multiply.
    if (this.slowMoSec <= 0 || req.scale < this.slowMoScale) this.slowMoScale = req.scale;
    this.slowMoSec = Math.max(this.slowMoSec, req.durationSec);
  }

  private setPaused(paused: boolean): void {
    if (paused === this.paused) return;
    // Pausing only makes sense while playing; menus are already "paused".
    if (paused && this.mode !== 'room' && this.mode !== 'arena') return;
    this.paused = paused;
    // Releasing on both edges avoids "stuck" keys from presses made while the overlay was up.
    this.input.releaseAll();
    this.input.setGameplayEnabled(!paused);
    if (paused) {
      this.pauseOverlay.show(this.input.lastDevice);
      this.audio.suspend();
    } else {
      this.pauseOverlay.hide();
      this.audio.resume();
      this.stepper.reset();
    }
  }

  /** Gamepad navigation for DOM menus (map, title, pause). */
  private handleMenuInput(): void {
    const actions = this.input.consumeMenuActions();
    if (actions === 0) return;
    const menuOpen = this.ui.active || this.paused;
    if (!menuOpen) return;
    const nav = (dir: NavDirection) => {
      if (this.paused) this.navigatePause(dir);
      else this.ui.navigate(dir);
    };
    if (actions & MenuAction.Up) nav('up');
    if (actions & MenuAction.Down) nav('down');
    if (actions & MenuAction.Left) nav('left');
    if (actions & MenuAction.Right) nav('right');
    if (actions & MenuAction.Confirm) {
      const el = document.activeElement;
      if (el instanceof HTMLElement && el !== document.body) el.click();
      else if (!this.paused) this.ui.confirm();
    }
    if (actions & MenuAction.Back && this.paused) this.setPaused(false);
  }

  private navigatePause(dir: NavDirection): void {
    navigate(this.pauseOverlay.element, dir);
  }

  private readonly loop = (timestamp: number): void => {
    requestAnimationFrame(this.loop);
    const frameStart = nowMs();
    const realDtSec = Math.min(
      Math.max(0, (timestamp - this.lastFrameMs) / 1000),
      MAX_FRAME_DT_SEC,
    );
    this.lastFrameMs = timestamp;
    const playing = this.mode === 'room' || this.mode === 'arena';

    this.input.poll();
    this.handleMenuInput();
    if (this.input.consumeAppAction('debug')) this.debugMenu.toggle();
    if (this.input.consumeAppAction('pause') && playing && !this.deathOverlay.visible) {
      this.setPaused(!this.paused);
    }

    if (this.slowMoSec > 0) {
      this.slowMoSec -= realDtSec;
      if (this.slowMoSec <= 0) this.slowMoScale = 1;
    }
    const timeScale = this.debugTimeScale * this.slowMoScale;
    const running = playing && !this.paused;

    let simMs = 0;
    if (running) {
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
        if (this.deathOverlaySec <= 0) this.showDeath();
      }
      if (this.exitTransitionSec > 0) {
        this.exitTransitionSec -= realDtSec;
        if (this.exitTransitionSec <= 0) this.finishRoom();
      }
    }

    const renderStart = nowMs();
    const dt = running ? realDtSec : 0;
    this.feedback.update(this.sim, dt);
    this.view.render(
      this.sim,
      running ? this.stepper.alpha : 1,
      dt * timeScale,
      dt,
      this.input.touch,
      this.input.lastDevice,
      playing,
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
