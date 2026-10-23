import { Container, Sprite, type Texture } from 'pixi.js';
import { BAKE_RADIUS_PX, GLOW_TEXTURE_PX } from '../textures';
import { createPose, POSE_STRIDE, poseRig, type RigInput } from './animate';
import type { BakedRig } from './bake-rig';

/**
 * One entity's rigged body: a container with one pre-made sprite per part (in draw order)
 * plus a ground shadow. Created once per entity slot and rig, then only transformed.
 */
export class RigInstance {
  readonly root = new Container();
  readonly shadow: Sprite;
  /** Soft halo behind the figure, inside the root so it mirrors and scales with it. */
  private readonly glow: Sprite;
  /** Sprites indexed like the rig's parts. */
  private readonly sprites: Sprite[] = [];
  private readonly pose: Float32Array;
  private flashing = false;

  constructor(
    readonly baked: BakedRig,
    bodyLayer: Container,
    groundLayer: Container,
    shadowTexture: Texture,
    glowTexture: Texture,
  ) {
    const def = baked.layout.rig;
    this.glow = new Sprite(glowTexture);
    this.glow.anchor.set(0.5);
    this.glow.tint = def.colors.body;
    this.glow.alpha = def.glowAlpha;
    this.glow.position.set(0, -def.centerUnits * BAKE_RADIUS_PX);
    const glowPx = (def.heightUnits + def.centerUnits) * BAKE_RADIUS_PX * 2.2;
    this.glow.scale.set((glowPx * 0.8) / GLOW_TEXTURE_PX, glowPx / GLOW_TEXTURE_PX);
    this.root.addChild(this.glow);
    const parts = baked.parts;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (!p) continue;
      const sprite = new Sprite(p.normal);
      sprite.anchor.set(p.anchorX, p.anchorY);
      this.sprites[i] = sprite;
    }
    for (const i of baked.layout.drawOrder) {
      const sprite = this.sprites[i];
      if (sprite) this.root.addChild(sprite);
    }
    this.pose = createPose(baked.layout.rig);
    this.shadow = new Sprite(shadowTexture);
    this.shadow.anchor.set(0.5);
    this.root.visible = false;
    this.shadow.visible = false;
    bodyLayer.addChild(this.root);
    groundLayer.addChild(this.shadow);
  }

  set visible(on: boolean) {
    this.root.visible = on;
    this.shadow.visible = on;
  }

  get visible(): boolean {
    return this.root.visible;
  }

  /** Current world pose of part `i` in rig units (valid after `update`). */
  partPose(i: number, out: { x: number; y: number; rotation: number }): void {
    const o = i * POSE_STRIDE;
    out.x = this.pose[o] as number;
    out.y = this.pose[o + 1] as number;
    out.rotation = this.pose[o + 2] as number;
  }

  /**
   * `unitPx` is the entity radius (1 rig unit), `facing` ±1 mirrors the side view, `sx`/`sy`
   * add the hit squash and spawn pop.
   */
  update(
    input: RigInput,
    x: number,
    y: number,
    unitPx: number,
    facing: number,
    sx: number,
    sy: number,
    flash: boolean,
  ): void {
    poseRig(this.baked.layout, input, this.pose);
    const parts = this.baked.parts;
    if (flash !== this.flashing) {
      this.flashing = flash;
      for (let i = 0; i < parts.length; i++) {
        const sprite = this.sprites[i];
        const p = parts[i];
        if (sprite && p) sprite.texture = flash ? p.flash : p.normal;
      }
    }
    for (let i = 0; i < parts.length; i++) {
      const sprite = this.sprites[i];
      if (!sprite) continue;
      const o = i * POSE_STRIDE;
      sprite.position.set(
        (this.pose[o] as number) * BAKE_RADIUS_PX,
        (this.pose[o + 1] as number) * BAKE_RADIUS_PX,
      );
      sprite.rotation = this.pose[o + 2] as number;
      sprite.scale.set(this.pose[o + 3] as number);
    }
    const scale = unitPx / BAKE_RADIUS_PX;
    this.root.position.set(x, y);
    this.root.scale.set(scale * facing * sx, scale * sy);
    const rig = this.baked.layout.rig;
    const shadowScale = (unitPx * rig.shadowUnits) / BAKE_RADIUS_PX;
    // Feet sit a little below the ground point; the shadow shrinks while the body bobs up.
    this.shadow.position.set(x, y + unitPx * 0.7);
    this.shadow.scale.set(shadowScale * sx, shadowScale * 0.32);
  }
}
