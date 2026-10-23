import { C, RenderKind, Team } from '../ecs/components';
import { addComponents, destroyEntity } from '../ecs/world';
import { Ev, pushEvent } from '../events';
import { type SimState, spawnEntity } from '../sim';
import { secondsToTicks } from '../time';
import { damagePlayer } from './damage';

/** Places a delayed ground blast (mine, volatile elite). Its marker fills up until it blows. */
export function spawnHazard(
  state: SimState,
  x: number,
  y: number,
  radiusPx: number,
  damage: number,
  fuseSec: number,
  /** Enemy type that placed it, so a lethal blast can name its source. */
  sourceType: number,
): number {
  const r = radiusPx;
  const cx = Math.min(Math.max(x, r * 0.5), state.arenaWidthPx - r * 0.5);
  const cy = Math.min(Math.max(y, r * 0.5), state.arenaHeightPx - r * 0.5);
  const eid = spawnEntity(state, cx, cy);
  if (eid === -1) return -1;
  addComponents(state.world, eid, C.Transform | C.Hazard | C.Renderable);
  const c = state.c;
  c.radius[eid] = radiusPx;
  c.renderKind[eid] = RenderKind.Hazard;
  c.team[eid] = Team.Enemy;
  c.projDamage[eid] = damage;
  c.enemyType[eid] = sourceType;
  const fuse = Math.max(1, secondsToTicks(fuseSec));
  c.projLifeTicks[eid] = fuse;
  c.hazFuseTotal[eid] = fuse;
  const e = pushEvent(state.events, Ev.HazardPlaced, cx, cy);
  if (e) {
    e.eid = eid;
    e.amount = radiusPx;
  }
  return eid;
}

/** Counts fuses down and detonates; a dash through the blast dodges it like any attack. */
export function hazardSystem(state: SimState): void {
  const { world, c } = state;
  const peid = state.playerEid;
  const px = c.posX[peid] as number;
  const py = c.posY[peid] as number;
  const pr = c.radius[peid] as number;
  for (let eid = 0; eid < world.highWater; eid++) {
    if (((world.masks[eid] as number) & C.Hazard) === 0) continue;
    const left = (c.projLifeTicks[eid] as number) - 1;
    c.projLifeTicks[eid] = left;
    if (left > 0) continue;
    const x = c.posX[eid] as number;
    const y = c.posY[eid] as number;
    const r = c.radius[eid] as number;
    const e = pushEvent(state.events, Ev.HazardBlast, x, y);
    if (e) e.amount = r;
    const dx = px - x;
    const dy = py - y;
    const reach = r + pr;
    if (dx * dx + dy * dy <= reach * reach)
      damagePlayer(state, c.projDamage[eid] as number, x, y, c.enemyType[eid] as number);
    destroyEntity(world, eid);
  }
}

/** A cleared room is safe: pending blasts fizzle out. */
export function clearHazards(state: SimState): void {
  const { world } = state;
  for (let eid = 0; eid < world.highWater; eid++) {
    if (((world.masks[eid] as number) & C.Hazard) !== 0) destroyEntity(world, eid);
  }
}
