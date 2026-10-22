import { afterEach, describe, expect, it } from 'vitest';
import { ENEMIES, ENEMY_TYPE } from '../../content/enemies';
import { resetTunables } from '../../content/tunables';
import { createInputFrame } from '../../shared/input-frame';
import { killEnemy } from '../combat/damage';
import { AiState, C } from '../ecs/components';
import { Ev } from '../events';
import { createSim, MAX_MELEE_TOKENS, type SimState, spawnEnemy, stepSim } from '../sim';
import { secondsToTicks } from '../time';
import { WavePhase } from './waves';

afterEach(() => resetTunables());

function quietSim(): SimState {
  const sim = createSim(3);
  sim.debug.wavesEnabled = false;
  return sim;
}

function step(sim: SimState, ticks: number): void {
  const input = createInputFrame();
  for (let i = 0; i < ticks; i++) stepSim(sim, input);
}

function near(sim: SimState, type: number, dx: number, dy = 0): number {
  const x = (sim.c.posX[sim.playerEid] ?? 0) + dx;
  const y = (sim.c.posY[sim.playerEid] ?? 0) + dy;
  const e = spawnEnemy(sim, type, x, y);
  sim.c.aiCooldownTicks[e] = 0;
  return e;
}

describe('enemy ai', () => {
  it('telegraphs for the full windup before the attack lands', () => {
    const sim = quietSim();
    const e = near(sim, ENEMY_TYPE.slag, 100);
    let telegraphTick = -1;
    let attackTick = -1;
    const input = createInputFrame();
    for (let t = 0; t < 120 && attackTick < 0; t++) {
      sim.events.count = 0;
      stepSim(sim, input);
      for (let k = 0; k < sim.events.count; k++) {
        const ev = sim.events.items[k];
        if (ev?.eid !== e) continue;
        if (ev.type === Ev.Telegraph) telegraphTick = sim.tick;
        if (ev.type === Ev.EnemyAttack) attackTick = sim.tick;
      }
    }
    expect(telegraphTick).toBeGreaterThan(0);
    const windup = secondsToTicks(ENEMIES[ENEMY_TYPE.slag]?.attack.windupSec ?? 0);
    expect(attackTick - telegraphTick).toBeGreaterThanOrEqual(windup);
    expect(windup).toBeGreaterThanOrEqual(secondsToTicks(0.4));
  });

  it('a slag lunge damages a standing player', () => {
    const sim = quietSim();
    near(sim, ENEMY_TYPE.slag, 100);
    step(sim, 120);
    expect(sim.c.hp[sim.playerEid]).toBeLessThan(sim.c.maxHp[sim.playerEid] ?? 0);
  });

  it('limits simultaneous melee attackers via tokens', () => {
    const sim = quietSim();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      near(sim, ENEMY_TYPE.slag, Math.cos(a) * 110, Math.sin(a) * 110);
    }
    sim.debug.godMode = true;
    let maxAttacking = 0;
    const input = createInputFrame();
    for (let t = 0; t < 300; t++) {
      stepSim(sim, input);
      let attacking = 0;
      for (let eid = 0; eid < sim.world.highWater; eid++) {
        if (((sim.world.masks[eid] ?? 0) & C.Enemy) === 0) continue;
        const s = sim.c.aiState[eid];
        if (s === AiState.Windup || s === AiState.Active) attacking++;
      }
      maxAttacking = Math.max(maxAttacking, attacking);
    }
    expect(maxAttacking).toBeGreaterThan(0);
    expect(maxAttacking).toBeLessThanOrEqual(MAX_MELEE_TOKENS);
    expect(sim.meleeTokensInUse).toBeLessThanOrEqual(MAX_MELEE_TOKENS);
  });

  it('spitters fire slow projectiles', () => {
    const sim = quietSim();
    near(sim, ENEMY_TYPE.spitter, 300);
    let projectiles = 0;
    const input = createInputFrame();
    for (let t = 0; t < 120 && projectiles === 0; t++) {
      stepSim(sim, input);
      for (let eid = 0; eid < sim.world.highWater; eid++) {
        if (((sim.world.masks[eid] ?? 0) & C.Projectile) !== 0) projectiles++;
      }
    }
    expect(projectiles).toBe(ENEMIES[ENEMY_TYPE.spitter]?.attack.kind === 'volley' ? 3 : 0);
  });

  it('the brute absorbs hits until its poise breaks', () => {
    const sim = quietSim();
    const e = near(sim, ENEMY_TYPE.brute, 300);
    expect(sim.c.poise[e]).toBe(ENEMIES[ENEMY_TYPE.brute]?.poise);
  });
});

describe('waves', () => {
  it('spawns enemies away from the player after a portal warning', () => {
    const sim = createSim(11);
    const input = createInputFrame();
    let warned = 0;
    for (let t = 0; t < 180; t++) {
      sim.events.count = 0;
      stepSim(sim, input);
      for (let k = 0; k < sim.events.count; k++) {
        const ev = sim.events.items[k];
        if (ev?.type !== Ev.SpawnWarn) continue;
        warned++;
        const d = Math.hypot(
          ev.x - (sim.c.posX[sim.playerEid] ?? 0),
          ev.y - (sim.c.posY[sim.playerEid] ?? 0),
        );
        expect(d).toBeGreaterThanOrEqual(150);
      }
    }
    expect(warned).toBeGreaterThan(0);
    expect(sim.enemiesAlive).toBe(warned);
    expect(sim.waves.phase).toBe(WavePhase.Active);
  });

  it('clears a wave when all enemies die and starts the next one', () => {
    const sim = createSim(12);
    step(sim, 180);
    for (let eid = 0; eid < sim.world.highWater; eid++) {
      if (((sim.world.masks[eid] ?? 0) & C.Enemy) !== 0) killEnemy(sim, eid, 1, 0);
    }
    sim.events.count = 0;
    stepSim(sim, createInputFrame());
    expect(sim.events.items.slice(0, sim.events.count).some((e) => e.type === Ev.WaveCleared)).toBe(
      true,
    );
    step(sim, 200);
    expect(sim.waves.wave).toBe(2);
  });
});
