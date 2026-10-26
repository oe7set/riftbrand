import { PUZZLE_TUNING } from '../content/puzzles/tuning';
import type { PuzzleDef } from '../content/schema';
import { Ev, PieceCode, pushEvent } from './events';
import { PlayerAction } from './player-state';
import type { RoomState } from './room';
import type { SimState } from './sim';
import { clearRoom } from './systems/waves';
import { secondsToTicks } from './time';

/**
 * Puzzle rooms (ROADMAP M6.0). The pieces are few and fixed per room, so they live in flat
 * arrays next to the room geometry rather than as entities. Gates and blocks become solid by
 * being written into the room's rect list after the static obstacles every tick; braziers,
 * crystals and reset stones are solid circles appended once at load.
 */
export interface PuzzleState {
  readonly def: PuzzleDef;
  readonly count: number;
  /** PieceCode per piece. */
  readonly kind: Uint8Array;
  /** Group index per piece (-1 = none), and its order in the group (0 = unordered). */
  readonly group: Int16Array;
  readonly order: Int16Array;
  /** Gate pieces: index of the group that opens them. */
  readonly opens: Int16Array;
  readonly active: Uint8Array;
  /** Crystals with holdSec: ticks until they switch off again. */
  readonly holdTicks: Int32Array;
  /** Last player swing that hit this piece, so one swing toggles a crystal once. */
  readonly lastSwing: Int32Array;
  /** Piece positions; blocks move, everything else stays. */
  readonly x: Float64Array;
  readonly y: Float64Array;
  /** Block slides: start, target and ticks left. */
  readonly fromX: Float64Array;
  readonly fromY: Float64Array;
  readonly toX: Float64Array;
  readonly toY: Float64Array;
  readonly slideTicks: Int32Array;
  /** Rune pieces: the player stood on it last tick (activation on entry only). */
  readonly occupied: Uint8Array;
  readonly groupCount: number;
  readonly goalGroup: number;
  readonly groupActive: Uint8Array;
  /** Next expected order per group (1-based). */
  readonly groupNext: Int16Array;
  /** Highest order per group (0 = unordered group). */
  readonly groupMaxOrder: Int16Array;
  /** Block the player is leaning into, and for how long. */
  pushBlock: number;
  pushDirX: number;
  pushDirY: number;
  pushTicks: number;
  solved: boolean;
  fails: number;
  hinted: boolean;
  /** Ticks since the last progress, for the hint. */
  idleTicks: number;
  /** Last spot on solid ground, where a fall puts the player back. */
  safeX: number;
  safeY: number;
  /** Static obstacles end here in the room's rect list; gates and blocks follow. */
  readonly staticRects: number;
}

const KIND_CODE: Record<PuzzleDef['elements'][number]['kind'], number> = {
  brazier: PieceCode.Brazier,
  crystal: PieceCode.Crystal,
  plate: PieceCode.Plate,
  rune: PieceCode.Rune,
  block: PieceCode.Block,
  gate: PieceCode.Gate,
  chasm: PieceCode.Chasm,
  reset: PieceCode.Reset,
};

/** Sets up the pieces of a puzzle room; call after the static obstacles are loaded. */
export function loadPuzzle(room: RoomState, def: PuzzleDef): PuzzleState {
  const n = def.elements.length;
  const groupNames: string[] = [];
  const groupOf = (name: string): number => {
    let g = groupNames.indexOf(name);
    if (g < 0) g = groupNames.push(name) - 1;
    return g;
  };
  for (const e of def.elements) if ('group' in e) groupOf(e.group);
  const groupCount = groupNames.length;
  const p: PuzzleState = {
    def,
    count: n,
    kind: new Uint8Array(n),
    group: new Int16Array(n).fill(-1),
    order: new Int16Array(n),
    opens: new Int16Array(n).fill(-1),
    active: new Uint8Array(n),
    holdTicks: new Int32Array(n),
    lastSwing: new Int32Array(n).fill(-1),
    x: new Float64Array(n),
    y: new Float64Array(n),
    fromX: new Float64Array(n),
    fromY: new Float64Array(n),
    toX: new Float64Array(n),
    toY: new Float64Array(n),
    slideTicks: new Int32Array(n),
    occupied: new Uint8Array(n),
    groupCount,
    goalGroup: groupOf(def.goal),
    groupActive: new Uint8Array(groupCount),
    groupNext: new Int16Array(groupCount).fill(1),
    groupMaxOrder: new Int16Array(groupCount),
    pushBlock: -1,
    pushDirX: 0,
    pushDirY: 0,
    pushTicks: 0,
    solved: false,
    fails: 0,
    hinted: false,
    idleTicks: 0,
    safeX: def.playerStart.x,
    safeY: def.playerStart.y,
    staticRects: room.rectCount,
  };
  def.elements.forEach((e, i) => {
    p.kind[i] = KIND_CODE[e.kind];
    p.x[i] = e.x;
    p.y[i] = e.y;
    if ('group' in e) {
      const g = groupOf(e.group);
      p.group[i] = g;
      const order = 'order' in e ? (e.order ?? 0) : 0;
      p.order[i] = order;
      if (order > (p.groupMaxOrder[g] as number)) p.groupMaxOrder[g] = order;
    }
    if (e.kind === 'gate') p.opens[i] = groupOf(e.opens);
  });
  appendPieceCircles(room, p);
  writeDynamicRects(room, p);
  return p;
}

function isHittable(kind: number): boolean {
  return kind === PieceCode.Brazier || kind === PieceCode.Crystal || kind === PieceCode.Reset;
}

/** Hittable pieces are solid: nobody walks through a brazier. */
function appendPieceCircles(room: RoomState, p: PuzzleState): void {
  for (let i = 0; i < p.count; i++) {
    if (!isHittable(p.kind[i] as number)) continue;
    if (room.circleCount * 3 + 3 > room.circles.length) break;
    const k = room.circleCount++ * 3;
    room.circles[k] = p.x[i] as number;
    room.circles[k + 1] = p.y[i] as number;
    room.circles[k + 2] = PUZZLE_TUNING.pieceRadiusPx * 0.8;
  }
}

function gateOpen(p: PuzzleState, i: number): boolean {
  const g = p.opens[i] as number;
  // The goal's gates stay open once solved, even if a plate is released afterwards.
  return p.groupActive[g] === 1 || (p.solved && g === p.goalGroup);
}

/** Rewrites the dynamic part of the rect list: closed gates and blocks. */
function writeDynamicRects(room: RoomState, p: PuzzleState): void {
  room.rectCount = p.staticRects;
  const max = room.rects.length / 4;
  const half = PUZZLE_TUNING.blockSizePx / 2;
  const elements = p.def.elements;
  for (let i = 0; i < p.count && room.rectCount < max; i++) {
    const kind = p.kind[i] as number;
    if (kind === PieceCode.Gate) {
      if (gateOpen(p, i)) continue;
      const e = elements[i];
      if (e?.kind !== 'gate') continue;
      const k = room.rectCount++ * 4;
      room.rects[k] = e.x;
      room.rects[k + 1] = e.y;
      room.rects[k + 2] = e.w;
      room.rects[k + 3] = e.h;
    } else if (kind === PieceCode.Block) {
      const k = room.rectCount++ * 4;
      room.rects[k] = (p.x[i] as number) - half;
      room.rects[k + 1] = (p.y[i] as number) - half;
      room.rects[k + 2] = half * 2;
      room.rects[k + 3] = half * 2;
    }
  }
}

function changed(state: SimState, p: PuzzleState, i: number): void {
  const e = pushEvent(state.events, Ev.PieceChanged, p.x[i] as number, p.y[i] as number);
  if (e) {
    e.value = p.kind[i] as number;
    e.flags = p.active[i] as number;
    e.amount = p.order[i] as number;
  }
  p.idleTicks = 0;
}

/**
 * Switches a brazier or rune on. Ordered pieces must come in turn; a wrong one puts the
 * whole sequence out, so the player sees at once that order matters.
 */
function activate(state: SimState, p: PuzzleState, i: number): void {
  if (p.active[i] === 1) return;
  const g = p.group[i] as number;
  const order = p.order[i] as number;
  if (order > 0 && g >= 0 && order !== p.groupNext[g]) {
    for (let j = 0; j < p.count; j++) {
      if (p.group[j] !== g || (p.order[j] as number) === 0) continue;
      p.active[j] = 0;
    }
    p.groupNext[g] = 1;
    p.fails++;
    const e = pushEvent(state.events, Ev.PuzzleFail, p.x[i] as number, p.y[i] as number);
    if (e) e.value = p.kind[i] as number;
    return;
  }
  p.active[i] = 1;
  if (order > 0 && g >= 0) p.groupNext[g] = order + 1;
  changed(state, p, i);
}

/** Puts every piece back to its start (reset stone). */
export function resetPuzzle(state: SimState, p: PuzzleState): void {
  const elements = p.def.elements;
  for (let i = 0; i < p.count; i++) {
    p.active[i] = 0;
    p.holdTicks[i] = 0;
    p.slideTicks[i] = 0;
    const e = elements[i];
    if (e) {
      p.x[i] = e.x;
      p.y[i] = e.y;
    }
  }
  p.groupNext.fill(1);
  p.pushBlock = -1;
  p.pushTicks = 0;
  p.idleTicks = 0;
  pushEvent(state.events, Ev.PuzzleReset, state.room.exitX, state.room.exitY);
}

function hitPiece(state: SimState, p: PuzzleState, i: number): void {
  const kind = p.kind[i] as number;
  if (kind === PieceCode.Brazier) activate(state, p, i);
  else if (kind === PieceCode.Reset) resetPuzzle(state, p);
  else if (kind === PieceCode.Crystal) {
    const e = p.def.elements[i];
    const holdSec = e?.kind === 'crystal' ? e.holdSec : undefined;
    if (holdSec !== undefined) {
      p.holdTicks[i] = secondsToTicks(holdSec);
      if (p.active[i] === 1) return;
      p.active[i] = 1;
    } else p.active[i] = p.active[i] === 1 ? 0 : 1;
    changed(state, p, i);
  }
}

/**
 * Blade swings light braziers, toggle crystals and press reset stones. Each swing counts once
 * per piece. `arcDeg` >= 360 hits all around.
 */
export function puzzleMelee(
  state: SimState,
  reachPx: number,
  arcDeg: number,
  dirX: number,
  dirY: number,
  swingId: number,
): void {
  const p = state.room.puzzle;
  if (!p) return;
  const c = state.c;
  const px = c.posX[state.playerEid] as number;
  const py = c.posY[state.playerEid] as number;
  const cosHalf = Math.cos(((Math.min(arcDeg, 360) / 2) * Math.PI) / 180);
  const r = PUZZLE_TUNING.pieceRadiusPx;
  for (let i = 0; i < p.count; i++) {
    if (!isHittable(p.kind[i] as number) || p.lastSwing[i] === swingId) continue;
    const dx = (p.x[i] as number) - px;
    const dy = (p.y[i] as number) - py;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > reachPx + r) continue;
    if (arcDeg < 360 && dist > r && (dx * dirX + dy * dirY) / dist < cosHalf) continue;
    p.lastSwing[i] = swingId;
    hitPiece(state, p, i);
  }
}

/** A player shot at (x, y) hits a piece: true when it should stop there. */
export function puzzleShot(state: SimState, x: number, y: number, r: number): boolean {
  const p = state.room.puzzle;
  if (!p) return false;
  const reach = r + PUZZLE_TUNING.pieceRadiusPx;
  for (let i = 0; i < p.count; i++) {
    if (!isHittable(p.kind[i] as number)) continue;
    const dx = (p.x[i] as number) - x;
    const dy = (p.y[i] as number) - y;
    if (dx * dx + dy * dy > reach * reach) continue;
    hitPiece(state, p, i);
    return true;
  }
  return false;
}

function insideRect(
  x: number,
  y: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  inset: number,
): boolean {
  return x > rx + inset && x < rx + rw - inset && y > ry + inset && y < ry + rh - inset;
}

/** Squares overlap (centre-based, half sizes) a rect, with a small tolerance. */
function boxHitsRect(
  cx: number,
  cy: number,
  half: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): boolean {
  return (
    cx + half > rx + 1 && cx - half < rx + rw - 1 && cy + half > ry + 1 && cy - half < ry + rh - 1
  );
}

/** Whether a block may move to (tx, ty): inside the room, clear of walls, pieces and drops. */
function blockFree(state: SimState, p: PuzzleState, self: number, tx: number, ty: number): boolean {
  const half = PUZZLE_TUNING.blockSizePx / 2;
  const room = state.room;
  if (tx - half < 0 || ty - half < 0) return false;
  if (tx + half > state.arenaWidthPx || ty + half > state.arenaHeightPx) return false;
  for (let i = 0; i < p.staticRects; i++) {
    const k = i * 4;
    if (
      boxHitsRect(
        tx,
        ty,
        half,
        room.rects[k] as number,
        room.rects[k + 1] as number,
        room.rects[k + 2] as number,
        room.rects[k + 3] as number,
      )
    )
      return false;
  }
  for (let i = 0; i < room.circleCount; i++) {
    const k = i * 3;
    const cx = Math.max(tx - half, Math.min(room.circles[k] as number, tx + half));
    const cy = Math.max(ty - half, Math.min(room.circles[k + 1] as number, ty + half));
    const dx = (room.circles[k] as number) - cx;
    const dy = (room.circles[k + 1] as number) - cy;
    const cr = room.circles[k + 2] as number;
    if (dx * dx + dy * dy < cr * cr) return false;
  }
  const elements = p.def.elements;
  for (let i = 0; i < p.count; i++) {
    if (i === self) continue;
    const kind = p.kind[i] as number;
    if (kind === PieceCode.Block) {
      const ox = p.slideTicks[i] ? (p.toX[i] as number) : (p.x[i] as number);
      const oy = p.slideTicks[i] ? (p.toY[i] as number) : (p.y[i] as number);
      if (Math.abs(ox - tx) < half * 2 - 1 && Math.abs(oy - ty) < half * 2 - 1) return false;
      continue;
    }
    const e = elements[i];
    if (!e || (e.kind !== 'gate' && e.kind !== 'chasm')) continue;
    if (e.kind === 'gate' && gateOpen(p, i)) continue;
    if (boxHitsRect(tx, ty, half, e.x, e.y, e.w, e.h)) return false;
  }
  return true;
}

/**
 * Walking into a block pushes it one block length once the player has leant into it for a
 * moment. Only straight pushes count, so blocks stay on their grid.
 */
function pushBlocks(state: SimState, p: PuzzleState, px: number, py: number): void {
  const c = state.c;
  const eid = state.playerEid;
  const vx = c.velX[eid] as number;
  const vy = c.velY[eid] as number;
  const pr = c.radius[eid] as number;
  const half = PUZZLE_TUNING.blockSizePx / 2;
  const ax = Math.abs(vx);
  const ay = Math.abs(vy);
  let dirX = 0;
  let dirY = 0;
  // Leaning needs clear intent along one axis.
  if (ax > 30 && ax > ay * 2) dirX = vx > 0 ? 1 : -1;
  else if (ay > 30 && ay > ax * 2) dirY = vy > 0 ? 1 : -1;
  let target = -1;
  if (dirX !== 0 || dirY !== 0) {
    for (let i = 0; i < p.count; i++) {
      if (p.kind[i] !== PieceCode.Block || (p.slideTicks[i] as number) > 0) continue;
      const bx = p.x[i] as number;
      const by = p.y[i] as number;
      // Touching the face opposite the push direction, roughly centred on it.
      const gapX = dirX !== 0 ? (bx - px) * dirX - half - pr : 0;
      const gapY = dirY !== 0 ? (by - py) * dirY - half - pr : 0;
      const along = dirX !== 0 ? Math.abs(py - by) : Math.abs(px - bx);
      const gap = dirX !== 0 ? gapX : gapY;
      if (gap > -4 && gap < 4 && along < half) {
        target = i;
        break;
      }
    }
  }
  if (target < 0 || target !== p.pushBlock || dirX !== p.pushDirX || dirY !== p.pushDirY) {
    p.pushBlock = target;
    p.pushDirX = dirX;
    p.pushDirY = dirY;
    p.pushTicks = 0;
    return;
  }
  p.pushTicks++;
  if (p.pushTicks < secondsToTicks(PUZZLE_TUNING.pushDelaySec)) return;
  p.pushTicks = 0;
  const step = PUZZLE_TUNING.blockSizePx;
  const tx = (p.x[target] as number) + dirX * step;
  const ty = (p.y[target] as number) + dirY * step;
  if (!blockFree(state, p, target, tx, ty)) return;
  p.fromX[target] = p.x[target] as number;
  p.fromY[target] = p.y[target] as number;
  p.toX[target] = tx;
  p.toY[target] = ty;
  p.slideTicks[target] = Math.max(1, secondsToTicks(PUZZLE_TUNING.blockSlideSec));
  p.idleTicks = 0;
  const e = pushEvent(state.events, Ev.BlockPushed, p.x[target] as number, p.y[target] as number);
  if (e) {
    e.dirX = dirX;
    e.dirY = dirY;
  }
}

function slideBlocks(p: PuzzleState): void {
  const total = Math.max(1, secondsToTicks(PUZZLE_TUNING.blockSlideSec));
  for (let i = 0; i < p.count; i++) {
    const left = p.slideTicks[i] as number;
    if (left <= 0) continue;
    p.slideTicks[i] = left - 1;
    const t = 1 - (left - 1) / total;
    p.x[i] = (p.fromX[i] as number) + ((p.toX[i] as number) - (p.fromX[i] as number)) * t;
    p.y[i] = (p.fromY[i] as number) + ((p.toY[i] as number) - (p.fromY[i] as number)) * t;
  }
}

/** Chasms: off solid ground without a dash means falling back to the last safe spot. */
function chasms(state: SimState, p: PuzzleState, px: number, py: number, dashing: boolean): void {
  const c = state.c;
  const eid = state.playerEid;
  const pr = c.radius[eid] as number;
  const elements = p.def.elements;
  let inside = false;
  let near = false;
  for (let i = 0; i < p.count; i++) {
    const e = elements[i];
    if (e?.kind !== 'chasm') continue;
    if (insideRect(px, py, e.x, e.y, e.w, e.h, pr * 0.3)) inside = true;
    if (insideRect(px, py, e.x, e.y, e.w, e.h, -pr - 4)) near = true;
  }
  if (dashing) return;
  if (!inside) {
    if (!near) {
      p.safeX = px;
      p.safeY = py;
    }
    return;
  }
  const hp = c.hp[eid] as number;
  const damage = state.debug.godMode ? 0 : Math.min(PUZZLE_TUNING.fallDamage, hp - 1);
  c.hp[eid] = hp - damage;
  c.posX[eid] = p.safeX;
  c.posY[eid] = p.safeY;
  c.prevX[eid] = p.safeX;
  c.prevY[eid] = p.safeY;
  c.velX[eid] = 0;
  c.velY[eid] = 0;
  c.kbX[eid] = 0;
  c.kbY[eid] = 0;
  const e = pushEvent(state.events, Ev.PuzzleFall, p.safeX, p.safeY);
  if (e) e.amount = damage;
}

function pads(state: SimState, p: PuzzleState, px: number, py: number, dashing: boolean): void {
  const pad = PUZZLE_TUNING.padHalfPx;
  const half = PUZZLE_TUNING.blockSizePx / 2;
  for (let i = 0; i < p.count; i++) {
    const kind = p.kind[i] as number;
    if (kind !== PieceCode.Plate && kind !== PieceCode.Rune) continue;
    const x = p.x[i] as number;
    const y = p.y[i] as number;
    const onIt = !dashing && Math.abs(px - x) < pad && Math.abs(py - y) < pad;
    if (kind === PieceCode.Rune) {
      if (onIt && p.occupied[i] === 0) activate(state, p, i);
      p.occupied[i] = onIt ? 1 : 0;
      continue;
    }
    let pressed = onIt;
    for (let j = 0; j < p.count && !pressed; j++) {
      if (p.kind[j] !== PieceCode.Block) continue;
      if (Math.abs((p.x[j] as number) - x) < half && Math.abs((p.y[j] as number) - y) < half) {
        pressed = true;
      }
    }
    const now = pressed ? 1 : 0;
    if (now !== p.active[i]) {
      p.active[i] = now;
      changed(state, p, i);
    }
  }
}

function crystalTimers(state: SimState, p: PuzzleState): void {
  for (let i = 0; i < p.count; i++) {
    const t = p.holdTicks[i] as number;
    if (t <= 0) continue;
    p.holdTicks[i] = t - 1;
    if (t - 1 === 0 && p.active[i] === 1) {
      p.active[i] = 0;
      changed(state, p, i);
    }
  }
}

function updateGroups(state: SimState, p: PuzzleState): void {
  const elements = p.def.elements;
  for (let g = 0; g < p.groupCount; g++) {
    let all = 1;
    for (let i = 0; i < p.count; i++) {
      if (p.group[i] === g && p.active[i] === 0) {
        all = 0;
        break;
      }
    }
    if (all === p.groupActive[g]) continue;
    p.groupActive[g] = all;
    for (let i = 0; i < p.count; i++) {
      if (p.opens[i] !== g) continue;
      const e = elements[i];
      if (e?.kind !== 'gate') continue;
      const ev = pushEvent(state.events, Ev.GateChanged, e.x + e.w / 2, e.y + e.h / 2);
      if (ev) ev.flags = gateOpen(p, i) ? 1 : 0;
    }
  }
}

/** Runs after movement and projectiles: pads, drops, blocks, gates, and the solve check. */
export function puzzleSystem(state: SimState): void {
  const p = state.room.puzzle;
  if (!p || state.gameOver) return;
  const c = state.c;
  const eid = state.playerEid;
  const px = c.posX[eid] as number;
  const py = c.posY[eid] as number;
  const dashing = state.player.action === PlayerAction.Dash;
  crystalTimers(state, p);
  if (!p.solved) {
    pads(state, p, px, py, dashing);
    pushBlocks(state, p, px, py);
  }
  slideBlocks(p);
  chasms(state, p, px, py, dashing);
  updateGroups(state, p);
  if (!p.solved && p.groupActive[p.goalGroup] === 1) {
    p.solved = true;
    pushEvent(state.events, Ev.PuzzleSolved, state.room.exitX, state.room.exitY);
    clearRoom(state);
  }
  writeDynamicRects(state.room, p);
  if (p.solved || p.hinted) return;
  p.idleTicks++;
  if (
    p.fails >= PUZZLE_TUNING.hintAfterFails ||
    p.idleTicks >= secondsToTicks(PUZZLE_TUNING.hintAfterSec)
  ) {
    p.hinted = true;
    pushEvent(state.events, Ev.PuzzleHint, px, py);
  }
}
