import { describe, expect, it } from 'vitest';
import {
  createRoomState,
  loadObstacles,
  overlapsObstacle,
  pushOut,
  pushOutOfObstacles,
} from './room';

describe('room obstacles', () => {
  const room = createRoomState();
  loadObstacles(room, [
    { kind: 'rect', x: 100, y: 100, w: 100, h: 50 },
    { kind: 'circle', x: 400, y: 400, r: 30 },
  ]);

  it('pushes circles out of rect edges', () => {
    pushOutOfObstacles(room, 150, 95, 10);
    expect(pushOut.hit).toBe(true);
    expect(pushOut.y).toBeCloseTo(90);
    expect(pushOut.x).toBeCloseTo(150);
  });

  it('pushes a centre inside a rect through the nearest side', () => {
    pushOutOfObstacles(room, 195, 125, 10);
    expect(pushOut.x).toBeCloseTo(210);
  });

  it('pushes circles out of circles', () => {
    pushOutOfObstacles(room, 400, 360, 15);
    expect(pushOut.y).toBeCloseTo(355);
  });

  it('leaves free space alone', () => {
    pushOutOfObstacles(room, 600, 600, 20);
    expect(pushOut.hit).toBe(false);
    expect(overlapsObstacle(room, 300, 300, 5)).toBe(false);
    expect(overlapsObstacle(room, 410, 410, 5)).toBe(true);
  });
});

describe('net doors (ROADMAP M6.0b)', () => {
  it('opens doors after the fight, needs a key for locked ones and never exits on arrival', async () => {
    const { createRun, roomSetupFor } = await import('./run/run-state');
    const { createInputFrame } = await import('../shared/input-frame');
    const { createSim, stepSim } = await import('./sim');
    const { Ev } = await import('./events');
    const run = createRun(5, undefined, [], undefined, undefined, true);
    const node = run.map.nodes[0];
    if (!node || !run.net) throw new Error('net run expected');
    const d = (node.doors ?? []).findIndex((n) => n >= 0);
    const setup = roomSetupFor(run, node);
    const door = setup.doors?.find((x) => x.dir === d);
    if (!door) throw new Error('door expected');
    const lockedSetup = {
      ...setup,
      entryDir: d,
      doors: setup.doors?.map((x) => (x.dir === d ? { ...x, locked: true } : x)),
    };
    const walkInto = (keys: number) => {
      const sim = createSim(1, { ...lockedSetup, keys });
      const input = createInputFrame();
      const seen: number[] = [];
      // Arrival right next to the door: standing still must not leave.
      for (let t = 0; t < 30; t++) stepSim(sim, input);
      expect(sim.room.exitReached).toBe(false);
      for (let t = 0; t < 240 && !sim.room.exitReached; t++) {
        const dx = door.x - (sim.c.posX[sim.playerEid] ?? 0);
        const dy = door.y - (sim.c.posY[sim.playerEid] ?? 0);
        const len = Math.hypot(dx, dy) || 1;
        // Step back first so the door arms, then walk into it.
        const back = t < 40 ? -1 : 1;
        input.moveX = (dx / len) * back;
        input.moveY = (dy / len) * back;
        stepSim(sim, input);
        for (let k = 0; k < sim.events.count; k++) seen.push(sim.events.items[k]?.type ?? 0);
        sim.events.count = 0;
      }
      return { sim, seen };
    };
    const noKey = walkInto(0);
    expect(noKey.sim.room.exitReached).toBe(false);
    expect(noKey.seen).toContain(Ev.DoorLocked);
    const withKey = walkInto(1);
    expect(withKey.sim.room.exitReached).toBe(true);
    expect(withKey.sim.room.keysUsed).toBe(1);
    expect(withKey.seen).toContain(Ev.DoorUnlocked);
    expect(withKey.sim.room.doorDir[withKey.sim.room.exitDoor]).toBe(d);
  });
});
