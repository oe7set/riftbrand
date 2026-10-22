import type { MeleeHitDef } from '../../content/schema';
import { TUNING } from '../../content/tuning';
import { BRAND_BLADE } from '../../content/weapons/brand-blade';
import { Button, type InputFrame } from '../../shared/input-frame';
import { queryRect } from '../collision/spatial-hash';
import { damageEnemy, type PlayerHitSpec, rollCrit } from '../combat/damage';
import { C } from '../ecs/components';
import { fireOnDash } from '../effects/runtime';
import { Ev, pushEvent } from '../events';
import { Buffered, type BufferedId, PlayerAction } from '../player-state';
import type { SimState } from '../sim';
import { secondsToTicks, TICK_DT_SEC } from '../time';

const MOVE_EPSILON = 1e-3;
const DEG = Math.PI / 180;
/** Reused for every hit; damageEnemy copies what it needs. */
const hitSpec: PlayerHitSpec = {
  damage: 0,
  knockback: 0,
  poiseDamage: 0,
  hitstop: 'none',
  dirX: 0,
  dirY: 0,
  crit: false,
  swingId: 0,
  source: 'attack',
};

function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(current + maxDelta, target);
  return Math.max(current - maxDelta, target);
}

/**
 * Records presses into the input buffer (GDD §10.1, 150 ms). Runs every tick, including hitstop
 * ticks, so a press during a freeze is executed right after it.
 */
export function capturePlayerInput(state: SimState, input: InputFrame): void {
  const p = state.player;
  if (state.gameOver) return;
  let wanted: BufferedId = Buffered.None;
  // Dash wins ties: it is the defensive panic button.
  if (input.pressed & Button.Dash) wanted = Buffered.Dash;
  else if (input.pressed & Button.Special) wanted = Buffered.Special;
  else if (input.pressed & Button.Attack) wanted = Buffered.Attack;
  if (wanted === Buffered.None) return;
  p.buffered = wanted;
  p.bufferTicks = secondsToTicks(TUNING.inputBufferSec);
  p.bufferStaminaSignaled = false;
}

function attackPhaseTicks(hit: MeleeHitDef): [number, number, number] {
  const w = secondsToTicks(hit.windupSec);
  const a = Math.max(1, secondsToTicks(hit.activeSec));
  return [w, a, secondsToTicks(hit.recoverySec)];
}

function specialPhaseTicks(): [number, number, number] {
  const s = BRAND_BLADE.special;
  return [
    secondsToTicks(s.windupSec),
    Math.max(1, secondsToTicks(s.activeSec)),
    secondsToTicks(s.recoverySec),
  ];
}

function staminaCost(action: BufferedId): number {
  if (action === Buffered.Dash) return 1;
  if (action === Buffered.Special) return BRAND_BLADE.special.staminaCost;
  return 0;
}

/** Whether the current action may be interrupted by `next` right now. */
function canInterrupt(state: SimState, next: BufferedId): boolean {
  const p = state.player;
  const t = p.actionTicks;
  switch (p.action) {
    case PlayerAction.Idle:
      return true;
    case PlayerAction.Attack: {
      const hit = BRAND_BLADE.combo[p.comboIndex];
      if (!hit) return true;
      const [w, a] = attackPhaseTicks(hit);
      const inRecovery = t >= w + a;
      if (!inRecovery) return false;
      // Dash and special cancel recovery (GDD §4.2); the next combo hit needs a short delay.
      if (next !== Buffered.Attack) return true;
      const isLastHit = p.comboIndex >= BRAND_BLADE.combo.length - 1;
      return !isLastHit && t - (w + a) >= secondsToTicks(BRAND_BLADE.recoveryCancelSec);
    }
    case PlayerAction.Special: {
      const [w, a] = specialPhaseTicks();
      return next === Buffered.Dash && t >= w + a;
    }
    default:
      return false;
  }
}

/** Direction for an attack: explicit aim, else movement, else facing, then aim-assisted. */
function resolveAttackDir(state: SimState, input: InputFrame, out: { x: number; y: number }): void {
  const eid = state.playerEid;
  const c = state.c;
  let dx = c.facingX[eid] as number;
  let dy = c.facingY[eid] as number;
  const moveLen = Math.sqrt(input.moveX * input.moveX + input.moveY * input.moveY);
  if (input.hasAim) {
    dx = input.aimX;
    dy = input.aimY;
  } else if (moveLen > MOVE_EPSILON) {
    dx = input.moveX / moveLen;
    dy = input.moveY / moveLen;
  }
  out.x = dx;
  out.y = dy;

  const px = c.posX[eid] as number;
  const py = c.posY[eid] as number;
  const range = BRAND_BLADE.assistRangePx;
  const cosCone = Math.cos(input.assistDeg * DEG);
  const n = queryRect(
    state.spatial,
    px - range,
    py - range,
    px + range,
    py + range,
    state.queryBuffer,
  );
  let bestScore = Number.POSITIVE_INFINITY;
  for (let i = 0; i < n; i++) {
    const e = state.queryBuffer[i] as number;
    if (((state.world.masks[e] as number) & C.Enemy) === 0) continue;
    const ex = (c.posX[e] as number) - px;
    const ey = (c.posY[e] as number) - py;
    const dist = Math.sqrt(ex * ex + ey * ey);
    if (dist === 0 || dist > range + (c.radius[e] as number)) continue;
    const cos = (ex * dx + ey * dy) / dist;
    if (cos < cosCone) continue;
    // Prefer enemies close to the intended direction, then close in distance.
    const score = (1 - cos) * 4 + dist / range;
    if (score < bestScore) {
      bestScore = score;
      out.x = ex / dist;
      out.y = ey / dist;
    }
  }
}

const dirScratch = { x: 0, y: 0 };

function startAction(state: SimState, next: BufferedId, input: InputFrame): void {
  const p = state.player;
  const eid = state.playerEid;
  const c = state.c;
  const px = c.posX[eid] as number;
  const py = c.posY[eid] as number;
  p.stamina -= staminaCost(next);
  if (staminaCost(next) > 0) p.staminaDelayTicks = secondsToTicks(TUNING.staminaRegenDelaySec);

  if (next === Buffered.Dash) {
    const moveLen = Math.sqrt(input.moveX * input.moveX + input.moveY * input.moveY);
    p.dirX = moveLen > MOVE_EPSILON ? input.moveX / moveLen : (c.facingX[eid] as number);
    p.dirY = moveLen > MOVE_EPSILON ? input.moveY / moveLen : (c.facingY[eid] as number);
    p.action = PlayerAction.Dash;
    p.perfectDashUsed = false;
    const e = pushEvent(state.events, Ev.Dash, px, py);
    if (e) {
      e.dirX = p.dirX;
      e.dirY = p.dirY;
    }
    fireOnDash(state);
  } else {
    resolveAttackDir(state, input, dirScratch);
    p.dirX = dirScratch.x;
    p.dirY = dirScratch.y;
    p.swingId = ++state.swingCounter;
    p.swingCrit = p.guaranteedCrit;
    p.guaranteedCrit = false;
    if (next === Buffered.Attack) {
      const continues =
        p.action === PlayerAction.Attack ||
        (p.comboWindowTicks > 0 && p.comboIndex < BRAND_BLADE.combo.length - 1);
      p.comboIndex = continues ? p.comboIndex + 1 : 0;
      p.action = PlayerAction.Attack;
    } else {
      p.action = PlayerAction.Special;
    }
    const e = pushEvent(state.events, next === Buffered.Attack ? Ev.Swing : Ev.Special, px, py);
    if (e) {
      e.dirX = p.dirX;
      e.dirY = p.dirY;
      e.value = p.comboIndex;
    }
  }
  p.actionTicks = 0;
  p.comboWindowTicks = 0;
  c.facingX[eid] = p.dirX;
  c.facingY[eid] = p.dirY;
}

function tryBufferedAction(state: SimState, input: InputFrame): void {
  const p = state.player;
  // Holding attack keeps the combo going (GDD §4.1).
  if (p.buffered === Buffered.None && input.held & Button.Attack) {
    p.buffered = Buffered.Attack;
    p.bufferTicks = 1;
  }
  if (p.buffered === Buffered.None) return;
  const next = p.buffered;
  if (canInterrupt(state, next)) {
    if (p.stamina + 1e-9 >= staminaCost(next)) {
      p.buffered = Buffered.None;
      startAction(state, next, input);
      return;
    }
    if (!p.bufferStaminaSignaled) {
      p.bufferStaminaSignaled = true;
      const eid = state.playerEid;
      pushEvent(
        state.events,
        Ev.StaminaEmpty,
        state.c.posX[eid] as number,
        state.c.posY[eid] as number,
      );
    }
  }
  p.bufferTicks--;
  if (p.bufferTicks <= 0) p.buffered = Buffered.None;
}

/** Hits enemies inside an arc (or a full circle for arcDeg >= 360) around the player. */
function meleeSweep(
  state: SimState,
  reachPx: number,
  arcDeg: number,
  damage: number,
  knockback: number,
  poiseDamage: number,
  hitstop: MeleeHitDef['hitstop'],
  source: 'attack' | 'special',
): void {
  const p = state.player;
  const eid = state.playerEid;
  const c = state.c;
  const px = c.posX[eid] as number;
  const py = c.posY[eid] as number;
  const pr = c.radius[eid] as number;
  const reach = reachPx + 40;
  const cosHalf = Math.cos((Math.min(arcDeg, 360) / 2) * DEG);
  const n = queryRect(
    state.spatial,
    px - reach,
    py - reach,
    px + reach,
    py + reach,
    state.queryBuffer,
  );
  for (let i = 0; i < n; i++) {
    const e = state.queryBuffer[i] as number;
    if (((state.world.masks[e] as number) & C.Enemy) === 0) continue;
    const ex = (c.posX[e] as number) - px;
    const ey = (c.posY[e] as number) - py;
    const er = c.radius[e] as number;
    const dist = Math.sqrt(ex * ex + ey * ey);
    if (dist > reachPx + er) continue;
    const overlapping = dist <= er + pr;
    if (!overlapping && arcDeg < 360 && (ex * p.dirX + ey * p.dirY) / dist < cosHalf) continue;
    hitSpec.damage = damage;
    hitSpec.knockback = knockback;
    hitSpec.poiseDamage = poiseDamage;
    hitSpec.hitstop = hitstop;
    hitSpec.dirX = dist > 0 ? ex / dist : p.dirX;
    hitSpec.dirY = dist > 0 ? ey / dist : p.dirY;
    hitSpec.crit = rollCrit(state, p.swingCrit);
    hitSpec.swingId = p.swingId;
    hitSpec.source = source;
    damageEnemy(state, e, hitSpec);
  }
}

function controlMovement(state: SimState, input: InputFrame, speedFactor: number): void {
  const eid = state.playerEid;
  const c = state.c;
  const len = Math.sqrt(input.moveX * input.moveX + input.moveY * input.moveY);
  const moving = len > MOVE_EPSILON;
  const dirX = moving ? input.moveX / len : 0;
  const dirY = moving ? input.moveY / len : 0;
  // Analog sticks may report slightly more than 1 on diagonals.
  const speed = TUNING.playerSpeedPxPerSec * speedFactor * Math.min(len, 1);
  const targetX = dirX * speed;
  const targetY = dirY * speed;
  const rampSec = moving ? TUNING.playerAccelSec : TUNING.playerDecelSec;
  if (rampSec <= 0) {
    c.velX[eid] = targetX;
    c.velY[eid] = targetY;
  } else {
    // Per-axis ramp keeps diagonal and straight acceleration equally snappy.
    const maxDelta = (TUNING.playerSpeedPxPerSec * TICK_DT_SEC) / rampSec;
    c.velX[eid] = approach(c.velX[eid] as number, targetX, maxDelta);
    c.velY[eid] = approach(c.velY[eid] as number, targetY, maxDelta);
  }
  if (state.player.action !== PlayerAction.Idle) return;
  // Facing follows explicit aim first, then movement; it stays put when idle.
  if (input.hasAim) {
    c.facingX[eid] = input.aimX;
    c.facingY[eid] = input.aimY;
  } else if (moving) {
    c.facingX[eid] = dirX;
    c.facingY[eid] = dirY;
  }
}

export function playerActionSystem(state: SimState, input: InputFrame): void {
  const eid = state.playerEid;
  if (eid < 0) return;
  const p = state.player;
  const c = state.c;
  if (p.action === PlayerAction.Dead) {
    c.velX[eid] = 0;
    c.velY[eid] = 0;
    return;
  }

  if (p.invulnTicks > 0) p.invulnTicks--;
  if (p.staminaDelayTicks > 0) p.staminaDelayTicks--;
  else if (p.stamina < TUNING.staminaMax) {
    p.stamina = Math.min(
      TUNING.staminaMax,
      p.stamina + 1 / Math.max(1, secondsToTicks(TUNING.staminaRegenSecPerSegment)),
    );
  }
  if (p.action === PlayerAction.Idle && p.comboWindowTicks > 0) p.comboWindowTicks--;

  tryBufferedAction(state, input);
  const t = p.actionTicks;
  p.actionTicks++;

  switch (p.action) {
    case PlayerAction.Idle:
      controlMovement(state, input, 1);
      break;
    case PlayerAction.Dash: {
      const duration = Math.max(1, secondsToTicks(TUNING.dashDurationSec));
      const speed = TUNING.dashDistancePx / (duration * TICK_DT_SEC);
      c.velX[eid] = p.dirX * speed;
      c.velY[eid] = p.dirY * speed;
      if (t + 1 >= duration) p.action = PlayerAction.Idle;
      break;
    }
    case PlayerAction.Attack: {
      const hit = BRAND_BLADE.combo[p.comboIndex];
      if (!hit) {
        p.action = PlayerAction.Idle;
        break;
      }
      const [w, a, r] = attackPhaseTicks(hit);
      if (t >= w && t < w + a) {
        const lungeSpeed = hit.lungePx / (a * TICK_DT_SEC);
        c.velX[eid] = p.dirX * lungeSpeed;
        c.velY[eid] = p.dirY * lungeSpeed;
        meleeSweep(
          state,
          hit.reachPx,
          hit.arcDeg,
          hit.damage,
          hit.knockback,
          hit.poiseDamage,
          hit.hitstop,
          'attack',
        );
      } else {
        controlMovement(state, input, BRAND_BLADE.attackMoveFactor);
      }
      if (t + 1 >= w + a + r) {
        p.action = PlayerAction.Idle;
        p.comboWindowTicks =
          p.comboIndex < BRAND_BLADE.combo.length - 1
            ? secondsToTicks(BRAND_BLADE.comboWindowSec)
            : 0;
      }
      break;
    }
    case PlayerAction.Special: {
      const s = BRAND_BLADE.special;
      const [w, a, r] = specialPhaseTicks();
      controlMovement(state, input, s.moveFactor);
      if (t >= w && t < w + a) {
        meleeSweep(
          state,
          s.radiusPx,
          360,
          s.damage,
          s.knockback,
          s.poiseDamage,
          'heavy',
          'special',
        );
      }
      if (t + 1 >= w + a + r) p.action = PlayerAction.Idle;
      break;
    }
  }
}
