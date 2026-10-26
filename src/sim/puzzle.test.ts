import { describe, expect, it } from 'vitest';
import { PUZZLES, puzzleById } from '../content/puzzles';
import { PUZZLE_TUNING } from '../content/puzzles/tuning';
import { definePuzzle, type PuzzleDef } from '../content/schema';
import { Button, createInputFrame, type InputFrame } from '../shared/input-frame';
import { Ev } from './events';
import { hashSim } from './hash';
import { PlayerAction } from './player-state';
import { createRun, roomSetupFor } from './run/run-state';
import { createSim, type SimState, stepSim } from './sim';

/** A sim for one puzzle room, built the way a run builds it. */
function puzzleSim(def: PuzzleDef, seed = 1): SimState {
  const run = createRun(seed);
  const node = { id: 0, layer: 1, x: 0.5, type: 'puzzle' as const, next: [] };
  const setup = roomSetupFor(run, node);
  return createSim(seed, {
    ...setup,
    template: {
      id: def.id,
      widthPx: def.widthPx,
      heightPx: def.heightPx,
      types: ['puzzle'],
      obstacles: def.obstacles,
      playerStart: def.playerStart,
      exit: def.exit,
      spawnPoints: [],
    },
    puzzle: def,
  });
}

/** Drives the player like a person would: walk, swing, shoot, dash. */
class Driver {
  readonly input: InputFrame = createInputFrame();
  readonly seen = new Set<number>();
  constructor(readonly sim: SimState) {}

  get x(): number {
    return this.sim.c.posX[this.sim.playerEid] ?? 0;
  }

  get y(): number {
    return this.sim.c.posY[this.sim.playerEid] ?? 0;
  }

  step(ticks = 1): void {
    for (let i = 0; i < ticks; i++) {
      stepSim(this.sim, this.input);
      for (let k = 0; k < this.sim.events.count; k++) {
        this.seen.add(this.sim.events.items[k]?.type ?? 0);
      }
      this.sim.events.count = 0;
      this.input.pressed = 0;
    }
  }

  /** Walks in a straight line; fails the test if the way is blocked. */
  walkTo(x: number, y: number, maxTicks = 600): void {
    for (let t = 0; t < maxTicks; t++) {
      const dx = x - this.x;
      const dy = y - this.y;
      const d = Math.hypot(dx, dy);
      if (d < 4) break;
      const s = Math.min(1, d / 30);
      this.input.moveX = (dx / d) * s;
      this.input.moveY = (dy / d) * s;
      this.step();
    }
    this.input.moveX = 0;
    this.input.moveY = 0;
    this.step(2);
    expect(Math.hypot(x - this.x, y - this.y), `walk to ${x},${y}`).toBeLessThan(8);
  }

  private aimAt(x: number, y: number): void {
    const dx = x - this.x;
    const dy = y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    this.input.aimX = dx / d;
    this.input.aimY = dy / d;
    this.input.hasAim = true;
  }

  strike(x: number, y: number): void {
    this.aimAt(x, y);
    this.input.pressed = Button.Attack;
    this.input.held = Button.Attack;
    this.step();
    this.input.held = 0;
    this.input.hasAim = false;
    this.step(40);
  }

  shoot(x: number, y: number): void {
    this.aimAt(x, y);
    this.input.pressed = Button.Cast;
    this.input.held = Button.Cast;
    this.step();
    this.input.held = 0;
    this.input.hasAim = false;
    this.step(50);
  }

  dash(dirX: number, dirY: number): void {
    this.input.moveX = dirX;
    this.input.moveY = dirY;
    this.input.pressed = Button.Dash;
    this.input.held = Button.Dash;
    this.step();
    this.input.held = 0;
    while (this.sim.player.action === PlayerAction.Dash) this.step();
    this.input.moveX = 0;
    this.input.moveY = 0;
    this.step(2);
  }

  /** Leans into a direction until `done` holds (pushing a block). */
  lean(dirX: number, dirY: number, done: () => boolean, maxTicks = 900): void {
    this.input.moveX = dirX;
    this.input.moveY = dirY;
    for (let t = 0; t < maxTicks && !done(); t++) this.step();
    this.input.moveX = 0;
    this.input.moveY = 0;
    this.step(12);
    expect(done(), 'lean').toBe(true);
  }
}

function blockAt(sim: SimState, index: number): { x: number; y: number } {
  const p = sim.room.puzzle;
  return { x: p?.x[index] ?? 0, y: p?.y[index] ?? 0 };
}

/**
 * Hand-written solutions, played through the real sim: the "solver" of ROADMAP M6.0. Every
 * puzzle in content must have one, so a layout change that breaks solvability fails here.
 */
const SOLUTIONS: Record<string, (d: Driver) => void> = {
  four_bowls: (d) => {
    d.walkTo(260, 552);
    d.strike(260, 500);
    d.walkTo(500, 752);
    d.strike(500, 700);
    d.walkTo(740, 552);
    d.strike(740, 500);
    d.walkTo(500, 352);
    d.strike(500, 300);
    d.walkTo(600, 300);
    d.walkTo(500, 110);
  },
  rune_path: (d) => {
    d.walkTo(250, 760);
    d.walkTo(750, 720);
    d.walkTo(500, 520);
    d.walkTo(250, 330);
    d.walkTo(750, 280);
    d.walkTo(500, 110);
  },
  ember_switch: (d) => {
    d.walkTo(166, 860);
    d.strike(120, 860);
    d.walkTo(500, 560);
    d.dash(0, -1);
    d.walkTo(500, 140);
    d.walkTo(346, 104);
    d.strike(300, 100);
    d.walkTo(500, 110);
  },
  crystal_island: (d) => {
    d.walkTo(500, 760);
    d.shoot(500, 450);
    d.walkTo(150, 760);
    d.walkTo(150, 150);
    d.walkTo(500, 110);
  },
  stone_plates: (d) => {
    d.walkTo(372, 690);
    d.lean(0, -1, () => blockAt(d.sim, 0).y <= 372.5);
    d.walkTo(560, 628);
    d.lean(1, 0, () => blockAt(d.sim, 1).x >= 819.5);
    d.walkTo(500, 300);
    d.walkTo(500, 110);
  },
  twin_fires: (d) => {
    d.walkTo(690, 620);
    d.lean(-1, 0, () => blockAt(d.sim, 4).x <= 500.5);
    d.walkTo(560, 500);
    d.walkTo(160, 420);
    d.walkTo(160, 190);
    d.strike(160, 140);
    d.walkTo(160, 420);
    d.walkTo(650, 440);
    d.shoot(900, 620);
    d.walkTo(840, 420);
    d.walkTo(840, 190);
    d.strike(840, 140);
    d.walkTo(840, 420);
    d.walkTo(500, 420);
    d.walkTo(500, 110);
  },
};

describe('puzzle rooms (ROADMAP M6.0)', () => {
  it('has a solution for every puzzle, and each one solves its room', () => {
    for (const def of PUZZLES) {
      const solve = SOLUTIONS[def.id];
      expect(solve, `solution for ${def.id}`).toBeDefined();
      if (!solve) continue;
      const sim = puzzleSim(def);
      const d = new Driver(sim);
      expect(sim.room.exitOpen).toBe(false);
      solve(d);
      expect(sim.room.puzzle?.solved, def.id).toBe(true);
      expect(sim.room.exitOpen, def.id).toBe(true);
      expect(d.seen.has(Ev.PuzzleSolved), def.id).toBe(true);
      // Solving never costs health.
      expect(sim.c.hp[sim.playerEid], def.id).toBe(sim.c.maxHp[sim.playerEid]);
      expect(sim.room.exitReached, `${def.id} exit`).toBe(true);
    }
  });

  it('stays shut while nothing is solved', () => {
    for (const def of PUZZLES) {
      const sim = puzzleSim(def);
      new Driver(sim).step(600);
      expect(sim.room.exitOpen, def.id).toBe(false);
    }
  });

  it('puts out an ordered sequence on a wrong step and counts the mistake', () => {
    const def = puzzleById('four_bowls') as PuzzleDef;
    const sim = puzzleSim(def);
    const d = new Driver(sim);
    d.walkTo(260, 552);
    d.strike(260, 500);
    expect(sim.room.puzzle?.active[0]).toBe(1);
    d.walkTo(740, 552);
    d.strike(740, 500);
    expect(d.seen.has(Ev.PuzzleFail)).toBe(true);
    expect(sim.room.puzzle?.active[0]).toBe(0);
    expect(sim.room.puzzle?.fails).toBe(1);
  });

  it('gives Iskra a hint after repeated mistakes', () => {
    const def = puzzleById('rune_path') as PuzzleDef;
    const sim = puzzleSim(def);
    const d = new Driver(sim);
    for (let i = 0; i < PUZZLE_TUNING.hintAfterFails; i++) {
      d.walkTo(750, 720);
      d.walkTo(750, 620);
    }
    expect(sim.room.puzzle?.fails).toBe(PUZZLE_TUNING.hintAfterFails);
    expect(d.seen.has(Ev.PuzzleHint)).toBe(true);
  });

  it('drops a player who walks into a chasm back to safe ground, never below 1 HP', () => {
    const def = puzzleById('ember_switch') as PuzzleDef;
    const sim = puzzleSim(def);
    const d = new Driver(sim);
    d.walkTo(500, 600);
    const hp = sim.c.hp[sim.playerEid] ?? 0;
    const fallInto = () => {
      d.seen.clear();
      d.input.moveY = -1;
      for (let t = 0; t < 120 && !d.seen.has(Ev.PuzzleFall); t++) d.step();
      d.input.moveY = 0;
    };
    fallInto();
    expect(d.seen.has(Ev.PuzzleFall)).toBe(true);
    expect(sim.c.hp[sim.playerEid]).toBe(hp - PUZZLE_TUNING.fallDamage);
    expect(d.y).toBeGreaterThan(530);
    sim.c.hp[sim.playerEid] = 2;
    fallInto();
    expect(sim.c.hp[sim.playerEid]).toBe(1);
  });

  it('closes a timed crystal gate again', () => {
    const def = puzzleById('ember_switch') as PuzzleDef;
    const sim = puzzleSim(def);
    const d = new Driver(sim);
    d.walkTo(166, 860);
    d.strike(120, 860);
    expect(sim.room.puzzle?.groupActive[0]).toBe(1);
    d.step(60 * 7);
    expect(sim.room.puzzle?.groupActive[0]).toBe(0);
  });

  it('resets blocks with the reset stone', () => {
    const def = puzzleById('stone_plates') as PuzzleDef;
    const sim = puzzleSim(def);
    const d = new Driver(sim);
    d.walkTo(372, 690);
    d.lean(0, -1, () => blockAt(sim, 0).y <= 564.5);
    d.walkTo(900, 846);
    d.strike(900, 900);
    expect(d.seen.has(Ev.PuzzleReset)).toBe(true);
    expect(blockAt(sim, 0)).toEqual({ x: 372, y: 628 });
  });

  it('is deterministic', () => {
    const def = puzzleById('twin_fires') as PuzzleDef;
    const hashes = [1, 2].map(() => {
      const sim = puzzleSim(def, 7);
      SOLUTIONS.twin_fires?.(new Driver(sim));
      return hashSim(sim);
    });
    expect(hashes[0]).toBe(hashes[1]);
  });

  it('builds puzzle nodes from the world pool without repeats in one run', () => {
    const run = createRun(3);
    const nodes = [0, 1, 2].map((id) => ({
      id,
      layer: 1,
      x: 0.5,
      type: 'puzzle' as const,
      next: [],
    }));
    run.map.nodes.push(...nodes.map((n, i) => ({ ...n, id: run.map.nodes.length + i })));
    const ids = run.map.nodes
      .filter((n) => n.type === 'puzzle')
      .map((n) => roomSetupFor(run, n).puzzle?.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toBeDefined();
  });

  it('rejects broken puzzle data', () => {
    const base = puzzleById('four_bowls') as PuzzleDef;
    expect(() => definePuzzle({ ...base, goal: 'nothing' })).toThrow(/goal/);
    expect(() =>
      definePuzzle({
        ...base,
        elements: [
          { kind: 'brazier', x: 100, y: 100, group: 'fire', order: 1 },
          { kind: 'brazier', x: 200, y: 100, group: 'fire', order: 3 },
        ],
      }),
    ).toThrow(/1\.\.n/);
    expect(() =>
      definePuzzle({
        ...base,
        elements: [
          { kind: 'brazier', x: 100, y: 100, group: 'fire' },
          { kind: 'gate', x: 0, y: 0, w: 10, h: 10, opens: 'nowhere' },
        ],
      }),
    ).toThrow(/unknown group/);
  });
});
