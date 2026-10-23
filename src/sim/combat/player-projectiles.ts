import type { ProjectileKind, StatusId } from '../../content/schema';
import { statusIndex } from '../../content/statuses';
import { C, RenderKind, Team } from '../ecs/components';
import { addComponents } from '../ecs/world';
import { Ev, ProjectileCode, pushEvent } from '../events';
import { type SimState, spawnEntity } from '../sim';
import { TICK_RATE_HZ } from '../time';

/** Everything needed to launch a player projectile; reused by callers to avoid allocations. */
export interface PlayerShotSpec {
  kind: ProjectileKind;
  damage: number;
  speedPxPerSec: number;
  radiusPx: number;
  rangePx: number;
  knockback: number;
  poiseDamage: number;
  pierce: boolean;
  status: StatusId | null;
  stacks: number;
  /** Cast shots trigger onHit cast boons; effect shots (firebird) never trigger onHit. */
  isCast: boolean;
}

export function projectileCode(kind: ProjectileKind): number {
  return kind === 'firebird' ? ProjectileCode.Firebird : ProjectileCode.RiftShot;
}

/** Spawns a player projectile just in front of the player, flying along (dirX, dirY). */
export function spawnPlayerShot(
  state: SimState,
  spec: PlayerShotSpec,
  dirX: number,
  dirY: number,
): number {
  const c = state.c;
  const p = state.playerEid;
  const offset = (c.radius[p] as number) + spec.radiusPx * 0.5;
  const x = (c.posX[p] as number) + dirX * offset;
  const y = (c.posY[p] as number) + dirY * offset;
  const eid = spawnEntity(state, x, y);
  if (eid === -1) return -1;
  addComponents(state.world, eid, C.Transform | C.Velocity | C.Projectile | C.Renderable);
  c.radius[eid] = spec.radiusPx;
  c.renderKind[eid] = spec.kind === 'firebird' ? RenderKind.Firebird : RenderKind.RiftShot;
  c.team[eid] = Team.Player;
  c.velX[eid] = dirX * spec.speedPxPerSec;
  c.velY[eid] = dirY * spec.speedPxPerSec;
  c.facingX[eid] = dirX;
  c.facingY[eid] = dirY;
  c.projDamage[eid] = spec.damage;
  c.projLifeTicks[eid] = Math.max(
    1,
    Math.round((spec.rangePx / spec.speedPxPerSec) * TICK_RATE_HZ),
  );
  c.projKnockback[eid] = spec.knockback;
  c.projPoise[eid] = spec.poiseDamage;
  c.projPierce[eid] = spec.pierce ? 1 : 0;
  c.projStatus[eid] = spec.status === null ? 0 : statusIndex(spec.status) + 1;
  c.projStacks[eid] = spec.stacks;
  c.projIsCast[eid] = spec.isCast ? 1 : 0;
  c.projSwing[eid] = ++state.swingCounter;
  const e = pushEvent(state.events, Ev.Shot, x, y);
  if (e) {
    e.eid = eid;
    e.dirX = dirX;
    e.dirY = dirY;
    e.value = projectileCode(spec.kind);
  }
  return eid;
}
