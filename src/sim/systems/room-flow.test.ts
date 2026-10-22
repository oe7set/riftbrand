import { describe, expect, it } from 'vitest';
import { ROOMS } from '../../content/rooms';
import type { RoomTemplateDef } from '../../content/schema';
import { createInputFrame } from '../../shared/input-frame';
import { killEnemy } from '../combat/damage';
import { C } from '../ecs/components';
import { Ev } from '../events';
import { hashSim } from '../hash';
import type { Encounter } from '../run/encounter';
import { createSim, type SimState, stepSim } from '../sim';
import { secondsToTicks } from '../time';

const OPEN = ROOMS.find((r) => r.id === 'open_ash') as RoomTemplateDef;
const PILLARS = ROOMS.find((r) => r.id === 'central_altar') as RoomTemplateDef;

function roomSim(encounter: Encounter, template = OPEN, seed = 4): SimState {
  return createSim(seed, { template, encounter, playerHp: 80, playerMaxHp: 100, boons: [] });
}

function step(sim: SimState, ticks: number, onEvent?: (type: number) => void): void {
  const input = createInputFrame();
  for (let i = 0; i < ticks; i++) {
    sim.events.count = 0;
    stepSim(sim, input);
    if (onEvent) for (let k = 0; k < sim.events.count; k++) onEvent(sim.events.items[k]?.type ?? 0);
  }
}

function killAll(sim: SimState): void {
  for (let eid = 0; eid < sim.world.highWater; eid++) {
    if (((sim.world.masks[eid] ?? 0) & C.Enemy) !== 0) killEnemy(sim, eid, 1, 0);
  }
}

describe('room flow', () => {
  it('starts at the template start with carried-over HP', () => {
    const sim = roomSim({ kind: 'waves', waves: [[0]] });
    expect(sim.c.posX[sim.playerEid]).toBe(OPEN.playerStart.x);
    expect(sim.c.hp[sim.playerEid]).toBe(80);
    expect(sim.arenaWidthPx).toBe(OPEN.widthPx);
  });

  it('runs every wave, then opens the exit', () => {
    const sim = roomSim({ kind: 'waves', waves: [[0, 0], [1]] });
    sim.debug.godMode = true;
    const seen: number[] = [];
    for (let round = 0; round < 3; round++) {
      step(sim, secondsToTicks(2.5), (t) => seen.push(t));
      killAll(sim);
    }
    step(sim, 2, (t) => seen.push(t));
    expect(seen.filter((t) => t === Ev.WaveStart)).toHaveLength(2);
    expect(seen).toContain(Ev.RoomCleared);
    expect(sim.room.exitOpen).toBe(true);
  });

  it('reports reaching the exit once', () => {
    const sim = roomSim({ kind: 'waves', waves: [[0]] });
    step(sim, secondsToTicks(2));
    killAll(sim);
    step(sim, 2);
    expect(sim.room.exitOpen).toBe(true);
    sim.c.posX[sim.playerEid] = sim.room.exitX;
    sim.c.posY[sim.playerEid] = sim.room.exitY;
    let reached = 0;
    step(sim, 10, (t) => {
      if (t === Ev.ExitReached) reached++;
    });
    expect(reached).toBe(1);
  });

  it('a horde ends on its timer and burns the remaining enemies', () => {
    const sim = roomSim({ kind: 'horde', durationSec: 5, spawnIntervalSec: 0.5, pool: [0] });
    sim.debug.godMode = true;
    let cleared = false;
    let maxAlive = 0;
    const input = createInputFrame();
    for (let i = 0; i < secondsToTicks(8) && !cleared; i++) {
      sim.events.count = 0;
      stepSim(sim, input);
      maxAlive = Math.max(maxAlive, sim.enemiesAlive);
      for (let k = 0; k < sim.events.count; k++)
        if (sim.events.items[k]?.type === Ev.RoomCleared) cleared = true;
    }
    expect(maxAlive).toBeGreaterThan(2);
    expect(cleared).toBe(true);
    expect(sim.enemiesAlive).toBe(0);
  });

  it('obstacles block the player', () => {
    const sim = roomSim({ kind: 'waves', waves: [[0]] }, PILLARS);
    sim.debug.wavesEnabled = false;
    const input = createInputFrame();
    input.moveY = -1;
    for (let i = 0; i < 600; i++) stepSim(sim, input);
    const block = PILLARS.obstacles[0];
    if (block?.kind !== 'rect') throw new Error('expected rect');
    // Walked straight up into the central block and stopped at its bottom edge.
    expect(sim.c.posY[sim.playerEid]).toBeCloseTo(
      block.y + block.h + (sim.c.radius[sim.playerEid] ?? 0),
      3,
    );
  });

  it('never spawns enemies inside obstacles', () => {
    for (const template of ROOMS) {
      const sim = roomSim(
        { kind: 'horde', durationSec: 6, spawnIntervalSec: 0.2, pool: [0, 1] },
        template,
        9,
      );
      sim.debug.godMode = true;
      step(sim, secondsToTicks(5));
      for (let i = 0; i < sim.waves.pendingCount; i++) {
        const x = sim.waves.pendingX[i] ?? 0;
        const y = sim.waves.pendingY[i] ?? 0;
        for (const o of template.obstacles) {
          if (o.kind === 'circle') expect(Math.hypot(x - o.x, y - o.y)).toBeGreaterThan(o.r);
          else expect(x > o.x && x < o.x + o.w && y > o.y && y < o.y + o.h).toBe(false);
        }
      }
    }
  });

  it('is deterministic in room mode', () => {
    const run = () => {
      const sim = roomSim({ kind: 'waves', waves: [[0, 1], [2]] }, PILLARS, 77);
      const input = createInputFrame();
      for (let t = 0; t < 1200; t++) {
        input.moveX = Math.sin(t / 40);
        input.moveY = Math.cos(t / 55);
        input.pressed = t % 15 === 0 ? 1 : 0;
        stepSim(sim, input);
      }
      return hashSim(sim);
    };
    expect(run()).toBe(run());
  });
});
