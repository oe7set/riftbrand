import { BRAND_BURST } from '../../content/abilities';
import { eliteOf } from '../../content/elites';
import { ENEMIES } from '../../content/enemies';
import type { HitSource, HitstopLevel } from '../../content/schema';
import { TUNING } from '../../content/tuning';
import { AiState, C, rememberHit, Token, wasHitBy } from '../ecs/components';
import { destroyEntity } from '../ecs/world';
import { fireOnDamaged, fireOnHit, fireOnKill, fireOnPerfectDash } from '../effects/runtime';
import { Ev, EvFlag, pushEvent } from '../events';
import { PlayerAction } from '../player-state';
import { nextFloat } from '../rng/rng';
import type { SimState } from '../sim';
import { secondsToTicks } from '../time';
import { spawnHazard } from './hazards';

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
  return forced || nextFloat(state.rng.combat) < TUNING.critChance + state.build.stats.critChance;
}

/** Fills the ultimate meter (GDD §4.1) and announces the moment it becomes full. */
export function gainUltCharge(state: SimState, amount: number): void {
  const p = state.player;
  if (amount <= 0 || p.ultCharge >= 1) return;
  p.ultCharge = Math.min(1, p.ultCharge + amount);
  if (p.ultCharge >= 1) {
    const eid = state.playerEid;
    pushEvent(
      state.events,
      Ev.UltimateReady,
      state.c.posX[eid] as number,
      state.c.posY[eid] as number,
    );
  }
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
  /** Effect damage never retriggers onHit boons (no infinite loops). */
  source: HitSource;
}

/** Damage multiplier from the build and the target's status (GDD §7). */
function damageMultiplier(state: SimState, eid: number, source: HitSource): number {
  const c = state.c;
  const stats = state.build.stats;
  let mult = 1 + stats.allDamage;
  if (source === 'attack') mult += stats.attackDamage;
  else if (source === 'special') mult += stats.specialDamage;
  else if (source === 'cast') mult += stats.castDamage;
  if ((c.burnStacks[eid] as number) > 0) mult += stats.damageVsBurning;
  if ((c.frozenTicks[eid] as number) > 0) mult += TUNING.frozenDamageBonus + stats.damageVsFrozen;
  mult += (c.chillStacks[eid] as number) * stats.damageVsChilledPerStack;
  return mult;
}

/**
 * Shielded elites (GDD §5.1): a hit whose attacker stands inside the shield cone in front of
 * the enemy is mostly absorbed. `dirX/dirY` push away from the attacker.
 */
function shieldBlocks(state: SimState, eid: number, dirX: number, dirY: number): boolean {
  const elite = eliteOf(state.c.eliteMod[eid] as number);
  if (!elite || elite.shieldArcDeg <= 0) return false;
  // Frozen enemies drop their guard.
  if ((state.c.frozenTicks[eid] as number) > 0) return false;
  const facing = -dirX * (state.c.facingX[eid] as number) - dirY * (state.c.facingY[eid] as number);
  return facing >= Math.cos(((elite.shieldArcDeg / 2) * Math.PI) / 180);
}

/** Applies a player hit to an enemy. Returns false if this swing already hit it. */
export function damageEnemy(state: SimState, eid: number, spec: PlayerHitSpec): boolean {
  const c = state.c;
  if (wasHitBy(c, eid, spec.swingId)) return false;
  rememberHit(c, eid, spec.swingId);
  const def = ENEMIES[c.enemyType[eid] as number];
  if (!def) return false;

  const blocked = shieldBlocks(state, eid, spec.dirX, spec.dirY);
  const damage =
    spec.damage *
    (spec.crit ? TUNING.critMultiplier + state.build.stats.critDamage : 1) *
    damageMultiplier(state, eid, spec.source) *
    (blocked ? (eliteOf(c.eliteMod[eid] as number)?.shieldDamageFactor ?? 1) : 1);
  if (blocked) {
    const b = pushEvent(state.events, Ev.ShieldBlock, c.posX[eid] as number, c.posY[eid] as number);
    if (b) {
      b.eid = eid;
      b.dirX = spec.dirX;
      b.dirY = spec.dirY;
    }
  }
  const hp = (c.hp[eid] as number) - damage;
  c.hp[eid] = hp;
  const killed = hp <= 0;
  if (spec.source !== 'ultimate') gainUltCharge(state, damage / BRAND_BURST.chargeDamageDealt);

  let knockback = blocked ? 0 : spec.knockback * (1 - def.weight);
  if (!killed && !blocked) {
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
  else if (spec.source === 'attack' || spec.source === 'special' || spec.source === 'cast') {
    fireOnHit(state, eid, spec.source);
  }
  return true;
}

/** Burn ticks: no hitstop, knockback, stagger or onHit triggers. */
export function damageEnemyDot(state: SimState, eid: number, amount: number): void {
  const c = state.c;
  const damage = amount * damageMultiplier(state, eid, 'effect');
  const hp = (c.hp[eid] as number) - damage;
  c.hp[eid] = hp;
  gainUltCharge(state, damage / BRAND_BURST.chargeDamageDealt);
  const e = pushEvent(state.events, Ev.Hit, c.posX[eid] as number, c.posY[eid] as number);
  if (e) {
    e.eid = eid;
    e.amount = damage;
    e.value = c.enemyType[eid] as number;
    e.flags = EvFlag.Dot | (hp <= 0 ? EvFlag.Killed : 0);
  }
  if (hp <= 0) killEnemy(state, eid, 0, -1);
}

/** `triggerEffects` is off for scripted removals (horde end, debug) so they don't farm onKill boons. */
export function killEnemy(
  state: SimState,
  eid: number,
  dirX: number,
  dirY: number,
  triggerEffects = true,
): void {
  const c = state.c;
  const x = c.posX[eid] as number;
  const y = c.posY[eid] as number;
  const burn = c.burnStacks[eid] as number;
  const frozen = (c.frozenTicks[eid] as number) > 0;
  const type = c.enemyType[eid] as number;
  const elite = eliteOf(c.eliteMod[eid] as number);
  releaseToken(state, eid);
  const e = pushEvent(state.events, Ev.Kill, c.posX[eid] as number, c.posY[eid] as number);
  if (e) {
    e.eid = eid;
    e.dirX = dirX;
    e.dirY = dirY;
    e.value = type;
    e.flags = c.eliteMod[eid] as number;
  }
  destroyEntity(state.world, eid);
  if (triggerEffects && elite && elite.deathBlastRadiusPx > 0) {
    spawnHazard(
      state,
      x,
      y,
      elite.deathBlastRadiusPx,
      elite.deathBlastDamage,
      elite.deathBlastFuseSec,
      type,
    );
  }
  state.enemiesAlive--;
  state.player.kills++;
  if (triggerEffects) {
    const shards = Math.round(
      (ENEMIES[c.enemyType[eid] as number]?.shardValue ?? 0) * (1 + state.build.stats.shardGain),
    );
    if (shards > 0) {
      state.shards += shards;
      const s = pushEvent(state.events, Ev.Shards, x, y);
      if (s) s.amount = shards;
    }
  }
  if (triggerEffects) fireOnKill(state, x, y, burn, frozen);
  if (ENEMIES[type]?.role === 'boss') defeatBoss(state, type, x, y);
}

/** The boss falls: its summons crumble with it and pending spawns are cancelled. */
function defeatBoss(state: SimState, type: number, x: number, y: number): void {
  const e = pushEvent(state.events, Ev.BossDefeated, x, y);
  if (e) e.value = type;
  state.waves.pendingCount = 0;
  const { world } = state;
  for (let other = 0; other < world.highWater; other++) {
    if (((world.masks[other] as number) & C.Enemy) !== 0) killEnemy(state, other, 0, -1, false);
  }
}

export type PlayerDamageResult = 'hit' | 'dodged' | 'ignored';

/**
 * Applies enemy damage to the player, honoring dash i-frames and hit invulnerability.
 * `sourceType` is the attacking enemy type (-1 unknown), remembered if the hit is lethal.
 */
export function damagePlayer(
  state: SimState,
  amount: number,
  sourceX: number,
  sourceY: number,
  sourceType = -1,
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
      p.stamina = Math.min(state.staminaMax, p.stamina + TUNING.perfectDashStaminaRefund);
      pushEvent(state.events, Ev.PerfectDash, px, py);
      fireOnPerfectDash(state);
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
  const tally = sourceType >= 0 && sourceType < 255 ? sourceType : 255;
  state.damageBySource[tally] = (state.damageBySource[tally] as number) + amount;
  p.invulnTicks = secondsToTicks(TUNING.playerHitInvulnSec);
  gainUltCharge(state, amount / BRAND_BURST.chargeDamageTaken);
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
  if (hp <= 0 && state.lastSparks > 0) {
    // Letzter Funke (Ember Tree): the killing blow is refused once per run.
    state.lastSparks--;
    c.hp[eid] = Math.max(1, (c.maxHp[eid] as number) * state.lastSparkHeal);
    p.invulnTicks = secondsToTicks(TUNING.playerLastSparkInvulnSec);
    const spark = pushEvent(state.events, Ev.LastSpark, px, py);
    if (spark) spark.amount = c.hp[eid] as number;
    return 'hit';
  }
  if (hp > 0) fireOnDamaged(state);
  if (hp <= 0) {
    state.killedBy = sourceType;
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
