import { damagePlayer } from '../combat/damage';
import { C, Team } from '../ecs/components';
import { destroyEntity } from '../ecs/world';
import { Ev, pushEvent } from '../events';
import type { SimState } from '../sim';

function expire(state: SimState, eid: number): void {
  const c = state.c;
  const e = pushEvent(
    state.events,
    Ev.ProjectileExpired,
    c.posX[eid] as number,
    c.posY[eid] as number,
  );
  if (e) e.eid = eid;
  destroyEntity(state.world, eid);
}

/** Lifetime, wall impacts and hits on the player. Runs after movement. */
export function projectileSystem(state: SimState): void {
  const { world, c } = state;
  const masks = world.masks;
  const peid = state.playerEid;
  const px = c.posX[peid] as number;
  const py = c.posY[peid] as number;
  const pr = c.radius[peid] as number;
  for (let eid = 0; eid < world.highWater; eid++) {
    if (((masks[eid] as number) & C.Projectile) === 0) continue;
    const life = (c.projLifeTicks[eid] as number) - 1;
    c.projLifeTicks[eid] = life;
    const x = c.posX[eid] as number;
    const y = c.posY[eid] as number;
    const r = c.radius[eid] as number;
    const atWall = x <= r || y <= r || x >= state.arenaWidthPx - r || y >= state.arenaHeightPx - r;
    if (life <= 0 || atWall) {
      expire(state, eid);
      continue;
    }
    if (c.team[eid] !== Team.Enemy) continue;
    const dx = px - x;
    const dy = py - y;
    const reach = r + pr;
    if (dx * dx + dy * dy > reach * reach) continue;
    // Dodged or invulnerable shots fly on; only a real hit consumes the projectile.
    if (damagePlayer(state, c.projDamage[eid] as number, x, y) === 'hit') expire(state, eid);
  }
}
