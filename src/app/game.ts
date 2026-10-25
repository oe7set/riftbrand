import { RIFT_SHOT } from '../content/abilities';
import { ART_STYLE } from '../content/art/style';
import { BOONS } from '../content/boons';
import { DIALOGUE } from '../content/dialogue';
import { ELITES } from '../content/elites';
import { ENEMIES, ENEMY_TYPE } from '../content/enemies';
import { EVOLUTIONS } from '../content/evolutions';
import { REFUGE } from '../content/hub/layout';
import { DEFAULT_CAPE } from '../content/hub/market';
import { MATERIALS } from '../content/materials';
import { questById } from '../content/quests';
import { RELICS } from '../content/relics';
import type { BeingId, RoomType, Speaker, StationId } from '../content/schema';
import { statusIdSchema } from '../content/schema';
import { SPELLS, spellById } from '../content/spells';
import { sceneById, VOICE_PITCH } from '../content/story/scenes';
import { worldBiome, worldById } from '../content/worlds';
import { AudioEngine } from '../platform/audio/audio-engine';
import type { MusicMode } from '../platform/audio/music-player';
import {
  applyUiTheme,
  currentWeekIndex,
  daysUntilNextWeek,
  hasTouchScreen,
  nowMs,
  preferredLanguages,
  readViewport,
  watchFocusLoss,
  watchViewport,
} from '../platform/display';
import { Haptics } from '../platform/haptics';
import { MenuAction } from '../platform/input/bindings';
import { type InputDevice, InputManager } from '../platform/input/input-manager';
import type { TouchButtonId } from '../platform/input/touch-layout';
import {
  browserProfileStore,
  copyToClipboard,
  requestPersistentStorage,
} from '../platform/storage/indexed-db';
import {
  exportProfile,
  importProfile,
  loadProfile,
  type ProfileStore,
  saveProfile,
} from '../platform/storage/profile-save';
import {
  appendRunLog,
  downloadText,
  loadRunLog,
  type RunLogEntry,
} from '../platform/storage/run-log';
import { clearRun, loadRun, saveRun } from '../platform/storage/run-save';
import {
  browserStore,
  loadSettings,
  type Settings,
  saveSettings,
} from '../platform/storage/settings';
import { getLocale, resolveLocale, setLocale, type TranslationKey, t } from '../shared/i18n';
import { Button, createInputFrame } from '../shared/input-frame';
import type { RoomReport } from '../sim/bot/autoplay';
import {
  debugApplyStatus,
  debugClearRoom,
  debugGatherEnemies,
  debugKillAllEnemies,
  debugNextWave,
  debugSpawnEnemy,
  debugWarpToExit,
} from '../sim/debug';
import { C } from '../sim/ecs/components';
import { dominantBeing } from '../sim/effects/build';
import { enemyTypeFromCode, packEnemy } from '../sim/enemy-code';
import { Ev, type EventBuffer } from '../sim/events';
import { hashSim } from '../sim/hash';
import { COMBAT_BUTTONS, hubInteractPressed, hubRoomSetup, nearestStation } from '../sim/hub/hub';
import { markSeen, pickLine } from '../sim/meta/dialogue';
import { equippedArmor, forgeArmor, toggleEquip } from '../sim/meta/forge';
import { buyCosmetic, capeColor, syncMarketWeek, trade, wearCape } from '../sim/meta/market';
import {
  buyRank,
  equipLoadout,
  type LastRun,
  lockedRelics,
  type Profile,
  respec,
  runMetaFor,
  settleRun,
  startSpellsFor,
  unlockRelic,
  unlockSpell,
} from '../sim/meta/profile';
import {
  acceptQuest,
  claimQuest,
  liveProgress,
  questFrom,
  questItemToFind,
  questNodeTypes,
  questStatus,
  trackQuest,
} from '../sim/meta/quests';
import {
  addMaterials,
  buildingInhabited,
  buildingLevel,
  buyDecoration,
  hasUnlock,
  MAX_BUILDING_LEVEL,
  refugeGrowth,
  upgradeBuilding,
} from '../sim/meta/refuge';
import { defaultWorld, isWorldPlayable } from '../sim/meta/worlds';
import {
  addRelic,
  applyOutcomes,
  applyUpgrade,
  equipRunSpell,
  eventFor,
  heal,
  nodeReward,
  type ResolvedOutcome,
  rollRelicOffer,
  rollSpellOffer,
  rollUpgradeOffer,
  runStats,
  shopStock,
} from '../sim/run/economy';
import type { Encounter } from '../sim/run/encounter';
import type { MapNode } from '../sim/run/map';
import { addBoon, type BoonOffer } from '../sim/run/rewards';
import {
  availableEvolutions,
  completeNonCombat,
  completeRoom,
  createRun,
  enterNode,
  evolve,
  failRun,
  offerFor,
  pickBoon,
  type RunState,
  rerollOffer,
  rest,
  restEvolve,
  roomSeed,
  roomSetupFor,
  startSpellSlots,
} from '../sim/run/run-state';
import { branchTier, MAX_UPGRADE_LEVEL, type UpgradeOption } from '../sim/run/upgrades';
import {
  clearDrifters,
  createSim,
  drainEvents,
  equipCast,
  equipSpells,
  type SimState,
  setBuild,
  spawnDrifters,
  spellSlotsOf,
  stepSim,
} from '../sim/sim';
import { TICK_DT_SEC, TICK_RATE_HZ } from '../sim/time';
import { GameView } from '../view/game-view';
import type { RefugeLook } from '../view/hub/hub-view';
import { worldToScreen } from '../view/render/camera';
import type { StationAction } from '../view/ui/meta-screens';
import { type NavDirection, navigate } from '../view/ui/spatial-nav';
import { Ui } from '../view/ui/ui';
import { DebugMenu, type DebugStats } from './debug/debug-menu';
import { FeedbackDirector, type SlowMoRequest } from './feedback';
import { FixedStepper } from './fixed-stepper';
import { DeathOverlay, PauseOverlay } from './overlays';

declare const __APP_VERSION__: string;
declare const __GIT_HASH__: string;

/** Ring radius for the debug "Gather enemies" button. */
const DEBUG_GATHER_RADIUS_PX = 150;
/** Longest frame we simulate; anything longer (tab switch, breakpoint) is treated as a hitch. */
const MAX_FRAME_DT_SEC = 0.25;
const STATS_SMOOTHING = 0.05;
/** Let the death animation and slow motion play before the overlay appears. */
const DEATH_OVERLAY_DELAY_SEC = 1.1;
/** Let the portal effect play before switching to the map. */
const EXIT_TRANSITION_SEC = 0.35;
const RESTART_BUTTONS = Button.Attack | Button.Dash | Button.Interact;

/** Where the player is in the game flow (title → hub → map ⇄ room/rest → result → hub). */
type Mode =
  | 'title'
  | 'hub'
  | 'map'
  | 'rest'
  | 'reward'
  | 'room'
  | 'arena'
  | 'result'
  /** A story scene over a loaded room; the sim waits (ROADMAP M5.7). */
  | 'scene';

/**
 * What a being says when it offers a boon (ROADMAP M5.7): its usual greeting on an empty
 * build, pride when it already leads, a jab when another being does.
 */
function beingComment(being: BeingId, dominant: BeingId | null): string {
  if (dominant === null) return t(`being.${being}.quote` as TranslationKey);
  return t(`being.${being}.${dominant === being ? 'loyal' : 'rival'}` as TranslationKey);
}

/** Enemy id of an encounter's first enemy (the boss or duel champion). */
function firstEnemyId(encounter: Encounter): string | null {
  if (encounter.kind !== 'waves') return null;
  const code = encounter.waves[0]?.[0];
  return code === undefined ? null : (ENEMIES[enemyTypeFromCode(code)]?.id ?? null);
}

function describeOutcome(o: ResolvedOutcome): string {
  switch (o.type) {
    case 'heal':
      return t('event.result.heal', { n: o.healed ?? 0 });
    case 'damage':
      return t('event.result.damage', { n: o.amount });
    case 'shards':
      return o.amount >= 0
        ? t('event.result.shards_gain', { n: o.amount })
        : t('event.result.shards_lose', { n: -o.amount });
    case 'maxHp':
      return t('event.result.max_hp', { n: o.amount });
    case 'relic':
      return t('event.result.relic', {
        name: o.relicId ? t(`relic.${o.relicId}.name` as TranslationKey) : '?',
      });
  }
}

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
  /** Look comparison and stress tests (ROADMAP M4.1 performance check). */
  setRigLook(enabled: boolean): void;
  spawnEnemy(code: number): void;
  gatherEnemies(): void;
  applyStatus(id: string, stacks: number): void;
  setGodMode(enabled: boolean): void;
  setTimeScale(scale: number): void;
  /** Smoothed render time per frame (ms), for look comparisons. */
  renderMs(): number;
  /** CSS pixel position of a world point (screenshots of single creatures). */
  screenOf(x: number, y: number): { x: number; y: number };
  /** Fills the stash with every material plus Rissstaub (refuge tests, ROADMAP M5.3). */
  giveMaterials(each: number, dust: number): void;
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
  /** Meta progression (GDD §8); `profileRaw` is the last saved JSON, kept as backup. */
  private profile: Profile;
  private profileRaw: string | null;
  /** Hub dialogue for the current visit; cleared when a run ends so the next visit reacts. */
  private hubLines: Partial<Record<Speaker, string>> | null = null;
  /** Figures with an unheard line this visit (speech bubble in the refuge). */
  private hubFresh: Partial<Record<Speaker, boolean>> = {};
  /** Bubble per figure: quest marks win over "…" (ROADMAP M5.6). */
  private hubMarks: Partial<Record<Speaker, string>> = {};
  /** What the refuge view draws of the rebuild (ROADMAP M5.3); replaced whenever it changes. */
  private refugeLook: RefugeLook = { version: 0, levels: {}, decorations: [], growth: 0 };
  /** The refuge's room simulation, while it is loaded. */
  private hubSim: SimState | null = null;
  /** Station in reach (index into REFUGE.stations), -1 = none. */
  private hubActive = -1;
  /** A station's menu is open: walking pauses. */
  private hubMenu = false;
  /** Device the interact hint was written for (keyboard, gamepad and touch differ). */
  private hubPromptDevice: InputDevice | null = null;
  /** Settlement of the run that just ended, shown on the result screen. */
  private lastRun: LastRun | null = null;
  /** Rooms and damage of the current run for the run log (TECH_DESIGN §13). */
  private logRooms: RoomReport[] = [];
  private logDamage: Record<string, number> = {};
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
      if (type === Ev.PlayerDied) {
        this.deathOverlaySec = DEATH_OVERLAY_DELAY_SEC;
        this.audio.setMusic('silent');
      }
      // The fight is over: back to the calm layers while walking to the exit.
      if (type === Ev.RoomCleared) this.audio.setMusic('explore');
      if (type === Ev.ExitReached) this.exitTransitionSec = EXIT_TRANSITION_SEC;
    }
  };

  private constructor(
    root: HTMLElement,
    private readonly view: GameView,
    private readonly profileStore: ProfileStore | null,
    loaded: { profile: Profile; raw: string | null },
  ) {
    this.profile = loaded.profile;
    this.profileRaw = loaded.raw;
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
        spawnEnemy: (code) => debugSpawnEnemy(this.sim, code),
        killAllEnemies: () => debugKillAllEnemies(this.sim),
        gatherEnemies: () => debugGatherEnemies(this.sim, DEBUG_GATHER_RADIUS_PX),
        clearRoom: () => debugClearRoom(this.sim),
        warpToExit: () => debugWarpToExit(this.sim),
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
        setRigLook: (on) => {
          this.view.entities.look = on ? 'rig' : 'classic';
        },
        giveBoon: (id) => {
          const boons = addBoon(this.sim.boons, { id, rarity: 'rare' });
          setBuild(this.sim, boons);
          if (this.run) this.run.boons = boons;
        },
        clearBoons: () => {
          setBuild(this.sim, []);
          if (this.run) this.run.boons = [];
        },
        giveRelic: (id) => {
          const relics = this.sim.relics.map((r) => ({ ...r }));
          const owned = relics.find((r) => r.id === id);
          if (owned) owned.stacks++;
          else relics.push({ id, stacks: 1 });
          setBuild(this.sim, this.sim.boons, relics);
          if (this.run) addRelic(this.run, id);
        },
        giveShards: (n) => {
          this.sim.shards += n;
          if (this.run) this.run.shards += n;
        },
        exportRunLog: () => {
          downloadText('riftbrand-runlog.json', JSON.stringify(loadRunLog(this.store), null, 2));
        },
        giveMaterials: (each) => this.giveMaterials(each, 5),
        giveMeta: (ember, dust) => {
          this.profile.ember += ember;
          this.profile.dust += dust;
          this.persistProfile();
          // Refresh whichever meta screen is open so the new balance shows.
          if (this.ui.kind === 'tree') this.showTree();
          else if (this.ui.kind === 'wares') this.showWares();
          else if (this.ui.kind === 'hubWalk') this.showHubWalk();
        },
        fillUltimate: () => {
          this.sim.player.ultCharge = 1;
        },
        refillCast: () => {
          this.sim.player.castCharges = RIFT_SHOT.charges;
          this.sim.player.spellCooldownTicks = 0;
        },
        equipSpell: (id) => {
          const def = spellById(id);
          if (!def) return;
          const slots = this.run?.spells ?? spellSlotsOf(this.sim);
          const owned = { id, level: 1, branches: [] };
          const next =
            def.kind === 'active' ? { ...slots, active: owned } : { ...slots, aura: owned };
          if (this.run) this.run.spells = next;
          equipSpells(this.sim, next);
        },
        upgrade: (target, branch) => {
          const slots = this.run?.spells ?? spellSlotsOf(this.sim);
          const cast = this.run?.cast ?? {
            level: this.sim.castUpgrade.level,
            branches: [...this.sim.castUpgrade.branches],
          };
          const state = target === 'cast' ? cast : target === 'active' ? slots.active : slots.aura;
          if (!state || state.level >= MAX_UPGRADE_LEVEL) return;
          state.level++;
          if (branchTier(state.level)) state.branches[state.level === 3 ? 0 : 1] = branch;
          equipSpells(this.sim, slots);
          equipCast(this.sim, cast);
        },
        giveEvolution: (id) => {
          setBuild(this.sim, this.sim.boons, this.sim.relics, [
            ...this.sim.evolutions.filter((e) => e !== id),
            id,
          ]);
          if (this.run) evolve(this.run, id);
        },
        applyStatus: (id, stacks) => {
          const parsed = statusIdSchema.safeParse(id);
          if (parsed.success) debugApplyStatus(this.sim, parsed.data, stacks);
        },
      },
      ENEMIES.map((e) => e.id),
      this.version,
      BOONS.map((b) => b.id),
      RELICS.map((r) => r.id),
      EVOLUTIONS.map((e) => e.id),
      ELITES.map((e, i) => ({
        label: `${e.id} slag`,
        code: packEnemy(ENEMY_TYPE.slag, i + 1),
      })),
      SPELLS.map((s) => s.id),
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
        editLayout: () => this.openLayoutEditor(),
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
    // The picture-book art style (ROADMAP M4.5) sets the menu look; the view bakes it in.
    const style = ART_STYLE;
    applyUiTheme(style.id, {
      '--rb-bg': style.ui.bg,
      '--rb-fg': style.ui.fg,
      '--rb-accent': style.ui.accent,
      '--rb-panel': style.ui.panel,
      '--rb-title': style.ui.title,
      '--rb-font': style.ui.font,
      '--rb-radius': `${style.ui.radiusPx}px`,
    });
    const view = await GameView.create(readViewport(), style);
    const profileStore = browserProfileStore();
    requestPersistentStorage();
    const game = new Game(root, view, profileStore, await loadProfile(profileStore));
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
    // Leaving the refuge for a menu: the quiet backdrop arena replaces it.
    if (mode !== 'hub' && this.hubSim !== null && this.sim === this.hubSim) {
      this.loadSim(this.backdropSim());
    }
    if (mode !== 'hub') this.hubSim = null;
    this.mode = mode;
    const playing = mode === 'room' || mode === 'arena';
    this.input.setGameplayEnabled(playing || mode === 'hub');
    this.deathOverlay.hide();
    this.deathOverlaySec = -1;
    this.exitTransitionSec = -1;
    this.slowMoSec = 0;
    this.slowMoScale = 1;
    this.stepper.reset();
    if (playing) this.ui.show({ kind: 'none' });
    this.audio.setMusic(this.musicFor(mode));
  }

  /** Exploring and menus get the calm layers; fights add drums and bass; the boss has its own. */
  private musicFor(mode: Mode): MusicMode {
    if (mode === 'arena') return 'combat';
    if (mode === 'hub') return 'refuge';
    if (mode !== 'room') return 'explore';
    const node = this.run?.map.nodes[this.run.currentNodeId];
    return node?.type === 'boss' ? 'boss' : 'combat';
  }

  private loadSim(sim: SimState): void {
    const debug = { ...this.sim.debug };
    this.sim = sim;
    // Vesper wears the run's armour in rooms (ROADMAP M5.4); the refuge sets its own below.
    this.view.setPlayerLook(
      sim.armor.map((a) => a.id),
      this.capeLook(),
    );
    // Keep debug toggles (god mode, waves) across rooms.
    sim.debug.godMode = debug.godMode;
    this.view.resetEffects();
    this.feedback.championAnnounced = false;
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
      onRefuge: () => this.showHub(),
      onArena: () => this.startArena(randomSeed()),
    });
  }

  private persistProfile(): void {
    void saveProfile(this.profileStore, this.profile, this.profileRaw).then((raw) => {
      this.profileRaw = raw;
    });
  }

  /**
   * The walkable refuge (GDD §2.3, ROADMAP M5.1): you arrive at the campfire; figures and
   * stations open their menus. Called again from a station's menu, it returns to walking.
   */
  private showHub(arrival: 'campfire' | 'portal' = 'campfire'): void {
    if (this.mode !== 'hub') {
      const sim = createSim(randomSeed(), hubRoomSetup(REFUGE, arrival));
      this.loadSim(sim);
      this.hubSim = sim;
      this.setMode('hub');
      this.hubActive = -1;
      this.pickHubLines();
      this.refreshRefuge();
    }
    this.view.setPlayerLook(
      equippedArmor(this.profile).map((a) => a.id),
      this.capeLook(),
    );
    this.hubMenu = false;
    this.refreshHubMarks();
    this.input.releaseAll();
    this.input.setGameplayEnabled(true);
    this.stepper.reset();
    this.showHubWalk();
  }

  /** One dialogue line per figure and visit; it counts as heard once you talk to them. */
  private pickHubLines(): void {
    if (this.hubLines) return;
    this.hubLines = {};
    this.hubFresh = {};
    for (const station of REFUGE.stations) {
      const speaker = station.npc?.speaker;
      // Figures of unbuilt ruins haven't moved in yet.
      if (!speaker || (station.building && !buildingInhabited(this.profile, station.building))) {
        continue;
      }
      const line = pickLine(this.profile, speaker);
      if (!line) continue;
      this.hubLines[speaker] = line.id;
      this.hubFresh[speaker] = true;
    }
  }

  /** Bubbles over the figures: "✓" quest to hand in, "!" quest on offer, "…" new line. */
  private refreshHubMarks(): void {
    const marks: Partial<Record<Speaker, string>> = {};
    for (const station of REFUGE.stations) {
      const speaker = station.npc?.speaker;
      if (!speaker) continue;
      if (station.building && !buildingInhabited(this.profile, station.building)) continue;
      const quest = questFrom(this.profile, speaker);
      const status = quest ? questStatus(this.profile, quest.id) : null;
      if (status === 'ready') marks[speaker] = '✓';
      else if (status === 'available') marks[speaker] = '!';
      else if (this.hubFresh[speaker]) marks[speaker] = '…';
    }
    this.hubMarks = marks;
  }

  /** New look for the refuge view after anything was built or bought. */
  private refreshRefuge(): void {
    this.refugeLook = {
      version: this.refugeLook.version + 1,
      levels: { ...this.profile.buildings },
      decorations: [...this.profile.decorations],
      growth: refugeGrowth(this.profile),
    };
  }

  private hubPrompt(): string | null {
    const station = REFUGE.stations[this.hubActive];
    if (!station) return null;
    const device = this.input.lastDevice;
    const key =
      device === 'touch'
        ? t('hub.key_touch')
        : device === 'gamepad'
          ? t('hub.key_gamepad')
          : t('hub.key_keyboard');
    return t('hub.prompt', { key, action: t(`hub.action.${station.id}` as TranslationKey) });
  }

  private showHubWalk(): void {
    this.ui.show({ kind: 'hubWalk', profile: this.profile, prompt: this.hubPrompt() });
  }

  /** Opens a station's menu; walking pauses until you step back. */
  private openStation(id: StationId): void {
    this.hubMenu = true;
    this.input.releaseAll();
    this.input.setGameplayEnabled(false);
    if (id === 'portal') {
      this.showWorldMap();
      return;
    }
    const station = REFUGE.stations.find((s) => s.id === id);
    const building = station?.building ?? null;
    // A ruin has nobody to talk to yet: its site opens the build menu.
    if (building && !buildingInhabited(this.profile, building)) {
      this.showBuild(building);
      return;
    }
    const actions: StationAction[] = [];
    const speaker = station?.npc?.speaker ?? null;
    let line: string | null = null;
    if (speaker) {
      line = this.hubLines?.[speaker] ?? null;
      const def = line ? DIALOGUE.find((d) => d.id === line) : undefined;
      if (def && this.hubFresh[speaker]) {
        markSeen(this.profile, def);
        this.persistProfile();
      }
      this.hubFresh[speaker] = false;
    }
    const quest = speaker ? questFrom(this.profile, speaker) : null;
    if (quest) {
      const status = questStatus(this.profile, quest.id);
      const name = t(`quest.${quest.id}.name` as TranslationKey);
      actions.push({
        label:
          status === 'ready'
            ? t('quest.action_ready', { name })
            : status === 'available'
              ? t(quest.kind === 'story' ? 'quest.action_story' : 'quest.action_new', { name })
              : t('quest.action_active', { name }),
        onClick: () => this.showQuest(quest.id),
        primary: status === 'ready' || status === 'available',
      });
    }
    if (id === 'maren')
      actions.push({ label: t('hub.tree'), onClick: () => this.showTree(), primary: true });
    if (id === 'nix') {
      actions.push({ label: t('hub.market'), onClick: () => this.showMarket(), primary: true });
      actions.push({ label: t('hub.wares'), onClick: () => this.showWares() });
    }
    if (id === 'sel')
      actions.push({ label: t('hub.spells'), onClick: () => this.showSpells(), primary: true });
    if (id === 'forge' && hasUnlock(this.profile, 'armor')) {
      actions.push({ label: t('hub.armor'), onClick: () => this.showForge(), primary: true });
    }
    if (id === 'map_table') {
      actions.push({
        label: t('hub.world_map'),
        onClick: () => this.showWorldMap(),
        primary: true,
      });
    }
    if (id === 'campfire') {
      if (hasUnlock(this.profile, 'decorations')) {
        actions.push({ label: t('hub.decorations'), onClick: () => this.showDecorations() });
      }
      actions.push({ label: t('quest.log'), onClick: () => this.showQuestLog() });
      actions.push({ label: t('hub.profile'), onClick: () => this.showProfile(null) });
      actions.push({ label: t('hub.to_title'), onClick: () => this.showTitle() });
    }
    if (building && buildingLevel(this.profile, building) < MAX_BUILDING_LEVEL) {
      actions.push({
        label: t('hub.build', { name: t(`building.${building}.name` as TranslationKey) }),
        onClick: () => this.showBuild(building),
        primary: actions.length === 0,
      });
    }
    const p = this.profile;
    this.ui.show({
      kind: 'station',
      profile: p,
      onBack: () => this.showHub(),
      title: speaker
        ? t(`speaker.${speaker}` as TranslationKey)
        : t(`station.${id}.title` as TranslationKey),
      speaker,
      line,
      actions,
      footer:
        id === 'campfire'
          ? t('hub.stats', { runs: p.runs, wins: p.wins, rooms: p.bestRooms })
          : id === 'archive'
            ? t('hub.soon.archive')
            : undefined,
    });
  }

  /** A building site (ROADMAP M5.3): what the next level costs and brings. */
  private showBuild(building: string): void {
    this.ui.show({
      kind: 'build',
      profile: this.profile,
      building,
      onBuild: () => {
        if (!upgradeBuilding(this.profile, building)) return;
        this.persistProfile();
        this.refreshRefuge();
        // A figure moving into a rebuilt ruin may have something to say.
        this.hubLines = null;
        this.pickHubLines();
        this.audio.play('evolve', { pitch: 0.9, pitchVariation: 0, volume: 0.8 });
        this.showBuild(building);
      },
      onBack: () => this.showHub(),
    });
  }

  /** Cape colour for Vesper's look; null keeps the art style's own red. */
  private capeLook(): number | null {
    return this.profile.cape === DEFAULT_CAPE ? null : capeColor(this.profile);
  }

  /** Nix's market (ROADMAP M5.5): this week's trades and capes, plus the wardrobe. */
  private showMarket(): void {
    const week = currentWeekIndex();
    syncMarketWeek(this.profile, week);
    const refresh = () => {
      this.persistProfile();
      this.view.setPlayerLook(
        equippedArmor(this.profile).map((a) => a.id),
        this.capeLook(),
      );
      this.showMarket();
    };
    this.ui.show({
      kind: 'market',
      profile: this.profile,
      week,
      daysLeft: daysUntilNextWeek(),
      onTrade: (id) => {
        if (!trade(this.profile, id, week)) return;
        this.audio.play('evolve', { pitch: 1.3, pitchVariation: 0, volume: 0.6 });
        refresh();
      },
      onBuyCape: (id) => {
        if (!buyCosmetic(this.profile, id, week)) return;
        this.audio.play('evolve', { pitch: 1.1, pitchVariation: 0, volume: 0.7 });
        refresh();
      },
      onWearCape: (id) => {
        if (wearCape(this.profile, id)) refresh();
      },
      onBack: () => this.showHub(),
    });
  }

  /** The tracked quest with its progress including this run, for the map and the HUD. */
  private questTracker(): { text: string; nodeTypes: RoomType[] } | null {
    const id = this.profile.quests.tracked;
    const quest = id ? questById(id) : undefined;
    if (!quest) return null;
    const progress = liveProgress(this.profile, this.run, quest.id);
    const open = progress.find(([have, need]) => have < need);
    return {
      text: t('hud.quest', {
        name: t(`quest.${quest.id}.name` as TranslationKey),
        progress: open ? (open[1] > 1 ? `${open[0]}/${open[1]}` : '') : '✓',
      }),
      nodeTypes: questNodeTypes(quest),
    };
  }

  /** One quest (ROADMAP M5.6): what it asks, progress, reward; accept or hand in. */
  private showQuest(questId: string): void {
    this.ui.show({
      kind: 'quest',
      profile: this.profile,
      questId,
      onAccept: () => {
        if (!acceptQuest(this.profile, questId)) return;
        this.persistProfile();
        this.audio.play('evolve', { pitch: 1.2, pitchVariation: 0, volume: 0.6 });
        this.showQuest(questId);
      },
      onClaim: () => {
        if (!claimQuest(this.profile, questId)) return;
        this.persistProfile();
        this.refreshRefuge();
        this.audio.play('waveCleared', { pitchVariation: 0 });
        this.showQuest(questId);
      },
      onTrack: () => {
        if (trackQuest(this.profile, questId)) this.persistProfile();
        this.showQuest(questId);
      },
      onBack: () => this.showHub(),
    });
  }

  /** All open quests with progress; one can be tracked in the run HUD. */
  private showQuestLog(): void {
    this.ui.show({
      kind: 'questLog',
      profile: this.profile,
      onTrack: (questId) => {
        if (trackQuest(this.profile, questId)) this.persistProfile();
        this.showQuestLog();
      },
      onBack: () => this.showHub(),
    });
  }

  /** Toll's forge (ROADMAP M5.4): armour for the next run. */
  private showForge(): void {
    this.ui.show({
      kind: 'forge',
      profile: this.profile,
      onForge: (id) => {
        if (!forgeArmor(this.profile, id)) return;
        this.persistProfile();
        this.audio.play('evolve', { pitch: 0.8, pitchVariation: 0, volume: 0.8 });
        this.showForge();
      },
      onEquip: (id) => {
        if (!toggleEquip(this.profile, id)) return;
        this.persistProfile();
        this.showForge();
      },
      onBack: () => this.showHub(),
    });
  }

  /** Cosmetic decorations at the campfire (ROADMAP M5.3). */
  private showDecorations(): void {
    this.ui.show({
      kind: 'decorations',
      profile: this.profile,
      onBuy: (id) => {
        if (!buyDecoration(this.profile, id)) return;
        this.persistProfile();
        this.refreshRefuge();
        this.audio.play('evolve', { pitch: 1.2, pitchVariation: 0, volume: 0.6 });
        this.showDecorations();
      },
      onBack: () => this.showHub(),
    });
  }

  /** The portal hall (ROADMAP M5.2): pick a world, or carry on with the run in progress. */
  private showWorldMap(): void {
    const saved = loadRun(this.store);
    this.ui.show({
      kind: 'worldMap',
      profile: this.profile,
      runWorld: saved?.worldId ?? null,
      selected: defaultWorld(this.profile, this.profile.lastRun?.worldId ?? null).id,
      onDepart: (worldId) => this.startRun(worldId),
      onContinue: () => this.continueRun(),
      onAbandon: () => this.abandonRun(),
      onBack: () => this.showHub(),
    });
  }

  /** Sel's rune tower (ROADMAP M3.6): unlock spells and pick the loadout for the next run. */
  private showSpells(): void {
    this.ui.show({
      kind: 'spells',
      profile: this.profile,
      onUnlock: (id) => {
        if (!unlockSpell(this.profile, id)) return;
        equipLoadout(this.profile, id);
        this.persistProfile();
        this.audio.play('evolve', { pitch: 1.1, pitchVariation: 0, volume: 0.7 });
        this.showSpells();
      },
      onEquip: (id) => {
        if (!equipLoadout(this.profile, id)) return;
        this.persistProfile();
        this.audio.play('boonPick', { pitch: 1.2, pitchVariation: 0 });
        this.showSpells();
      },
      onBack: () => this.showHub(),
    });
  }

  private showTree(): void {
    this.ui.show({
      kind: 'tree',
      profile: this.profile,
      onBuy: (id) => {
        if (!buyRank(this.profile, id)) return;
        this.persistProfile();
        this.audio.play('boonPick', { pitch: 0.9, pitchVariation: 0 });
        this.showTree();
      },
      onRespec: () => {
        respec(this.profile);
        this.persistProfile();
        this.showTree();
      },
      onBack: () => this.showHub(),
    });
  }

  private showWares(): void {
    this.ui.show({
      kind: 'wares',
      profile: this.profile,
      onUnlock: (id) => {
        if (!unlockRelic(this.profile, id)) return;
        this.persistProfile();
        this.audio.play('shard', { pitch: 0.8, pitchVariation: 0 });
        this.showWares();
      },
      onBack: () => this.showHub(),
    });
  }

  private showProfile(message: string | null): void {
    const render = (code: string | null) =>
      this.ui.show({
        kind: 'profile',
        exportCode: code,
        message,
        onCopy: () => {
          if (!code) return;
          void copyToClipboard(code).then((ok) => {
            message = ok ? t('profile.copied') : t('profile.copy_failed');
            render(code);
          });
        },
        onImport: (text) => {
          void importProfile(text).then((imported) => {
            if (!imported) {
              this.showProfile(t('profile.import_bad'));
              return;
            }
            this.profile = imported;
            this.hubLines = null;
            this.persistProfile();
            this.showProfile(t('profile.import_ok'));
          });
        },
        onBack: () => this.showHub(),
      });
    render(null);
    void exportProfile(this.profile).then((code) => {
      if (this.ui.kind === 'profile') render(code);
    });
  }

  /** Notes the room that just ended (cleared or not) for the run log. */
  private logRoom(cleared: boolean): void {
    const run = this.run;
    const node = run?.map.nodes[run.currentNodeId];
    if (!node) return;
    let damage = 0;
    const tally = this.sim.damageBySource;
    for (let i = 0; i < tally.length; i++) {
      const amount = tally[i] as number;
      if (amount <= 0) continue;
      damage += amount;
      const id = ENEMIES[i]?.id ?? 'unknown';
      this.logDamage[id] = (this.logDamage[id] ?? 0) + amount;
    }
    this.logRooms.push({
      type: node.type,
      layer: node.layer,
      timeSec: this.sim.room.elapsedTicks / TICK_RATE_HZ,
      damageTaken: damage,
      cleared,
    });
  }

  /** Books the ended run into the profile and the run log, and shows what it earned. */
  private endRun(result: 'won' | 'lost', killedBy: string | null): void {
    const run = this.run;
    if (!run) return;
    clearRun(this.store);
    this.lastRun = settleRun(this.profile, run, result, killedBy);
    this.hubLines = null;
    this.persistProfile();
    const entry: RunLogEntry = {
      date: new Date().toISOString(),
      version: this.version,
      seed: run.seed,
      result,
      roomsCleared: run.roomsCleared,
      kills: run.kills,
      timeSec: Math.round(run.playTimeSec),
      killedBy: this.lastRun.killedBy,
      dominant: dominantBeing(run.boons),
      boons: run.boons.map((b) => b.id),
      relics: run.relics.map((r) => r.id),
      evolutions: [...run.evolutions],
      tree: { ...this.profile.tree },
      rooms: this.logRooms,
      damageBySource: this.logDamage,
    };
    appendRunLog(this.store, entry);
    this.logRooms = [];
    this.logDamage = {};
  }

  private showResult(): void {
    const last = this.lastRun;
    this.run = null;
    if (!last) {
      this.showHub('portal');
      return;
    }
    if (this.mode === 'room') this.loadSim(this.backdropSim());
    this.setMode('result');
    this.ui.show({
      kind: 'result',
      last,
      profile: this.profile,
      onContinue: () => this.showHub('portal'),
    });
  }

  private abandonRun(): void {
    const run = loadRun(this.store);
    if (run) {
      this.run = run;
      this.endRun('lost', null);
      this.showResult();
    }
  }

  private startRun(worldId: string): void {
    const world = worldById(worldId);
    if (!world || !isWorldPlayable(this.profile, world)) return;
    this.logRooms = [];
    this.logDamage = {};
    this.run = createRun(
      randomSeed(),
      runMetaFor(this.profile),
      lockedRelics(this.profile),
      startSpellsFor(this.profile),
      world.id,
    );
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
      else if (node.type === 'altar') this.showAltar();
      else if (node.type === 'shop') this.showShop();
      else if (node.type === 'event') this.showEvent();
      else this.startRoom();
    } else this.showMap();
  }

  private showMap(): void {
    const run = this.run;
    if (!run) return;
    if (this.mode === 'room') this.loadSim(this.backdropSim());
    this.setMode('map');
    const tracker = this.questTracker();
    this.view.hud.setQuestTracker(tracker?.text ?? null);
    this.ui.show({ kind: 'map', run, quest: tracker, onEnter: (id) => this.enterNode(id) });
  }

  private enterNode(nodeId: number): void {
    const run = this.run;
    if (!run) return;
    const node = enterNode(run, nodeId);
    saveRun(this.store, run);
    if (node.type === 'rest') this.showRest();
    else if (node.type === 'altar') this.showAltar();
    else if (node.type === 'shop') this.showShop();
    else if (node.type === 'event') this.showEvent();
    else this.startRoom();
  }

  /** Altar: no fight, a (better) boon choice, preceded by an evolution offer if one is ready. */
  private showAltar(): void {
    const run = this.run;
    const node = run?.map.nodes[run.currentNodeId];
    if (!run || !node) {
      this.showMap();
      return;
    }
    const evolution = availableEvolutions(run)[0];
    const toBoons = () => {
      const offer = offerFor(run, node);
      if (offer) this.showBoonChoice(offer, node, () => completeNonCombat(run));
      else {
        completeNonCombat(run);
        saveRun(this.store, run);
        this.showMap();
      }
    };
    if (!evolution) {
      toBoons();
      return;
    }
    this.setMode('reward');
    this.ui.show({
      kind: 'evolution',
      id: evolution,
      onAccept: () => {
        evolve(run, evolution);
        saveRun(this.store, run);
        this.audio.play('evolve', { pitchVariation: 0 });
        toBoons();
      },
      onLater: toBoons,
    });
  }

  /** Shows a boon offer; `beforeSave` runs after the pick (e.g. marking the node done). */
  private showBoonChoice(offer: BoonOffer, node: MapNode, beforeSave?: () => void): void {
    const run = this.run;
    if (!run) return;
    if (this.mode === 'room') this.loadSim(this.backdropSim());
    this.setMode('reward');
    this.ui.show({
      kind: 'boon',
      offer,
      comment: beingComment(offer.being, run.boons.length > 0 ? dominantBeing(run.boons) : null),
      rerolls: run.rerolls,
      onReroll: () => {
        if (!rerollOffer(run)) return;
        saveRun(this.store, run);
        this.audio.play('shard', { pitch: 0.7, pitchVariation: 0 });
        const next = offerFor(run, node);
        if (next) this.showBoonChoice(next, node, beforeSave);
      },
      onPick: (option) => {
        pickBoon(run, option);
        beforeSave?.();
        saveRun(this.store, run);
        this.audio.play('boonPick', { pitchVariation: 0 });
        this.showMap();
      },
    });
  }

  private showRest(): void {
    const run = this.run;
    if (!run) return;
    this.setMode('rest');
    const healAmount = Math.min(
      run.maxHp - run.hp,
      Math.round(run.maxHp * worldBiome(run.worldId).restHealFraction),
    );
    const evolution = availableEvolutions(run)[0] ?? null;
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
      evolution,
      onEvolve: () => {
        if (!evolution) return;
        restEvolve(run, evolution);
        saveRun(this.store, run);
        this.audio.play('evolve', { pitchVariation: 0 });
        this.showMap();
      },
    });
  }

  private startRoom(): void {
    const run = this.run;
    const node = run?.map.nodes[run.currentNodeId];
    if (!run || !node) return;
    const setup = roomSetupFor(run, node);
    this.loadSim(createSim(roomSeed(run, node.id), setup));
    // First meeting with a boss or champion: a short scene before the fight (ROADMAP M5.7).
    const foe = node.type === 'boss' || node.type === 'duel' ? firstEnemyId(setup.encounter) : null;
    this.playScene(foe ? `${foe}_intro` : null, () => this.setMode('room'));
  }

  /**
   * Plays a story scene once per profile, then continues. Unknown or seen scenes continue
   * at once, so callers don't need to check.
   */
  private playScene(sceneId: string | null, then: () => void): void {
    const key = sceneId ? `scene:${sceneId}` : '';
    if (!sceneId || !sceneById(sceneId) || this.profile.seenDialogue.includes(key)) {
      then();
      return;
    }
    this.profile.seenDialogue.push(key);
    this.persistProfile();
    this.setMode('scene');
    this.ui.show({
      kind: 'scene',
      sceneId,
      onBlip: (speaker) =>
        this.audio.play('talk', { pitch: VOICE_PITCH[speaker] ?? 1, pitchVariation: 0.12 }),
      onDone: then,
    });
  }

  private roomResult() {
    return {
      hp: this.sim.c.hp[this.sim.playerEid] ?? 0,
      kills: this.sim.player.kills,
      timeSec: this.sim.room.elapsedTicks / TICK_RATE_HZ,
      shards: this.sim.shards,
      ultCharge: this.sim.player.ultCharge,
      lastSparks: this.sim.lastSparks,
      statusKills: this.sim.statusKills,
      flawless: this.roomDamage() === 0,
    };
  }

  /** Damage the player took in the current room (all sources). */
  private roomDamage(): number {
    let damage = 0;
    const tally = this.sim.damageBySource;
    for (let i = 0; i < tally.length; i++) damage += Math.max(0, tally[i] as number);
    return damage;
  }

  private finishRoom(): void {
    const run = this.run;
    if (!run) return;
    this.logRoom(true);
    completeRoom(run, this.roomResult());
    if (run.status === 'won') {
      // The first victory over a world's boss gets its closing words.
      const boss = worldById(run.worldId)?.bossName;
      this.playScene(boss ? `${boss}_outro` : null, () => {
        this.endRun('won', null);
        this.showResult();
      });
      return;
    }
    const node = run.map.nodes[run.currentNodeId];
    const reward = node ? nodeReward(run.seed, node) : null;
    if (node && reward?.kind === 'boon') {
      const offer = offerFor(run, node);
      if (offer) {
        this.showBoonChoice(offer, node);
        return;
      }
    } else if (node && reward?.kind === 'upgrade') {
      const options = rollUpgradeOffer(run, node.id);
      if (options.length > 0) {
        this.showUpgradeChoice(options);
        return;
      }
    } else if (node && reward?.kind === 'spell') {
      this.showSpellChoice(rollSpellOffer(run, node.id));
      return;
    } else if (node && reward?.kind === 'relic') {
      this.showRelicChoice(rollRelicOffer(run.seed, node.id, reward.rarityBonus, run.lockedRelics));
      return;
    } else if (reward?.kind === 'shards') {
      const amount = Math.round(reward.amount * (1 + runStats(run).shardGain));
      run.shards += amount;
      saveRun(this.store, run);
      this.showNotice(t('reward.shards_title'), t('reward.shards_desc', { n: amount }));
      return;
    }
    saveRun(this.store, run);
    this.showMap();
  }

  private showNotice(title: string, text: string): void {
    if (this.mode === 'room') this.loadSim(this.backdropSim());
    this.setMode('reward');
    this.ui.show({ kind: 'notice', title, text, onContinue: () => this.showMap() });
  }

  private showRelicChoice(options: string[]): void {
    const run = this.run;
    if (!run) return;
    if (this.mode === 'room') this.loadSim(this.backdropSim());
    this.setMode('reward');
    this.ui.show({
      kind: 'relic',
      options,
      owned: run.relics,
      onPick: (id) => {
        addRelic(run, id);
        saveRun(this.store, run);
        this.audio.play('boonPick', { pitch: 0.9, pitchVariation: 0 });
        this.showMap();
      },
    });
  }

  private showUpgradeChoice(options: UpgradeOption[]): void {
    const run = this.run;
    if (!run) return;
    if (this.mode === 'room') this.loadSim(this.backdropSim());
    this.setMode('reward');
    this.ui.show({
      kind: 'upgrade',
      run,
      options,
      onPick: (option) => {
        applyUpgrade(run, option);
        saveRun(this.store, run);
        this.audio.play('evolve', { pitch: 1.2, pitchVariation: 0, volume: 0.7 });
        this.showMap();
      },
    });
  }

  private showSpellChoice(options: string[]): void {
    const run = this.run;
    if (!run) return;
    if (this.mode === 'room') this.loadSim(this.backdropSim());
    this.setMode('reward');
    this.ui.show({
      kind: 'spell',
      options,
      current: run.spells,
      onPick: (id) => {
        equipRunSpell(run, id);
        saveRun(this.store, run);
        this.audio.play('boonPick', { pitch: 1.1, pitchVariation: 0 });
        this.showMap();
      },
      onSkip: () => {
        saveRun(this.store, run);
        this.showMap();
      },
    });
  }

  private showShop(): void {
    const run = this.run;
    const node = run?.map.nodes[run.currentNodeId];
    if (!run || !node) return;
    this.setMode('reward');
    const stock = shopStock(run, node);
    const render = () =>
      this.ui.show({
        kind: 'shop',
        run,
        stock,
        onBuy: (index) => {
          const item = stock[index];
          if (!item || run.shopBought.includes(index) || run.shards < item.price) return;
          run.shards -= item.price;
          run.shopBought.push(index);
          if (item.kind === 'relic') addRelic(run, item.id);
          else if (item.kind === 'boon') pickBoon(run, item.option);
          else if (item.kind === 'spell') equipRunSpell(run, item.id);
          else heal(run, run.maxHp * item.fraction);
          saveRun(this.store, run);
          this.audio.play('shard', { pitch: 0.8, pitchVariation: 0 });
          render();
        },
        onLeave: () => {
          completeNonCombat(run);
          saveRun(this.store, run);
          this.showMap();
        },
      });
    render();
  }

  private showEvent(): void {
    const run = this.run;
    const node = run?.map.nodes[run.currentNodeId];
    const event = run && node ? eventFor(run.seed, node.id) : undefined;
    if (!run || !node || !event) return;
    this.setMode('reward');
    const show = (results: string[] | null) =>
      this.ui.show({
        kind: 'event',
        run,
        event,
        results,
        onChoose: (optionId) => {
          const option = event.options.find((o) => o.id === optionId);
          if (!option) return;
          const lines = applyOutcomes(run, node.id, optionId, option.outcomes).map(describeOutcome);
          // An open quest's item turns up here (ROADMAP M5.6).
          const item = questItemToFind(this.profile, run);
          if (item) {
            run.tally.items.push(item);
            lines.push(
              t('quest.item_found', { name: t(`quest_item.${item}.name` as TranslationKey) }),
            );
          }
          completeNonCombat(run);
          saveRun(this.store, run);
          show(lines.length > 0 ? lines : [t('event.result.nothing')]);
        },
        onContinue: () => this.showMap(),
      });
    show(null);
  }

  private startArena(seed: number): void {
    this.run = null;
    this.view.hud.setQuestTracker(null);
    const sim = createSim(seed);
    equipSpells(sim, startSpellSlots());
    this.loadSim(sim);
    this.setMode('arena');
  }

  private showDeath(): void {
    const run = this.run;
    let stats: string;
    if (this.mode === 'room' && run) {
      this.logRoom(false);
      failRun(run, this.roomResult());
      this.endRun('lost', ENEMIES[this.sim.killedBy]?.id ?? null);
      stats = t('death.run_stats', { rooms: run.roomsCleared + 1, kills: run.kills });
    } else {
      stats = t('death.stats', { wave: this.sim.waves.wave, kills: this.sim.player.kills });
    }
    this.deathOverlay.show(stats, this.input.lastDevice, nowMs());
  }

  private afterDeath(): void {
    if (this.mode === 'arena') this.startArena(randomSeed());
    else this.showResult();
  }

  // ── Misc ────────────────────────────────────────────────────────────────

  private applySettings(): void {
    const s = this.settings;
    setLocale(s.language === 'auto' ? resolveLocale(preferredLanguages()) : s.language);
    document.documentElement.lang = getLocale();
    this.audio.setVolumes(s.masterVolume, s.sfxVolume, s.musicVolume);
    this.view.shake.intensity = s.shake;
    this.view.hud.flashIntensity = s.flashes;
    this.view.damageNumbers.enabled = s.damageNumbers;
    this.view.entities.statusIcons.enabled = s.statusIcons;
    this.view.effects.auraRingEnabled = s.auraRing;
    this.view.entities.look = s.simpleGraphics ? 'classic' : 'rig';
    this.view.setGlowQuality(s.quality);
    this.haptics.intensity = s.vibration;
    this.view.setTouchOpacity(s.touchOpacity);
    this.input.touch.setOverrides(s.touchLayout);
  }

  // ── Touch layout editor (GDD §10.1) ─────────────────────────────────────

  private editingLayout = false;

  private openLayoutEditor(): void {
    if (!this.paused) return;
    this.editingLayout = true;
    this.pauseOverlay.setVisible(false);
    this.showLayoutEditor();
  }

  private showLayoutEditor(): void {
    const s = this.settings;
    const layout = this.input.touch.layout;
    const profile = s.touchLayout[layout.orientation];
    const scales: Partial<Record<TouchButtonId, number>> = {};
    for (const [id, o] of Object.entries(profile)) if (o) scales[id as TouchButtonId] = o.scale;
    const save = () => {
      this.applySettings();
      saveSettings(this.store, s);
      this.showLayoutEditor();
    };
    const width = this.view.camera.viewWidth;
    const height = this.view.camera.viewHeight;
    this.ui.show({
      kind: 'layout',
      buttons: layout.buttons,
      scales,
      opacity: s.touchOpacity,
      onMove: (id, x, y) => {
        profile[id] = { x: x / width, y: y / height, scale: profile[id]?.scale ?? 1 };
        save();
      },
      onScale: (id, scale) => {
        const b = layout.buttons.find((btn) => btn.id === id);
        profile[id] = {
          x: profile[id]?.x ?? (b ? b.x / width : 0.5),
          y: profile[id]?.y ?? (b ? b.y / height : 0.5),
          scale,
        };
        save();
      },
      onOpacity: (opacity) => {
        s.touchOpacity = opacity;
        save();
      },
      onReset: () => {
        s.touchLayout[layout.orientation] = {};
        save();
      },
      onDone: () => this.closeLayoutEditor(),
    });
  }

  private closeLayoutEditor(): void {
    if (!this.editingLayout) return;
    this.editingLayout = false;
    this.ui.show({ kind: 'none' });
    if (this.paused) this.pauseOverlay.setVisible(true);
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
      setRigLook: (on) => {
        this.view.entities.look = on ? 'rig' : 'classic';
      },
      spawnEnemy: (code) => debugSpawnEnemy(sim(), code),
      gatherEnemies: () => debugGatherEnemies(sim(), DEBUG_GATHER_RADIUS_PX),
      applyStatus: (id, stacks) => {
        const parsed = statusIdSchema.safeParse(id);
        if (parsed.success) debugApplyStatus(sim(), parsed.data, stacks);
      },
      setGodMode: (on) => {
        sim().debug.godMode = on;
      },
      setTimeScale: (scale) => {
        this.debugTimeScale = scale;
      },
      renderMs: () => this.stats.renderMsAvg,
      screenOf: (x, y) => worldToScreen(this.view.camera, x, y, { x: 0, y: 0 }),
      giveMaterials: (each, dust) => this.giveMaterials(each, dust),
    };
  }

  private giveMaterials(each: number, dust: number): void {
    addMaterials(this.profile, Object.fromEntries(MATERIALS.map((m) => [m.id, each])));
    this.profile.dust += dust;
    this.persistProfile();
    if (this.ui.kind === 'hubWalk') this.showHubWalk();
  }

  private slowMo(req: SlowMoRequest): void {
    // The strongest request wins; overlapping requests don't multiply.
    if (this.slowMoSec <= 0 || req.scale < this.slowMoScale) this.slowMoScale = req.scale;
    this.slowMoSec = Math.max(this.slowMoSec, req.durationSec);
  }

  private setPaused(paused: boolean): void {
    if (paused === this.paused) return;
    // Pausing only makes sense while playing; menus are already "paused".
    const walking = this.mode === 'hub' && !this.hubMenu;
    if (paused && this.mode !== 'room' && this.mode !== 'arena' && !walking) return;
    if (!paused) this.closeLayoutEditor();
    this.paused = paused;
    // Releasing on both edges avoids "stuck" keys from presses made while the overlay was up.
    this.input.releaseAll();
    this.input.setGameplayEnabled(!paused);
    if (paused) {
      this.pauseOverlay.show(this.input.lastDevice, {
        boons: this.sim.boons,
        relics: this.sim.relics,
        evolutions: this.sim.evolutions,
        shards: this.sim.shards,
        spells: spellSlotsOf(this.sim),
        cast: this.sim.castUpgrade,
      });
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
      if (this.paused && !this.editingLayout) this.navigatePause(dir);
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
    if (actions & MenuAction.Back && this.editingLayout) this.closeLayoutEditor();
    else if (actions & MenuAction.Back && this.paused) this.setPaused(false);
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
    const walking = this.mode === 'hub' && !this.hubMenu;
    const playing = this.mode === 'room' || this.mode === 'arena' || walking;

    this.input.poll();
    this.handleMenuInput();
    if (this.input.consumeAppAction('debug')) this.debugMenu.toggle();
    if (this.input.consumeAppAction('pause') && playing && !this.deathOverlay.visible) {
      // Esc in the layout editor goes back to the pause menu, not straight into the fight.
      if (this.editingLayout) this.closeLayoutEditor();
      else this.setPaused(!this.paused);
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
      let station: StationId | null = null;
      for (let i = 0; i < ticks; i++) {
        this.input.sampleFrame(this.frame);
        if (walking) {
          // The refuge has no fighting: attack talks, the other combat buttons do nothing.
          if (hubInteractPressed(this.frame.pressed) && station === null) {
            station = REFUGE.stations[this.hubActive]?.id ?? null;
          }
          this.frame.pressed &= ~(COMBAT_BUTTONS | Button.Interact);
          this.frame.held &= ~(COMBAT_BUTTONS | Button.Interact);
        }
        if (this.deathOverlay.visible && (this.frame.pressed & RESTART_BUTTONS) !== 0) {
          this.deathOverlay.tryRestart();
        }
        stepSim(this.sim, this.frame);
      }
      simMs = nowMs() - simStart;
      drainEvents(this.sim, this.onEvents);
      if (walking) this.updateHubReach(station);
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
      this.mode === 'hub'
        ? {
            active: this.hubMenu ? -1 : this.hubActive,
            marks: this.hubMarks,
            locale: getLocale(),
            refuge: this.refugeLook,
          }
        : null,
    );
    const renderMs = nowMs() - renderStart;
    this.updateStats(realDtSec, simMs, renderMs, nowMs() - frameStart);
  };

  /** Finds the station in reach after the sim moved, refreshes the hint and opens a station. */
  private updateHubReach(interact: StationId | null): void {
    const eid = this.sim.playerEid;
    const active = nearestStation(
      REFUGE.stations,
      this.sim.c.posX[eid] as number,
      this.sim.c.posY[eid] as number,
    );
    if (active !== this.hubActive || this.input.lastDevice !== this.hubPromptDevice) {
      this.hubActive = active;
      this.hubPromptDevice = this.input.lastDevice;
      this.showHubWalk();
    }
    if (interact) this.openStation(interact);
  }

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
