import { autoDetectRenderer, Container, type Renderer } from 'pixi.js';
import { TUNING } from '../content/tuning';
import type { InputDevice } from '../platform/input/input-manager';
import type { TouchInput } from '../platform/input/touch';
import type { Vec2 } from '../shared/math/vec2';
import type { SimState } from '../sim/sim';
import { TouchControlsView } from './hud/touch-controls-view';
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
import { bakeTextures } from './render/textures';

/** Upper bound for the backing-store resolution; quality tiers will lower it (TECH_DESIGN §8). */
const MAX_RESOLUTION = 2;

export interface ViewSize {
  width: number;
  height: number;
  devicePixelRatio: number;
}

/** Renders sim state; never mutates it. */
export class GameView {
  readonly camera: Camera = createCamera();
  readonly debugDraw = new DebugDraw();
  private readonly stage = new Container();
  private readonly worldLayer = new Container();
  private readonly hudLayer = new Container();
  private readonly arena = new ArenaView();
  private readonly entities: EntityView;
  private readonly touchControls = new TouchControlsView();
  private hasSnapped = false;

  private constructor(readonly renderer: Renderer) {
    this.entities = new EntityView(bakeTextures(renderer));
    this.worldLayer.addChild(this.arena.root, this.entities.root, this.debugDraw.graphics);
    this.hudLayer.addChild(this.touchControls.root);
    this.stage.addChild(this.worldLayer, this.hudLayer);
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

  resize(size: ViewSize): void {
    this.renderer.resize(size.width, size.height, Math.min(size.devicePixelRatio, MAX_RESOLUTION));
    this.camera.viewWidth = size.width;
    this.camera.viewHeight = size.height;
  }

  playerScreenPosition(sim: SimState, out: Vec2): Vec2 {
    const eid = sim.playerEid;
    return worldToScreen(this.camera, sim.c.posX[eid] ?? 0, sim.c.posY[eid] ?? 0, out);
  }

  render(
    sim: SimState,
    alpha: number,
    frameDtSec: number,
    touch: TouchInput,
    device: InputDevice,
  ): void {
    const cam = this.camera;
    cam.zoom = computeZoom(
      cam.viewWidth,
      cam.viewHeight,
      TUNING.viewAreaWidthPx,
      TUNING.viewAreaHeightPx,
    );

    const eid = sim.playerEid;
    const c = sim.c;
    const px = (c.prevX[eid] ?? 0) + ((c.posX[eid] ?? 0) - (c.prevX[eid] ?? 0)) * alpha;
    const py = (c.prevY[eid] ?? 0) + ((c.posY[eid] ?? 0) - (c.prevY[eid] ?? 0)) * alpha;
    const vx = c.velX[eid] ?? 0;
    const vy = c.velY[eid] ?? 0;
    const speed = Math.sqrt(vx * vx + vy * vy);
    // Look-ahead scales with speed so standing still re-centres the player.
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
      dtSec: frameDtSec,
      arenaWidth: sim.arenaWidthPx,
      arenaHeight: sim.arenaHeightPx,
    });

    this.worldLayer.scale.set(cam.zoom);
    this.worldLayer.position.set(
      cam.viewWidth / 2 - cam.x * cam.zoom,
      cam.viewHeight / 2 - cam.y * cam.zoom,
    );

    this.arena.sync(sim.arenaWidthPx, sim.arenaHeightPx);
    this.entities.sync(sim, alpha);
    this.debugDraw.sync(sim, alpha);
    this.touchControls.sync(touch, device === 'touch');
    this.renderer.render(this.stage);
  }

  /** Resets the camera snap, e.g. after restarting with a new seed. */
  resetCamera(): void {
    this.hasSnapped = false;
  }
}
