import { Container, Sprite, type Texture } from 'pixi.js';
import { C, RenderKind } from '../../sim/ecs/components';
import type { SimState } from '../../sim/sim';
import { BAKE_RADIUS_PX, type BakedTextures } from './textures';

/**
 * One pooled sprite per entity slot. Sprites are created lazily the first time a slot is used
 * and then reused, so steady-state rendering allocates nothing.
 */
export class EntityView {
  readonly root = new Container();
  private readonly sprites: Array<Sprite | undefined> = [];
  private readonly textureByKind: Array<Texture | undefined>;

  constructor(textures: BakedTextures) {
    this.textureByKind = [];
    this.textureByKind[RenderKind.Player] = textures.player;
    this.textureByKind[RenderKind.Drifter] = textures.drifter;
  }

  /** `alpha` interpolates between the previous and the current tick (0..1). */
  sync(sim: SimState, alpha: number): void {
    const { world, c } = sim;
    const masks = world.masks;
    const sprites = this.sprites;
    const renderMask = C.Transform | C.Renderable;
    for (let eid = 0; eid < world.highWater; eid++) {
      let sprite = sprites[eid];
      const texture = this.textureByKind[c.renderKind[eid] as number];
      if (((masks[eid] as number) & renderMask) !== renderMask || !texture) {
        if (sprite) sprite.visible = false;
        continue;
      }
      if (!sprite) {
        sprite = new Sprite(texture);
        sprite.anchor.set(0.5);
        sprites[eid] = sprite;
        this.root.addChild(sprite);
      }
      sprite.texture = texture;
      sprite.visible = true;
      const px = c.prevX[eid] as number;
      const py = c.prevY[eid] as number;
      sprite.x = px + ((c.posX[eid] as number) - px) * alpha;
      sprite.y = py + ((c.posY[eid] as number) - py) * alpha;
      sprite.scale.set((c.radius[eid] as number) / BAKE_RADIUS_PX);
      sprite.rotation = Math.atan2(c.facingY[eid] as number, c.facingX[eid] as number);
    }
    for (let i = world.highWater; i < sprites.length; i++) {
      const sprite = sprites[i];
      if (sprite) sprite.visible = false;
    }
  }
}
