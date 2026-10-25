import { describe, expect, it } from 'vitest';
import { ENEMY_TYPE } from '../../content/enemies';
import { Status } from '../../content/statuses';
import { createInputFrame } from '../../shared/input-frame';
import { debugApplyStatus, debugSpawnEnemy } from '../debug';
import { C } from '../ecs/components';
import { packEnemy } from '../enemy-code';
import { createSim, stepSim } from '../sim';
import { killEnemy } from './damage';

describe('status kills for quests (ROADMAP M5.6)', () => {
  it('a player kill of a burning enemy counts as a burn kill; scripted removals do not', () => {
    const sim = createSim(3);
    sim.debug.wavesEnabled = false;
    debugSpawnEnemy(sim, packEnemy(ENEMY_TYPE.slag));
    debugSpawnEnemy(sim, packEnemy(ENEMY_TYPE.slag));
    const input = createInputFrame();
    for (let i = 0; i < 60; i++) stepSim(sim, input);
    debugApplyStatus(sim, 'burn', 2);
    const enemies: number[] = [];
    for (let eid = 0; eid < sim.world.highWater; eid++) {
      if (((sim.world.masks[eid] as number) & C.Enemy) !== 0) enemies.push(eid);
    }
    expect(enemies.length).toBe(2);
    killEnemy(sim, enemies[0] as number, 1, 0);
    killEnemy(sim, enemies[1] as number, 1, 0, false);
    expect(sim.statusKills[Status.Burn]).toBe(1);
    expect(sim.statusKills[Status.Poison]).toBe(0);
  });
});
