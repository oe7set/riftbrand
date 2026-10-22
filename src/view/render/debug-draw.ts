import { Graphics } from 'pixi.js';
import { C } from '../../sim/ecs/components';
import type { SimState } from '../../sim/sim';
import { PALETTE } from './palette';

/** Collider overlay; debug only, so redrawing a Graphics each frame is acceptable here. */
export class DebugDraw {
  readonly graphics = new Graphics();
  enabled = false;

  sync(sim: SimState, alpha: number): void {
    const g = this.graphics;
    g.clear();
    g.visible = this.enabled;
    if (!this.enabled) return;
    const { world, c } = sim;
    const mask = C.Transform | C.Collider;
    for (let eid = 0; eid < world.highWater; eid++) {
      if (((world.masks[eid] as number) & mask) !== mask) continue;
      const px = c.prevX[eid] as number;
      const py = c.prevY[eid] as number;
      const x = px + ((c.posX[eid] as number) - px) * alpha;
      const y = py + ((c.posY[eid] as number) - py) * alpha;
      g.circle(x, y, c.radius[eid] as number);
    }
    g.stroke({ color: PALETTE.debugCollider, width: 1.5, alpha: 0.9 });
  }
}
