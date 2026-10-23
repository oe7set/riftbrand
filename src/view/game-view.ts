import { autoDetectRenderer, Container, type Renderer } from 'pixi.js';
import { AdvancedBloomFilter } from 'pixi-filters';
import { RIFT_SHOT } from '../content/abilities';
import { RIGS } from '../content/rigs';
import { SPELLS, spellRadiusPx, spellReachPx } from '../content/spells';
import { TUNING } from '../content/tuning';
import type { InputDevice } from '../platform/input/input-manager';
import type { TouchInput } from '../platform/input/touch';
import type { Vec2 } from '../shared/math/vec2';
import type { SimState } from '../sim/sim';
import { HudView } from './hud/hud-view';
import { TouchControlsView } from './hud/touch-controls-view';
import { AimPreview } from './render/aim-preview';
import { ArenaView } from './render/arena-view';
import {
  type Camera,
  computeZoom,
  createCamera,
  snapCamera,
  updateCamera,
  worldToScreen,
} from './render/camera';
import { DebugDraw } from './render/debug-draw';
import { EntityView } from './render/entity-view';
import { PALETTE } from './render/palette';
import { bakeRig } from './render/rig/bake-rig';
import { RoomView } from './render/room-view';
import { type BakedTextures, bakeTextures } from './render/textures';
import { DamageNumbers } from './vfx/damage-numbers';
import { Effects } from './vfx/effects';
import { ParticleSystem } from './vfx/particles';
import { ScreenShake } from './vfx/shake';

/** Upper bound for the backing-store resolution; quality tiers lower it (TECH_DESIGN §8). */
const MAX_RESOLUTION = 2;
const PARTICLE_CAPACITY = 2000;
const ZOOM_PUNCH_DECAY_PER_SEC = 6;

export type GlowQuality = 'high' | 'low';

export interface ViewSize {
  width: number;
  height: number;
  devicePixelRatio: number;
}

/** Renders sim state; never mutates it. */
export class GameView {
  readonly camera: Camera = createCamera();
  readonly debugDraw = new DebugDraw();
  readonly shake = new ScreenShake();
  readonly entities: EntityView;
  readonly effects: Effects;
  readonly damageNumbers = new DamageNumbers();
  readonly hud: HudView;
  readonly textures: BakedTextures;
  private readonly stage = new Container();
  /** World plus effects; the bloom filter applies here, sized to the screen. */
  private readonly postFx = new Container();
  private readonly worldLayer = new Container();
  private readonly hudLayer = new Container();
  private readonly arena = new ArenaView();
  private readonly roomView: RoomView;
  private readonly exitScreen = { x: 0, y: 0 };
  private readonly fxParticles = new ParticleSystem(PARTICLE_CAPACITY);
  private readonly groundParticles = new ParticleSystem(PARTICLE_CAPACITY / 2);
  private readonly touchControls = new TouchControlsView();
  private readonly aimPreview: AimPreview;
  private readonly bloom = new AdvancedBloomFilter({
    threshold: 0.35,
    bloomScale: 0.9,
    brightness: 1,
    blur: 6,
    quality: 4,
  });
  private zoomPunch = 0;
  private hasSnapped = false;

  private constructor(readonly renderer: Renderer) {
    this.textures = bakeTextures(renderer);
    this.effects = new Effects(this.fxParticles, this.groundParticles, this.textures);
    this.entities = new EntityView(
      this.textures,
      RIGS.map((rig) => bakeRig(renderer, rig)),
      this.effects,
    );
    this.roomView = new RoomView(this.textures);
    this.hud = new HudView(
      this.textures.white,
      this.textures.vignette,
      this.textures.spark,
      this.textures.statusIcons,
      this.textures.spellIcons,
    );
    this.aimPreview = new AimPreview(this.textures.white, this.textures.ring);
    this.fxParticles.root.blendMode = 'add';
    this.groundParticles.root.blendMode = 'add';
    this.worldLayer.addChild(
      this.arena.root,
      this.roomView.root,
      this.groundParticles.root,
      this.entities.groundLayer,
      this.aimPreview.root,
      this.entities.bodyLayer,
      this.fxParticles.root,
      this.entities.overlayLayer,
      this.entities.statusIcons.root,
      this.damageNumbers.root,
      this.debugDraw.graphics,
    );
    this.postFx.addChild(this.worldLayer);
    this.hudLayer.addChild(this.hud.root, this.touchControls.root);
    this.stage.addChild(this.postFx, this.hudLayer);
    this.setGlowQuality('high');
  }

  static async create(size: ViewSize): Promise<GameView> {
    const renderer = await autoDetectRenderer({
      preference: 'webgl',
      width: size.width,
      height: size.height,
      resolution: Math.min(size.devicePixelRatio, MAX_RESOLUTION),
      autoDensity: true,
      antialias: true,
      backgroundColor: PALETTE.background,
      powerPreference: 'high-performance',
    });
    const view = new GameView(renderer);
    view.resize(size);
    return view;
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.canvas as HTMLCanvasElement;
  }

  get particleCount(): number {
    return this.fxParticles.active + this.groundParticles.active;
  }

  /** "high" adds a real bloom pass; "low" relies on the baked glow halos only. */
  setGlowQuality(quality: GlowQuality): void {
    this.postFx.filters = quality === 'high' ? [this.bloom] : [];
    const budget = quality === 'high' ? PARTICLE_CAPACITY : PARTICLE_CAPACITY / 2;
    this.fxParticles.budget = budget;
    this.groundParticles.budget = budget / 2;
  }

  resize(size: ViewSize): void {
    this.renderer.resize(size.width, size.height, Math.min(size.devicePixelRatio, MAX_RESOLUTION));
    this.camera.viewWidth = size.width;
    this.camera.viewHeight = size.height;
    this.postFx.filterArea = this.renderer.screen;
    this.hud.resize(size.width, size.height);
  }

  /** Idle opacity of the on-screen touch buttons (layout editor setting). */
  setTouchOpacity(alpha: number): void {
    this.touchControls.idleAlpha = alpha;
  }

  addZoomPunch(amount: number): void {
    this.zoomPunch = Math.max(this.zoomPunch, amount);
  }

  playerScreenPosition(sim: SimState, out: Vec2): Vec2 {
    const eid = sim.playerEid;
    return worldToScreen(this.camera, sim.c.posX[eid] ?? 0, sim.c.posY[eid] ?? 0, out);
  }

  /** Clears transient effects, e.g. on restart. */
  resetEffects(): void {
    this.fxParticles.clear();
    this.groundParticles.clear();
    this.damageNumbers.clear();
    this.shake.trauma = 0;
    this.zoomPunch = 0;
    this.hasSnapped = false;
  }

  render(
    sim: SimState,
    alpha: number,
    simDtSec: number,
    realDtSec: number,
    touch: TouchInput,
    device: InputDevice,
    hudVisible = true,
  ): void {
    const cam = this.camera;
    this.hudLayer.visible = hudVisible;
    this.zoomPunch = Math.max(
      0,
      this.zoomPunch - this.zoomPunch * ZOOM_PUNCH_DECAY_PER_SEC * realDtSec,
    );
    cam.zoom =
      computeZoom(cam.viewWidth, cam.viewHeight, TUNING.viewAreaWidthPx, TUNING.viewAreaHeightPx) *
      (1 + this.zoomPunch);

    const eid = sim.playerEid;
    const c = sim.c;
    const px = (c.prevX[eid] ?? 0) + ((c.posX[eid] ?? 0) - (c.prevX[eid] ?? 0)) * alpha;
    const py = (c.prevY[eid] ?? 0) + ((c.posY[eid] ?? 0) - (c.prevY[eid] ?? 0)) * alpha;
    const vx = c.velX[eid] ?? 0;
    const vy = c.velY[eid] ?? 0;
    const speed = Math.sqrt(vx * vx + vy * vy);
    // Look-ahead scales with walking speed so standing still re-centres the player.
    const lookScale = Math.min(1, speed / TUNING.playerSpeedPxPerSec);
    if (!this.hasSnapped) {
      snapCamera(cam, px, py);
      this.hasSnapped = true;
    }
    updateCamera(cam, {
      targetX: px,
      targetY: py,
      lookX: speed > 0 ? (vx / speed) * lookScale : 0,
      lookY: speed > 0 ? (vy / speed) * lookScale : 0,
      lookaheadPx: TUNING.cameraLookaheadPx,
      sharpness: TUNING.cameraFollowSharpness,
      dtSec: simDtSec,
      arenaWidth: sim.arenaWidthPx,
      arenaHeight: sim.arenaHeightPx,
    });

    // Shake runs on real time so it keeps going through hitstop and slow motion.
    this.shake.update(
      realDtSec,
      TUNING.shakeMaxOffsetPx,
      (TUNING.shakeMaxRotationDeg * Math.PI) / 180,
      TUNING.shakeDecayPerSec,
    );
    this.worldLayer.scale.set(cam.zoom);
    this.worldLayer.rotation = this.shake.rotation;
    // Pivot at the camera target so shake rotation turns around the screen centre.
    this.worldLayer.pivot.set(cam.x, cam.y);
    this.worldLayer.position.set(
      cam.viewWidth / 2 + this.shake.offsetX,
      cam.viewHeight / 2 + this.shake.offsetY,
    );

    this.arena.sync(sim.arenaWidthPx, sim.arenaHeightPx);
    this.roomView.sync(sim.room, realDtSec);
    this.entities.sync(sim, alpha, realDtSec, simDtSec);
    this.fxParticles.update(realDtSec);
    this.groundParticles.update(realDtSec);
    this.damageNumbers.update(realDtSec);
    this.debugDraw.sync(sim, alpha);
    // Spells that land on the player need no aim; the preview shows reach and landing area.
    const spell = touch.castAimingSpell ? SPELLS[sim.player.activeSpell] : undefined;
    const spellReach = spell ? spellReachPx(spell) : 0;
    const ready = touch.castAimingSpell
      ? spellReach > 0 && sim.player.spellCooldownTicks === 0
      : sim.player.castCharges > 0;
    this.aimPreview.sync(
      device === 'touch' && touch.castAiming && touch.castAimed && ready,
      px,
      py,
      touch.castAim.x,
      touch.castAim.y,
      spell ? spellReach : RIFT_SHOT.rangePx,
      spell && spell.effect.type !== 'beam' ? spellRadiusPx(spell) : RIFT_SHOT.radiusPx * 2.2,
      spell?.visual.color ?? PALETTE.riftShot,
      realDtSec,
    );
    worldToScreen(cam, sim.room.exitX, sim.room.exitY, this.exitScreen);
    this.hud.sync(sim, realDtSec, this.exitScreen);
    this.touchControls.sync(touch, device === 'touch', sim.player, realDtSec);
    this.renderer.render(this.stage);
  }
}
