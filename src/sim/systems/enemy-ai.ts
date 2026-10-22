import { ENEMIES } from '../../content/enemies';
import type { EnemyDef } from '../../content/schema';
import { damagePlayer, releaseToken } from '../combat/damage';
import { AiState, C, RenderKind, Team, Token } from '../ecs/components';
import { addComponents } from '../ecs/world';
import { chillSpeedFactor } from '../effects/status';
import { Ev, pushEvent } from '../events';
import { nextFloat, nextRange } from '../rng/rng';
import { MAX_MELEE_TOKENS, MAX_RANGED_TOKENS, type SimState, spawnEntity } from '../sim';
import { secondsToTicks, TICK_DT_SEC } from '../time';

const DEG = Math.PI / 180;
const STRAFE_SPEED_FACTOR = 0.5;
/** Chance per tick that a strafing enemy switches direction (~once every 2 s). */
const STRAFE_FLIP_CHANCE = 0.008;
const LUNGE_CONTACT_SLACK_PX = 4;

/** Attack tokens (GDD §4.6): only a few enemies may attack at once. */
function tryAcquireToken(state: SimState, eid: number, def: EnemyDef): boolean {
  if (def.token === 'melee') {
    if (state.meleeTokensInUse >= MAX_MELEE_TOKENS) return false;
    state.meleeTokensInUse++;
    state.c.token[eid] = Token.Melee;
  } else {
    if (state.rangedTokensInUse >= MAX_RANGED_TOKENS) return false;
    state.rangedTokensInUse++;
    state.c.token[eid] = Token.Ranged;
  }
  return true;
}

function emit(state: SimState, type: (typeof Ev)[keyof typeof Ev], eid: number): void {
  const c = state.c;
  const e = pushEvent(state.events, type, c.posX[eid] as number, c.posY[eid] as number);
  if (!e) return;
  e.eid = eid;
  e.value = c.enemyType[eid] as number;
  e.dirX = c.aiDirX[eid] as number;
  e.dirY = c.aiDirY[eid] as number;
}

function fireVolley(state: SimState, eid: number, def: EnemyDef): void {
  const atk = def.attack;
  if (atk.kind !== 'volley') return;
  const c = state.c;
  const baseAngle = Math.atan2(c.aiDirY[eid] as number, c.aiDirX[eid] as number);
  const count = atk.projectileCount;
  for (let i = 0; i < count; i++) {
    const offset = count === 1 ? 0 : (i / (count - 1) - 0.5) * 2 * atk.spreadDeg * DEG;
    const angle = baseAngle + offset;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const r = c.radius[eid] as number;
    const p = spawnEntity(
      state,
      (c.posX[eid] as number) + dx * r,
      (c.posY[eid] as number) + dy * r,
    );
    if (p === -1) return;
    addComponents(
      state.world,
      p,
      C.Transform | C.Velocity | C.Collider | C.Projectile | C.Renderable,
    );
    c.radius[p] = atk.projectileRadiusPx;
    c.renderKind[p] = RenderKind.EnemyProjectile;
    c.team[p] = Team.Enemy;
    c.velX[p] = dx * atk.projectileSpeedPxPerSec;
    c.velY[p] = dy * atk.projectileSpeedPxPerSec;
    c.facingX[p] = dx;
    c.facingY[p] = dy;
    c.projDamage[p] = atk.damage;
    c.projLifeTicks[p] = secondsToTicks(atk.projectileLifeSec);
  }
}

export function enemyAiSystem(state: SimState): void {
  const { world, c } = state;
  const masks = world.masks;
  const peid = state.playerEid;
  const px = c.posX[peid] as number;
  const py = c.posY[peid] as number;
  const pr = c.radius[peid] as number;
  const rng = state.rng.ai;

  for (let eid = 0; eid < world.highWater; eid++) {
    if (((masks[eid] as number) & C.Enemy) === 0) continue;
    const def = ENEMIES[c.enemyType[eid] as number];
    if (!def) continue;
    const atk = def.attack;
    const ex = c.posX[eid] as number;
    const ey = c.posY[eid] as number;
    let ux = px - ex;
    let uy = py - ey;
    const dist = Math.sqrt(ux * ux + uy * uy);
    if (dist > 0) {
      ux /= dist;
      uy /= dist;
    }
    const ticks = (c.aiTicks[eid] as number) + 1;
    c.aiTicks[eid] = ticks;

    if (def.poise > 0 && (c.poiseRegenTicks[eid] as number) > 0) {
      c.poiseRegenTicks[eid] = (c.poiseRegenTicks[eid] as number) - 1;
      if (c.poiseRegenTicks[eid] === 0) c.poise[eid] = def.poise;
    }

    // Frozen solid: no movement, no attacks, timers paused (GDD: Vaelis).
    if ((c.frozenTicks[eid] as number) > 0) {
      c.aiTicks[eid] = ticks - 1;
      c.velX[eid] = 0;
      c.velY[eid] = 0;
      continue;
    }

    if (state.gameOver) {
      c.velX[eid] = 0;
      c.velY[eid] = 0;
      if (c.token[eid] !== Token.None) releaseToken(state, eid);
      c.aiState[eid] = AiState.Position;
      continue;
    }

    switch (c.aiState[eid]) {
      case AiState.Position: {
        if ((c.aiCooldownTicks[eid] as number) > 0)
          c.aiCooldownTicks[eid] = (c.aiCooldownTicks[eid] as number) - 1;
        const speed = def.speedPxPerSec * chillSpeedFactor(state, eid);
        if (dist > def.keepDistanceMaxPx) {
          c.velX[eid] = ux * speed;
          c.velY[eid] = uy * speed;
        } else if (dist < def.keepDistanceMinPx) {
          c.velX[eid] = -ux * speed;
          c.velY[eid] = -uy * speed;
        } else {
          if (nextFloat(rng) < STRAFE_FLIP_CHANCE)
            c.aiStrafeSign[eid] = -(c.aiStrafeSign[eid] as number);
          const s = (c.aiStrafeSign[eid] as number) * speed * STRAFE_SPEED_FACTOR;
          c.velX[eid] = -uy * s;
          c.velY[eid] = ux * s;
        }
        c.facingX[eid] = ux;
        c.facingY[eid] = uy;
        if (
          (c.aiCooldownTicks[eid] as number) <= 0 &&
          dist <= atk.triggerRangePx &&
          tryAcquireToken(state, eid, def)
        ) {
          c.aiState[eid] = AiState.Windup;
          c.aiTicks[eid] = 0;
          c.aiDirX[eid] = ux;
          c.aiDirY[eid] = uy;
          c.aiAttackDone[eid] = 0;
          c.velX[eid] = 0;
          c.velY[eid] = 0;
          emit(state, Ev.Telegraph, eid);
        }
        break;
      }
      case AiState.Windup: {
        c.velX[eid] = 0;
        c.velY[eid] = 0;
        const windup = secondsToTicks(atk.windupSec);
        // Track the player early in the windup, then commit so the attack stays dodgeable.
        if (ticks <= windup * atk.trackFraction && dist > 0) {
          c.aiDirX[eid] = ux;
          c.aiDirY[eid] = uy;
        }
        c.facingX[eid] = c.aiDirX[eid] as number;
        c.facingY[eid] = c.aiDirY[eid] as number;
        if (ticks >= windup) {
          c.aiState[eid] = AiState.Active;
          c.aiTicks[eid] = 0;
          emit(state, Ev.EnemyAttack, eid);
          if (atk.kind === 'volley') {
            fireVolley(state, eid, def);
            c.aiAttackDone[eid] = 1;
          } else if (atk.kind === 'slam') {
            c.aiAttackDone[eid] = 1;
            if (dist <= atk.slamRadiusPx + pr) damagePlayer(state, atk.damage, ex, ey);
          }
        }
        break;
      }
      case AiState.Active: {
        if (atk.kind === 'lunge') {
          const speed = atk.lungePx / (Math.max(1, secondsToTicks(atk.activeSec)) * TICK_DT_SEC);
          c.velX[eid] = (c.aiDirX[eid] as number) * speed;
          c.velY[eid] = (c.aiDirY[eid] as number) * speed;
          const reach = (c.radius[eid] as number) + pr + LUNGE_CONTACT_SLACK_PX;
          if (c.aiAttackDone[eid] === 0 && dist <= reach) {
            c.aiAttackDone[eid] = 1;
            damagePlayer(state, atk.damage, ex, ey);
          }
        } else {
          c.velX[eid] = 0;
          c.velY[eid] = 0;
        }
        if (ticks >= secondsToTicks(atk.activeSec)) {
          c.aiState[eid] = AiState.Recover;
          c.aiTicks[eid] = 0;
          c.velX[eid] = 0;
          c.velY[eid] = 0;
        }
        break;
      }
      case AiState.Recover: {
        c.velX[eid] = 0;
        c.velY[eid] = 0;
        if (ticks >= secondsToTicks(atk.recoverySec)) {
          releaseToken(state, eid);
          c.aiState[eid] = AiState.Position;
          c.aiTicks[eid] = 0;
          c.aiCooldownTicks[eid] = secondsToTicks(
            nextRange(rng, atk.cooldownMinSec, atk.cooldownMaxSec),
          );
        }
        break;
      }
      case AiState.Stagger: {
        c.velX[eid] = 0;
        c.velY[eid] = 0;
        if (ticks >= secondsToTicks(def.staggerSec)) {
          c.aiState[eid] = AiState.Position;
          c.aiTicks[eid] = 0;
          // Back off briefly so a staggered enemy doesn't instantly re-attack.
          c.aiCooldownTicks[eid] = Math.max(
            c.aiCooldownTicks[eid] as number,
            secondsToTicks(atk.cooldownMinSec * 0.5),
          );
        }
        break;
      }
    }
  }
}
