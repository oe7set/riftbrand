import { eliteOf } from '../../content/elites';
import { attackOf, ENEMIES, enemyTypeOf } from '../../content/enemies';
import type { EnemyAttackDef, EnemyDef } from '../../content/schema';
import { damagePlayer, releaseToken } from '../combat/damage';
import { spawnHazard } from '../combat/hazards';
import { AiState, C, RenderKind, Team, Token } from '../ecs/components';
import { addComponents } from '../ecs/world';
import { aimErrorDeg, chillSpeedFactor, windupRate } from '../effects/status';
import { packEnemy } from '../enemy-code';
import { Ev, pushEvent } from '../events';
import { nextFloat, nextInt, nextRange } from '../rng/rng';
import { MAX_MELEE_TOKENS, MAX_RANGED_TOKENS, type SimState, spawnEntity } from '../sim';
import { secondsToTicks, TICK_DT_SEC } from '../time';
import { scheduleSpawnAt } from './waves';

const DEG = Math.PI / 180;
const STRAFE_SPEED_FACTOR = 0.5;
/** Chance per tick that a strafing enemy switches direction (~once every 2 s). */
const STRAFE_FLIP_CHANCE = 0.008;
const LUNGE_CONTACT_SLACK_PX = 4;
/** Summoned minions appear on a ring this far outside the summoner. */
const SUMMON_RING_PX = 70;
const SUMMON_PORTAL_SEC = 0.6;

/** Attack tokens (GDD §4.6): only a few enemies may attack at once. Bosses need none. */
function tryAcquireToken(state: SimState, eid: number, def: EnemyDef): boolean {
  if (def.token === 'none') return true;
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
  // Which pattern (bosses) or phase is playing, so feedback can pick the right effect.
  e.amount = c.aiPattern[eid] as number;
  e.flags = c.aiPhase[eid] as number;
}

/** The attack this enemy is using right now (boss pattern or its single attack). */
export function currentAttack(state: SimState, eid: number, def: EnemyDef): EnemyAttackDef {
  return attackOf(def, state.c.aiPhase[eid] as number, state.c.aiPattern[eid] as number);
}

function fireVolley(state: SimState, eid: number, atk: EnemyAttackDef): void {
  if (atk.kind !== 'volley') return;
  const c = state.c;
  // Blinded enemies miss: the volley veers off to alternating sides.
  const veer = aimErrorDeg(state, eid) * DEG * ((state.tick + eid) % 2 === 0 ? 1 : -1);
  const baseAngle = Math.atan2(c.aiDirY[eid] as number, c.aiDirX[eid] as number) + veer;
  const count = atk.projectileCount;
  const ring = atk.spreadDeg >= 180;
  for (let i = 0; i < count; i++) {
    // A full ring spaces shots evenly; a fan spreads them across ±spreadDeg.
    const offset = ring
      ? (i / count) * Math.PI * 2
      : count === 1
        ? 0
        : (i / (count - 1) - 0.5) * 2 * atk.spreadDeg * DEG;
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
    // Remembered so a lethal shot can name its shooter.
    c.enemyType[p] = c.enemyType[eid] as number;
  }
}

/** Mines land around the player's current spot, so standing still is punished (GDD §5.1). */
function layMines(state: SimState, eid: number, atk: EnemyAttackDef, px: number, py: number): void {
  if (atk.kind !== 'mine') return;
  const rng = state.rng.ai;
  for (let i = 0; i < atk.count; i++) {
    // The first mine lands right on the player; the rest scatter around it.
    const a = nextRange(rng, 0, Math.PI * 2);
    const d = i === 0 ? 0 : nextRange(rng, atk.spreadPx * 0.4, atk.spreadPx);
    spawnHazard(
      state,
      px + Math.cos(a) * d,
      py + Math.sin(a) * d,
      atk.blastRadiusPx,
      atk.damage,
      atk.fuseSec,
      state.c.enemyType[eid] as number,
    );
  }
}

function summon(state: SimState, eid: number, atk: EnemyAttackDef): void {
  if (atk.kind !== 'summon') return;
  const type = enemyTypeOf(atk.enemy);
  if (type < 0 || state.enemiesAlive + state.waves.pendingCount >= atk.maxAlive) return;
  const c = state.c;
  const r = (c.radius[eid] as number) + SUMMON_RING_PX;
  const base = nextRange(state.rng.ai, 0, Math.PI * 2);
  for (let i = 0; i < atk.count; i++) {
    const a = base + (i / atk.count) * Math.PI * 2;
    const x = Math.min(
      Math.max((c.posX[eid] as number) + Math.cos(a) * r, 40),
      state.arenaWidthPx - 40,
    );
    const y = Math.min(
      Math.max((c.posY[eid] as number) + Math.sin(a) * r, 40),
      state.arenaHeightPx - 40,
    );
    scheduleSpawnAt(state, packEnemy(type), x, y, SUMMON_PORTAL_SEC);
  }
}

/** Support: heals every other enemy in range by a fraction of its max HP. */
function mend(state: SimState, eid: number, atk: EnemyAttackDef): void {
  if (atk.kind !== 'mend') return;
  const { world, c } = state;
  const x = c.posX[eid] as number;
  const y = c.posY[eid] as number;
  const e = pushEvent(state.events, Ev.EnemyMend, x, y);
  if (e) {
    e.eid = eid;
    e.amount = atk.radiusPx;
  }
  const r2 = atk.radiusPx * atk.radiusPx;
  for (let other = 0; other < world.highWater; other++) {
    if (other === eid || ((world.masks[other] as number) & C.Enemy) === 0) continue;
    const dx = (c.posX[other] as number) - x;
    const dy = (c.posY[other] as number) - y;
    if (dx * dx + dy * dy > r2) continue;
    const max = c.maxHp[other] as number;
    c.hp[other] = Math.min(max, (c.hp[other] as number) + max * atk.healFraction);
  }
}

/**
 * Picks a boss pattern among those in range, avoiding an immediate repeat. Returns false when
 * nothing is in range yet (the boss keeps closing in).
 */
function pickPattern(state: SimState, eid: number, def: EnemyDef, dist: number): boolean {
  const phases = def.boss?.phases;
  if (!phases) return dist <= def.attack.triggerRangePx;
  const c = state.c;
  const attacks = phases[c.aiPhase[eid] as number]?.attacks ?? [];
  const last = c.aiPattern[eid] as number;
  let eligible = 0;
  for (let i = 0; i < attacks.length; i++) {
    if (
      dist <= (attacks[i] as EnemyAttackDef).triggerRangePx &&
      (i !== last || attacks.length === 1)
    )
      eligible++;
  }
  if (eligible === 0) return false;
  let pick = nextInt(state.rng.ai, 0, eligible);
  for (let i = 0; i < attacks.length; i++) {
    if (dist > (attacks[i] as EnemyAttackDef).triggerRangePx || (i === last && attacks.length > 1))
      continue;
    if (pick-- === 0) {
      c.aiPattern[eid] = i;
      return true;
    }
  }
  return false;
}

/** Boss phase transitions (GDD §5.3): a roar that cancels the current attack and opens a window. */
function updateBossPhase(state: SimState, eid: number, def: EnemyDef): void {
  const phases = def.boss?.phases;
  if (!phases) return;
  const c = state.c;
  const ratio = (c.hp[eid] as number) / (c.maxHp[eid] as number);
  let phase = c.aiPhase[eid] as number;
  while (phase + 1 < phases.length && ratio <= (phases[phase + 1]?.hpBelow ?? 0)) phase++;
  if (phase === c.aiPhase[eid]) return;
  c.aiPhase[eid] = phase;
  c.aiPattern[eid] = 0;
  releaseToken(state, eid);
  c.aiState[eid] = AiState.Stagger;
  c.aiTicks[eid] = 0;
  c.velX[eid] = 0;
  c.velY[eid] = 0;
  const e = pushEvent(state.events, Ev.BossPhase, c.posX[eid] as number, c.posY[eid] as number);
  if (e) {
    e.eid = eid;
    e.value = phase;
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
    updateBossPhase(state, eid, def);
    const atk = currentAttack(state, eid, def);
    const elite = eliteOf(c.eliteMod[eid] as number);
    const phase = def.boss?.phases[c.aiPhase[eid] as number];
    const ex = c.posX[eid] as number;
    const ey = c.posY[eid] as number;
    let ux = px - ex;
    let uy = py - ey;
    const dist = Math.sqrt(ux * ux + uy * uy);
    if (dist > 0) {
      ux /= dist;
      uy /= dist;
    }
    let ticks = (c.aiTicks[eid] as number) + 1;
    if (c.aiState[eid] === AiState.Windup) {
      // Blinded enemies wind up slower: the timer only advances by a fraction per tick.
      const rate = windupRate(state, eid);
      if (rate < 1) {
        const carry = (c.windupCarry[eid] as number) + rate;
        if (carry >= 1) c.windupCarry[eid] = carry - 1;
        else {
          c.windupCarry[eid] = carry;
          ticks -= 1;
        }
      }
    }
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
        const speed =
          def.speedPxPerSec *
          (elite?.speedMultiplier ?? 1) *
          (phase?.speedScale ?? 1) *
          chillSpeedFactor(state, eid);
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
          pickPattern(state, eid, def, dist) &&
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
          c.aiAttackDone[eid] = 1;
          switch (atk.kind) {
            case 'volley':
              fireVolley(state, eid, atk);
              break;
            case 'slam':
              if (dist <= atk.slamRadiusPx + pr)
                damagePlayer(state, atk.damage, ex, ey, c.enemyType[eid] as number);
              break;
            case 'mine':
              layMines(state, eid, atk, px, py);
              break;
            case 'summon':
              summon(state, eid, atk);
              break;
            case 'mend':
              mend(state, eid, atk);
              break;
            case 'lunge':
              c.aiAttackDone[eid] = 0;
              break;
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
            damagePlayer(state, atk.damage, ex, ey, c.enemyType[eid] as number);
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
            nextRange(rng, atk.cooldownMinSec, atk.cooldownMaxSec) *
              (elite?.cooldownMultiplier ?? 1) *
              (phase?.cooldownScale ?? 1),
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
