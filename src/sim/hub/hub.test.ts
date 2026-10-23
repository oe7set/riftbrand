import { describe, expect, it } from 'vitest';
import { REFUGE } from '../../content/hub/layout';
import { Button, createInputFrame } from '../../shared/input-frame';
import { createSim, stepSim } from '../sim';
import { COMBAT_BUTTONS, hubInteractPressed, hubRoomSetup, nearestStation } from './hub';

describe('walkable refuge (ROADMAP M5.1)', () => {
  it('finds the station in reach, the closest one first', () => {
    const maren = REFUGE.stations.findIndex((s) => s.id === 'maren');
    const station = REFUGE.stations[maren];
    if (!station) throw new Error('missing maren');
    expect(nearestStation(REFUGE.stations, station.x + 10, station.y)).toBe(maren);
    expect(nearestStation(REFUGE.stations, station.x + station.radiusPx + 5, station.y)).not.toBe(
      maren,
    );
    expect(nearestStation(REFUGE.stations, 20, 20)).toBe(-1);
  });

  it('stations do not overlap, so only one prompt shows at a time', () => {
    const st = REFUGE.stations;
    for (let i = 0; i < st.length; i++) {
      for (let j = i + 1; j < st.length; j++) {
        const a = st[i];
        const b = st[j];
        if (!a || !b) continue;
        expect(Math.hypot(a.x - b.x, a.y - b.y), `${a.id}/${b.id}`).toBeGreaterThan(
          a.radiusPx + b.radiusPx,
        );
      }
    }
  });

  it('is a quiet room: no enemies, the portal open, the player at the campfire', () => {
    const sim = createSim(1, hubRoomSetup(REFUGE));
    const input = createInputFrame();
    for (let i = 0; i < 120; i++) stepSim(sim, input);
    expect(sim.enemiesAlive).toBe(0);
    expect(sim.room.exitOpen).toBe(true);
    expect(sim.c.posX[sim.playerEid]).toBeCloseTo(REFUGE.playerStart.x);
  });

  it('collides with buildings like a room does', () => {
    const sim = createSim(1, hubRoomSetup(REFUGE));
    const input = createInputFrame();
    // Walk west into the Ember Tree for a while; the trunk must stop the player.
    const tree = REFUGE.obstacles[0];
    if (tree?.kind !== 'circle') throw new Error('expected the tree trunk first');
    sim.c.posX[sim.playerEid] = tree.x + tree.r + 60;
    sim.c.posY[sim.playerEid] = tree.y;
    input.moveX = -1;
    for (let i = 0; i < 180; i++) stepSim(sim, input);
    const x = sim.c.posX[sim.playerEid] as number;
    expect(x).toBeGreaterThanOrEqual(tree.x + tree.r);
  });

  it('attack and interact both talk; combat buttons are stripped', () => {
    expect(hubInteractPressed(Button.Attack)).toBe(true);
    expect(hubInteractPressed(Button.Interact)).toBe(true);
    expect(hubInteractPressed(Button.Dash)).toBe(false);
    expect(COMBAT_BUTTONS & Button.Dash).toBe(0);
    expect(COMBAT_BUTTONS & Button.Attack).not.toBe(0);
  });
});
