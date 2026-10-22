import { afterEach, describe, expect, it } from 'vitest';
import { ENEMY_TYPE } from '../../content/enemies';
import { resetTunables } from '../../content/tunables';
import { TUNING } from '../../content/tuning';
import { BRAND_BLADE } from '../../content/weapons/brand-blade';
import { Button, createInputFrame, type InputFrame } from '../../shared/input-frame';
import { damagePlayer } from '../combat/damage';
import { AiState } from '../ecs/components';
import { Ev } from '../events';
import { PlayerAction } from '../player-state';
import { createSim, type SimState, spawnEnemy, stepSim } from '../sim';
import { secondsToTicks } from '../time';

afterEach(() => resetTunables());

/** A sim without waves, so tests control exactly which enemies exist. */
function quietSim(): SimState {
  const sim = createSim(1);
  sim.debug.wavesEnabled = false;
  return sim;
}

function run(sim: SimState, input: InputFrame, ticks: number): void {
  for (let i = 0; i < ticks; i++) {
    stepSim(sim, input);
    input.pressed = 0;
  }
}

function eventTypes(sim: SimState): number[] {
  return sim.events.items.slice(0, sim.events.count).map((e) => e.type);
}

function playerPos(sim: SimState): { x: number; y: number } {
  return { x: sim.c.posX[sim.playerEid] ?? 0, y: sim.c.posY[sim.playerEid] ?? 0 };
}

describe('player movement', () => {
  it('reaches full speed within the acceleration time', () => {
    const sim = quietSim();
    const input = createInputFrame();
    input.moveX = 1;
    run(sim, input, secondsToTicks(TUNING.playerAccelSec));
    expect(sim.c.velX[sim.playerEid]).toBeCloseTo(TUNING.playerSpeedPxPerSec);
  });

  it('stops instantly by default (no sliding)', () => {
    const sim = quietSim();
    const input = createInputFrame();
    input.moveX = 1;
    run(sim, input, 30);
    input.moveX = 0;
    run(sim, input, 1);
    expect(sim.c.velX[sim.playerEid]).toBe(0);
  });

  it('stays inside the arena', () => {
    const sim = quietSim();
    const input = createInputFrame();
    input.moveX = -1;
    run(sim, input, 1000);
    expect(sim.c.posX[sim.playerEid]).toBe(TUNING.playerRadiusPx);
  });

  it('skips gameplay during hitstop but keeps presses buffered', () => {
    const sim = quietSim();
    const input = createInputFrame();
    sim.freezeTicks = 3;
    input.pressed = Button.Attack;
    run(sim, input, 3);
    expect(sim.player.action).toBe(PlayerAction.Idle);
    run(sim, input, 1);
    expect(sim.player.action).toBe(PlayerAction.Attack);
  });
});

describe('dash and stamina', () => {
  it('covers the dash distance and costs one segment', () => {
    const sim = quietSim();
    const input = createInputFrame();
    input.moveX = 1;
    input.pressed = Button.Dash;
    const x0 = playerPos(sim).x;
    run(sim, input, 1);
    input.moveX = 0;
    run(sim, input, secondsToTicks(TUNING.dashDurationSec));
    expect(playerPos(sim).x - x0).toBeCloseTo(TUNING.dashDistancePx, 0);
    expect(sim.player.stamina).toBeLessThan(TUNING.staminaMax);
    expect(sim.player.stamina).toBeGreaterThan(TUNING.staminaMax - 1.1);
  });

  it('refuses to dash without stamina and signals it once', () => {
    const sim = quietSim();
    sim.player.stamina = 0.5;
    sim.player.staminaDelayTicks = 999;
    const input = createInputFrame();
    input.pressed = Button.Dash;
    run(sim, input, 1);
    expect(sim.player.action).toBe(PlayerAction.Idle);
    run(sim, input, 3);
    expect(eventTypes(sim).filter((t) => t === Ev.StaminaEmpty)).toHaveLength(1);
  });

  it('executes a buffered dash as soon as stamina is back', () => {
    const sim = quietSim();
    sim.player.stamina = 0.99;
    const input = createInputFrame();
    input.pressed = Button.Dash;
    run(sim, input, 4);
    expect(sim.player.action).toBe(PlayerAction.Dash);
  });

  it('regenerates one segment per regen interval after the delay', () => {
    const sim = quietSim();
    sim.player.stamina = 0;
    sim.player.staminaDelayTicks = 0;
    run(sim, createInputFrame(), secondsToTicks(TUNING.staminaRegenSecPerSegment));
    expect(sim.player.stamina).toBeCloseTo(1, 1);
  });

  it('dash i-frames block damage; a late dash is a perfect dash', () => {
    const sim = quietSim();
    const input = createInputFrame();
    input.pressed = Button.Dash;
    run(sim, input, 2);
    const e = spawnEnemy(sim, ENEMY_TYPE.slag, 0, 0);
    // Simulate a lunge landing during the dash window.
    sim.c.aiState[e] = AiState.Active;
    const hpBefore = sim.c.hp[sim.playerEid];
    expect(damagePlayer(sim, 10, 0, 0)).toBe('dodged');
    expect(sim.c.hp[sim.playerEid]).toBe(hpBefore);
    expect(sim.player.guaranteedCrit).toBe(true);
    expect(eventTypes(sim)).toContain(Ev.PerfectDash);
  });
});

describe('melee combo', () => {
  function enemyInFront(sim: SimState, type: number = ENEMY_TYPE.brute): number {
    const { x, y } = playerPos(sim);
    const e = spawnEnemy(sim, type, x + 50, y);
    // Keep it passive so the test only measures our attacks.
    sim.c.aiCooldownTicks[e] = 100000;
    return e;
  }

  it('plays three different hits when attack is held', () => {
    const sim = quietSim();
    enemyInFront(sim);
    const input = createInputFrame();
    input.held = Button.Attack;
    input.pressed = Button.Attack;
    const swings: number[] = [];
    for (let i = 0; i < 90; i++) {
      stepSim(sim, input);
      input.pressed = 0;
      for (let k = 0; k < sim.events.count; k++) {
        const ev = sim.events.items[k];
        if (ev?.type === Ev.Swing) swings.push(ev.value);
      }
      sim.events.count = 0;
    }
    expect(swings.slice(0, 4)).toEqual([0, 1, 2, 0]);
  });

  it('damages an enemy in the arc once per swing', () => {
    const sim = quietSim();
    TUNING.critChance = 0;
    const e = enemyInFront(sim);
    const input = createInputFrame();
    input.aimX = 1;
    input.hasAim = true;
    input.pressed = Button.Attack;
    run(sim, input, 40);
    const hit = BRAND_BLADE.combo[0];
    expect(sim.c.hp[e]).toBe((sim.c.maxHp[e] ?? 0) - (hit?.damage ?? 0));
  });

  it('misses enemies behind the player', () => {
    const sim = quietSim();
    const { x, y } = playerPos(sim);
    const e = spawnEnemy(sim, ENEMY_TYPE.brute, x - 60, y);
    sim.c.aiCooldownTicks[e] = 100000;
    const input = createInputFrame();
    input.aimX = 1;
    input.hasAim = true;
    input.assistDeg = 0;
    input.pressed = Button.Attack;
    run(sim, input, 40);
    expect(sim.c.hp[e]).toBe(sim.c.maxHp[e]);
  });

  it('aim assist turns a tap toward a nearby enemy', () => {
    const sim = quietSim();
    const { x, y } = playerPos(sim);
    spawnEnemy(sim, ENEMY_TYPE.brute, x + 60, y + 25);
    const input = createInputFrame();
    sim.c.facingX[sim.playerEid] = 1;
    sim.c.facingY[sim.playerEid] = 0;
    input.pressed = Button.Attack;
    run(sim, input, 2);
    expect(sim.player.dirY).toBeGreaterThan(0.3);
  });

  it('a perfect-dash crit applies to the next swing', () => {
    const sim = quietSim();
    TUNING.critChance = 0;
    const e = enemyInFront(sim);
    sim.player.guaranteedCrit = true;
    const input = createInputFrame();
    input.aimX = 1;
    input.hasAim = true;
    input.pressed = Button.Attack;
    run(sim, input, 20);
    const dmg = (BRAND_BLADE.combo[0]?.damage ?? 0) * TUNING.critMultiplier;
    expect(sim.c.hp[e]).toBeCloseTo((sim.c.maxHp[e] ?? 0) - dmg);
    expect(sim.player.guaranteedCrit).toBe(false);
  });

  it('kills trigger hitstop and remove the enemy', () => {
    const sim = quietSim();
    const e = enemyInFront(sim, ENEMY_TYPE.slag);
    sim.c.hp[e] = 1;
    const input = createInputFrame();
    input.aimX = 1;
    input.hasAim = true;
    input.pressed = Button.Attack;
    let sawFreeze = false;
    for (let i = 0; i < 20; i++) {
      stepSim(sim, input);
      input.pressed = 0;
      if (sim.freezeTicks > 0) sawFreeze = true;
    }
    expect(sawFreeze).toBe(true);
    expect(sim.enemiesAlive).toBe(0);
    expect(sim.player.kills).toBe(1);
  });
});
