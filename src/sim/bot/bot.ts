import { RIFT_SHOT } from '../../content/abilities';
import { attackOf, ENEMIES } from '../../content/enemies';
import { Button, type InputFrame } from '../../shared/input-frame';
import { AiState, C, Team } from '../ecs/components';
import { PlayerAction } from '../player-state';
import { overlapsObstacle } from '../room';
import type { SimState } from '../sim';
import { secondsToTicks } from '../time';

/**
 * Simple heuristic players for the headless simulator (TECH_DESIGN §13). They drive the sim
 * through the same InputFrame as a human, so balancing numbers reflect real rules.
 * - balanced: dodges telegraphs, shots and mines, fights at melee range, uses everything.
 * - aggressive: never dodges; a lower bound for how forgiving the game is.
 */
export type BotStrategy = 'balanced' | 'aggressive';

/** Per-room memory, e.g. to notice being stuck on an obstacle. */
export interface BotMemory {
  lastX: number;
  lastY: number;
  stuckTicks: number;
  /** +1/−1: which way to slide around an obstacle when stuck. */
  sidestep: number;
}

export function createBotMemory(): BotMemory {
  return { lastX: 0, lastY: 0, stuckTicks: 0, sidestep: 1 };
}

/** Ticks before an enemy attack lands at which the bot dashes (a human-ish reaction). */
const DODGE_LEAD_TICKS = 5;
const MELEE_RANGE_PX = 80;
const SHOT_DANGER_PX = 70;

function setMove(out: InputFrame, x: number, y: number): void {
  const len = Math.sqrt(x * x + y * y);
  out.moveX = len > 0 ? x / len : 0;
  out.moveY = len > 0 ? y / len : 0;
}

const PROBE_STEP_PX = 15;
const PROBE_DIST_PX = 90;

function pathFree(
  state: SimState,
  x: number,
  y: number,
  dx: number,
  dy: number,
  r: number,
): boolean {
  for (let d = PROBE_STEP_PX; d <= PROBE_DIST_PX; d += PROBE_STEP_PX) {
    if (overlapsObstacle(state.room, x + dx * d, y + dy * d, r)) return false;
  }
  return true;
}

/**
 * Walks toward (tx, ty), steering around obstacles: when the straight line is blocked, the
 * bot turns to one side (kept stable in memory) until the way is clear again.
 */
function steerTo(
  state: SimState,
  memory: BotMemory,
  out: InputFrame,
  tx: number,
  ty: number,
): void {
  const c = state.c;
  const p = state.playerEid;
  const px = c.posX[p] as number;
  const py = c.posY[p] as number;
  const r = (c.radius[p] as number) + 4;
  let dx = tx - px;
  let dy = ty - py;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  dx /= len;
  dy /= len;
  if (pathFree(state, px, py, dx, dy, r)) {
    setMove(out, dx, dy);
    return;
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    const side = attempt === 0 ? memory.sidestep : -memory.sidestep;
    for (const deg of [45, 90, 135]) {
      const a = (deg * Math.PI * side) / 180;
      const rx = dx * Math.cos(a) - dy * Math.sin(a);
      const ry = dx * Math.sin(a) + dy * Math.cos(a);
      if (pathFree(state, px, py, rx, ry, r)) {
        if (attempt === 1) memory.sidestep = side;
        setMove(out, rx, ry);
        return;
      }
    }
  }
  setMove(out, dx, dy);
}

/** Fills `out` with the bot's decision for this tick. */
export function botInput(
  state: SimState,
  strategy: BotStrategy,
  memory: BotMemory,
  out: InputFrame,
): void {
  const { world, c } = state;
  const p = state.playerEid;
  const px = c.posX[p] as number;
  const py = c.posY[p] as number;
  out.pressed = 0;
  out.held = 0;
  out.hasAim = false;
  out.assistDeg = 30;
  out.moveX = 0;
  out.moveY = 0;
  if (state.gameOver) return;

  // Slide sideways when the body hasn't moved for a while (stuck on an obstacle).
  const moved = Math.abs(px - memory.lastX) + Math.abs(py - memory.lastY);
  memory.stuckTicks = moved < 0.5 ? memory.stuckTicks + 1 : 0;
  if (memory.stuckTicks > 40) {
    memory.sidestep = -memory.sidestep;
    memory.stuckTicks = 0;
  }
  memory.lastX = px;
  memory.lastY = py;

  if (state.room.exitOpen) {
    steerTo(state, memory, out, state.room.exitX, state.room.exitY);
    return;
  }

  let nearest = -1;
  let nearestDist = Number.POSITIVE_INFINITY;
  let crowd = 0;
  let boss = false;
  let threatX = 0;
  let threatY = 0;
  let threatened = false;
  let guarding = -1;
  for (let e = 0; e < world.highWater; e++) {
    const mask = world.masks[e] as number;
    const dx = (c.posX[e] as number) - px;
    const dy = (c.posY[e] as number) - py;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if ((mask & C.Enemy) !== 0) {
      const def = ENEMIES[c.enemyType[e] as number];
      if (!def) continue;
      if (def.role === 'boss' || def.role === 'champion') boss = true;
      if (dist < nearestDist) {
        nearest = e;
        nearestDist = dist;
      }
      if (dist < 120) crowd++;
      if (c.aiState[e] !== AiState.Windup) continue;
      const atk = attackOf(def, c.aiPhase[e] as number, c.aiPattern[e] as number);
      // Parry stance (M3.5): never swing into it; shots and spells break it.
      if (atk.kind === 'guard') {
        if (dist < 260) guarding = e;
        continue;
      }
      const left = secondsToTicks(atk.windupSec) - (c.aiTicks[e] as number);
      const reach =
        atk.kind === 'slam'
          ? atk.slamRadiusPx + 20
          : atk.kind === 'lunge'
            ? atk.lungePx + (c.radius[e] as number) + 20
            : 0;
      if (left <= DODGE_LEAD_TICKS && dist < reach) {
        threatened = true;
        threatX = dx;
        threatY = dy;
      }
    } else if ((mask & C.Projectile) !== 0 && c.team[e] === Team.Enemy) {
      // A shot heading our way.
      const closing = dx * (c.velX[e] as number) + dy * (c.velY[e] as number) < 0;
      if (closing && dist < SHOT_DANGER_PX) {
        threatened = true;
        threatX = dx;
        threatY = dy;
      }
    } else if ((mask & C.Hazard) !== 0) {
      const r = (c.radius[e] as number) + (c.radius[p] as number) + 8;
      if (dist < r) {
        // Walk out of the blast zone; dash if it is about to go off.
        out.moveX = -dx / (dist || 1);
        out.moveY = -dy / (dist || 1);
        if ((c.projLifeTicks[e] as number) < 12) {
          threatened = true;
          threatX = dx;
          threatY = dy;
        }
      }
    }
  }

  const action = state.player.action;
  if (strategy === 'balanced' && threatened && state.player.stamina >= 1) {
    // Dash sideways to the threat: leaves both slam circles and lunge lanes.
    setMove(out, -threatY, threatX);
    if (action !== PlayerAction.Dash) out.pressed |= Button.Dash;
    return;
  }

  if (state.player.ultCharge >= 1 && (crowd >= 3 || (boss && nearestDist < 250))) {
    out.pressed |= Button.Ultimate;
  }
  // Spells: into a crowd or at a boss in reach (the aim below points at the nearest enemy).
  if (
    state.player.activeSpell >= 0 &&
    state.player.spellCooldownTicks === 0 &&
    (crowd >= 3 || (boss && nearestDist < 200))
  ) {
    out.pressed |= Button.Spell;
  }
  if (nearest < 0) return;
  const ex = (c.posX[nearest] as number) - px;
  const ey = (c.posY[nearest] as number) - py;
  out.hasAim = true;
  out.aimX = ex / (nearestDist || 1);
  out.aimY = ey / (nearestDist || 1);
  if (out.moveX === 0 && out.moveY === 0) {
    if (nearestDist > MELEE_RANGE_PX * 0.7) {
      steerTo(state, memory, out, c.posX[nearest] as number, c.posY[nearest] as number);
    } else if (nearestDist < 30) setMove(out, -ex, -ey);
  }
  if (guarding === nearest) {
    // Hold the swing, break the stance from range.
    if (state.player.castCharges > 0) out.pressed |= Button.Cast;
    else if (state.player.activeSpell >= 0 && state.player.spellCooldownTicks === 0)
      out.pressed |= Button.Spell;
    if (out.moveX === 0 && out.moveY === 0) setMove(out, -ex, -ey);
    return;
  }
  if (nearestDist < MELEE_RANGE_PX + (c.radius[nearest] as number)) {
    out.held |= Button.Attack;
    if (crowd >= 3 && state.player.stamina >= 2) out.pressed |= Button.Special;
  } else if (
    state.player.castCharges > 0 &&
    nearestDist < RIFT_SHOT.rangePx &&
    state.tick % 20 === 0
  ) {
    out.pressed |= Button.Cast;
  }
}
