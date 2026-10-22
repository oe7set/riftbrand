import { ENEMIES } from '../../content/enemies';
import type { HitstopLevel } from '../../content/schema';
import { TUNING } from '../../content/tuning';
import { AiState, Token } from '../ecs/components';
import { destroyEntity } from '../ecs/world';
import { Ev, EvFlag, pushEvent } from '../events';
import { PlayerAction } from '../player-state';
import { nextFloat } from '../rng/rng';
import type { SimState } from '../sim';
import { secondsToTicks } from '../time';

export function hitstopSec(level: HitstopLevel): number {
  if (level === 'heavy') return TUNING.hitstopHeavySec;
  if (level === 'light') return TUNING.hitstopLightSec;
  return 0;
}

/** Hitstops never stack; the longest pending one wins. */
export function applyHitstop(state: SimState, seconds: number): void {
  const ticks = secondsToTicks(seconds);
  if (ticks > state.freezeTicks) state.freezeTicks = ticks;
}

export function rollCrit(state: SimState, forced: boolean): boolean {
  return forced || nextFloat(state.rng.combat) < TUNING.critChance;
}

export function releaseToken(state: SimState, eid: number): void {
  const token = state.c.token[eid];
  if (token === Token.Melee) state.meleeTokensInUse--;
  else if (token === Token.Ranged) state.rangedTokensInUse--;
  state.c.token[eid] = Token.None;
}

export function staggerEnemy(state: SimState, eid: number): void {
  const c = state.c;
  const def = ENEMIES[c.enemyType[eid] as number];
  if (!def) return;
  releaseToken(state, eid);
  c.aiState[eid] = AiState.Stagger;
  c.aiTicks[eid] = 0;
  c.velX[eid] = 0;
  c.velY[eid] = 0;
  const e = pushEvent(state.events, Ev.EnemyStagger, c.posX[eid] as number, c.posY[eid] as number);
  if (e) {
    e.eid = eid;
    e.value = c.enemyType[eid] as number;
  }
}

export interface PlayerHitSpec {
  damage: number;
  knockback: number;
  poiseDamage: number;
  hitstop: HitstopLevel;
  /** Unit direction the hit pushes the target. */
  dirX: number;
  dirY: number;
  crit: boolean;
  swingId: number;
}

/** Applies a player hit to an enemy. Returns false if this swing already hit it. */
export function damageEnemy(state: SimState, eid: number, spec: PlayerHitSpec): boolean {
  const c = state.c;
  if (c.lastHitSwing[eid] === spec.swingId) return false;
  c.lastHitSwing[eid] = spec.swingId;
  const def = ENEMIES[c.enemyType[eid] as number];
  if (!def) return false;

  const damage = spec.damage * (spec.crit ? TUNING.critMultiplier : 1);
  const hp = (c.hp[eid] as number) - damage;
  c.hp[eid] = hp;
  const killed = hp <= 0;

  let knockback = spec.knockback * (1 - def.weight);
  if (!killed) {
    if (def.poise > 0) {
      c.poise[eid] = (c.poise[eid] as number) - spec.poiseDamage;
      c.poiseRegenTicks[eid] = secondsToTicks(def.poiseRegenDelaySec);
      if ((c.poise[eid] as number) <= 0) {
        // Broken poise: full knockback and a long punish window.
        c.poise[eid] = def.poise;
        knockback = spec.knockback;
        staggerEnemy(state, eid);
      }
    } else if (c.aiState[eid] !== AiState.Stagger) {
      staggerEnemy(state, eid);
    }
  }
  c.kbX[eid] = (c.kbX[eid] as number) + spec.dirX * knockback;
  c.kbY[eid] = (c.kbY[eid] as number) + spec.dirY * knockback;

  const x = c.posX[eid] as number;
  const y = c.posY[eid] as number;
  const e = pushEvent(state.events, Ev.Hit, x, y);
  if (e) {
    e.eid = eid;
    e.dirX = spec.dirX;
    e.dirY = spec.dirY;
    e.amount = damage;
    e.value = c.enemyType[eid] as number;
    e.flags =
      (spec.crit ? EvFlag.Crit : 0) |
      (spec.hitstop === 'heavy' ? EvFlag.Heavy : 0) |
      (killed ? EvFlag.Killed : 0);
  }
  applyHitstop(
    state,
    killed ? Math.max(TUNING.hitstopKillSec, hitstopSec(spec.hitstop)) : hitstopSec(spec.hitstop),
  );
  if (killed) killEnemy(state, eid, spec.dirX, spec.dirY);
  return true;
}

export function killEnemy(state: SimState, eid: number, dirX: number, dirY: number): void {
  const c = state.c;
  releaseToken(state, eid);
  const e = pushEvent(state.events, Ev.Kill, c.posX[eid] as number, c.posY[eid] as number);
  if (e) {
    e.eid = eid;
    e.dirX = dirX;
    e.dirY = dirY;
    e.value = c.enemyType[eid] as number;
  }
  destroyEntity(state.world, eid);
  state.enemiesAlive--;
  state.player.kills++;
}

export type PlayerDamageResult = 'hit' | 'dodged' | 'ignored';

/** Applies enemy damage to the player, honoring dash i-frames and hit invulnerability. */
export function damagePlayer(
  state: SimState,
  amount: number,
  sourceX: number,
  sourceY: number,
): PlayerDamageResult {
  const p = state.player;
  if (state.gameOver) return 'ignored';
  const eid = state.playerEid;
  const c = state.c;
  const px = c.posX[eid] as number;
  const py = c.posY[eid] as number;

  if (p.action === PlayerAction.Dash) {
    if (!p.perfectDashUsed && p.actionTicks <= secondsToTicks(TUNING.perfectDashWindowSec)) {
      p.perfectDashUsed = true;
      p.guaranteedCrit = true;
      p.stamina = Math.min(TUNING.staminaMax, p.stamina + TUNING.perfectDashStaminaRefund);
      pushEvent(state.events, Ev.PerfectDash, px, py);
    }
    return 'dodged';
  }
  if (p.invulnTicks > 0 || state.debug.godMode) return 'ignored';

  let dx = px - sourceX;
  let dy = py - sourceY;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len > 0) {
    dx /= len;
    dy /= len;
  } else {
    dx = 1;
    dy = 0;
  }
  const hp = (c.hp[eid] as number) - amount;
  c.hp[eid] = hp;
  p.invulnTicks = secondsToTicks(TUNING.playerHitInvulnSec);
  c.kbX[eid] = dx * TUNING.playerHitKnockback;
  c.kbY[eid] = dy * TUNING.playerHitKnockback;
  const e = pushEvent(state.events, Ev.PlayerHit, px, py);
  if (e) {
    e.eid = eid;
    e.dirX = dx;
    e.dirY = dy;
    e.amount = amount;
    e.flags = hp <= 0 ? EvFlag.Killed : 0;
  }
  applyHitstop(state, TUNING.hitstopPlayerHitSec);
  if (hp <= 0) {
    c.hp[eid] = 0;
    p.action = PlayerAction.Dead;
    p.actionTicks = 0;
    state.gameOver = true;
    c.velX[eid] = 0;
    c.velY[eid] = 0;
    const d = pushEvent(state.events, Ev.PlayerDied, px, py);
    if (d) d.value = state.waves.wave;
  }
  return 'hit';
}
