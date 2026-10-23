import type { StatusIndex } from '../../content/statuses';
import { queryRect } from '../collision/spatial-hash';
import { damageEnemy, damagePlayer, type PlayerHitSpec, rollCrit } from '../combat/damage';
import { C, RenderKind, Team, wasHitBy } from '../ecs/components';
import { destroyEntity } from '../ecs/world';
import { applyStatus } from '../effects/status';
import { Ev, ProjectileCode, pushEvent } from '../events';
import { overlapsObstacle } from '../room';
import type { SimState } from '../sim';

/** Largest enemy radius we expect, so the broadphase query never misses a big body. */
const MAX_ENEMY_RADIUS_PX = 40;

const shotHit: PlayerHitSpec = {
  damage: 0,
  knockback: 0,
  poiseDamage: 0,
  hitstop: 'light',
  dirX: 0,
  dirY: 0,
  crit: false,
  swingId: 0,
  source: 'cast',
};

function expire(state: SimState, eid: number): void {
  const c = state.c;
  const e = pushEvent(
    state.events,
    Ev.ProjectileExpired,
    c.posX[eid] as number,
    c.posY[eid] as number,
  );
  if (e) {
    e.eid = eid;
    const kind = c.renderKind[eid];
    e.value =
      kind === RenderKind.Firebird
        ? ProjectileCode.Firebird
        : kind === RenderKind.RiftShot
          ? ProjectileCode.RiftShot
          : 0;
  }
  destroyEntity(state.world, eid);
}

/** Player shots: hit enemies along the way; non-piercing shots stop at the first. */
function playerShot(state: SimState, eid: number, x: number, y: number, r: number): boolean {
  const c = state.c;
  const reach = r + MAX_ENEMY_RADIUS_PX;
  const n = queryRect(state.spatial, x - reach, y - reach, x + reach, y + reach, state.queryBuffer);
  const swing = c.projSwing[eid] as number;
  const speed = Math.sqrt((c.velX[eid] as number) ** 2 + (c.velY[eid] as number) ** 2) || 1;
  for (let i = 0; i < n; i++) {
    const t = state.queryBuffer[i] as number;
    if (((state.world.masks[t] as number) & C.Enemy) === 0) continue;
    if (wasHitBy(c, t, swing)) continue;
    const dx = (c.posX[t] as number) - x;
    const dy = (c.posY[t] as number) - y;
    const hitR = r + (c.radius[t] as number);
    if (dx * dx + dy * dy > hitR * hitR) continue;
    const status = c.projStatus[eid] as number;
    // Status first, so the hit itself already profits from it (e.g. freeze bonus).
    if (status > 0) applyStatus(state, t, (status - 1) as StatusIndex, c.projStacks[eid] as number);
    if (((state.world.masks[t] as number) & C.Enemy) === 0) continue;
    const isCast = c.projIsCast[eid] === 1;
    shotHit.damage = c.projDamage[eid] as number;
    shotHit.knockback = c.projKnockback[eid] as number;
    shotHit.poiseDamage = c.projPoise[eid] as number;
    shotHit.dirX = (c.velX[eid] as number) / speed;
    shotHit.dirY = (c.velY[eid] as number) / speed;
    shotHit.crit = rollCrit(state, false);
    shotHit.swingId = swing;
    shotHit.source = isCast ? 'cast' : 'effect';
    damageEnemy(state, t, shotHit);
    if (c.projPierce[eid] === 0) return true;
  }
  return false;
}

/** Lifetime, wall impacts and hits on the player or enemies. Runs after movement. */
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
    const atWall =
      x <= r ||
      y <= r ||
      x >= state.arenaWidthPx - r ||
      y >= state.arenaHeightPx - r ||
      overlapsObstacle(state.room, x, y, r * 0.5);
    if (life <= 0 || atWall) {
      expire(state, eid);
      continue;
    }
    if (c.team[eid] === Team.Player) {
      if (playerShot(state, eid, x, y, r)) expire(state, eid);
      continue;
    }
    if (c.team[eid] !== Team.Enemy) continue;
    const dx = px - x;
    const dy = py - y;
    const reach = r + pr;
    if (dx * dx + dy * dy > reach * reach) continue;
    // Dodged or invulnerable shots fly on; only a real hit consumes the projectile.
    const result = damagePlayer(
      state,
      c.projDamage[eid] as number,
      x,
      y,
      c.enemyType[eid] as number,
    );
    if (result === 'hit') expire(state, eid);
  }
}
