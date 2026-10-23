import { afterEach, describe, expect, it } from 'vitest';
import { ELITE_ID, eliteOf } from '../../content/elites';
import { ENEMIES, ENEMY_TYPE } from '../../content/enemies';
import { resetTunables } from '../../content/tunables';
import { TUNING } from '../../content/tuning';
import { createInputFrame } from '../../shared/input-frame';
import { damageEnemy, killEnemy, type PlayerHitSpec } from '../combat/damage';
import { AiState, C } from '../ecs/components';
import { Ev } from '../events';
import { createSim, type SimState, spawnEnemy, stepSim } from '../sim';
import { secondsToTicks } from '../time';

afterEach(() => resetTunables());

function quietSim(): SimState {
  const sim = createSim(5);
  sim.debug.wavesEnabled = false;
  TUNING.critChance = 0;
  return sim;
}

/** Steps and returns how often each event type fired (events are drained every tick). */
function step(sim: SimState, ticks: number, counts?: Map<number, number>): void {
  const input = createInputFrame();
  for (let i = 0; i < ticks; i++) {
    sim.events.count = 0;
    stepSim(sim, input);
    if (!counts) continue;
    for (let k = 0; k < sim.events.count; k++) {
      const type = sim.events.items[k]?.type ?? 0;
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }
  }
}

function at(sim: SimState, type: number, dx: number, dy = 0, elite = 0): number {
  const x = (sim.c.posX[sim.playerEid] ?? 0) + dx;
  const y = (sim.c.posY[sim.playerEid] ?? 0) + dy;
  const e = spawnEnemy(sim, type, x, y, elite);
  sim.c.aiCooldownTicks[e] = 0;
  return e;
}

function count(sim: SimState, mask: number): number {
  let n = 0;
  for (let e = 0; e < sim.world.highWater; e++) if (((sim.world.masks[e] ?? 0) & mask) !== 0) n++;
  return n;
}

const hit: PlayerHitSpec = {
  damage: 20,
  knockback: 0,
  poiseDamage: 0,
  hitstop: 'none',
  dirX: 1,
  dirY: 0,
  crit: false,
  swingId: 100,
  source: 'attack',
};

describe('new enemies', () => {
  it('cinder layer lobs mines that blow up after their fuse and hurt a player who stays', () => {
    const sim = quietSim();
    at(sim, ENEMY_TYPE.cinder_layer, 250);
    const counts = new Map<number, number>();
    step(sim, secondsToTicks(0.8), counts);
    expect(counts.get(Ev.HazardPlaced)).toBe(2);
    expect(count(sim, C.Hazard)).toBe(2);
    const hp = sim.c.hp[sim.playerEid] ?? 0;
    step(sim, secondsToTicks(1.3), counts);
    expect(counts.get(Ev.HazardBlast)).toBe(2);
    expect(count(sim, C.Hazard)).toBe(0);
    // The first mine lands right on the player's spot.
    expect(sim.c.hp[sim.playerEid]).toBeLessThan(hp);
  });

  it('ash priest heals wounded allies in range, not itself', () => {
    const sim = quietSim();
    const priest = at(sim, ENEMY_TYPE.ash_priest, 330);
    const ally = at(sim, ENEMY_TYPE.brute, 400, 120);
    sim.c.aiCooldownTicks[ally] = 1_000_000;
    sim.c.hp[ally] = 20;
    sim.c.hp[priest] = 10;
    const counts = new Map<number, number>();
    step(sim, secondsToTicks(1.1), counts);
    expect(counts.get(Ev.EnemyMend)).toBe(1);
    expect(sim.c.hp[ally]).toBeCloseTo(20 + 120 * 0.35);
    expect(sim.c.hp[priest]).toBe(10);
  });

  it('ember mites are cheap swarm enemies that lunge', () => {
    const def = ENEMIES[ENEMY_TYPE.ember_mite];
    expect(def?.role).toBe('swarm');
    expect(def?.waveCost).toBeLessThan(1);
    const sim = quietSim();
    at(sim, ENEMY_TYPE.ember_mite, 60);
    const counts = new Map<number, number>();
    step(sim, 40, counts);
    expect(counts.get(Ev.EnemyAttack)).toBeGreaterThan(0);
  });
});

describe('elite modifiers', () => {
  it('elites have more HP and a bigger body', () => {
    const sim = quietSim();
    const e = at(sim, ENEMY_TYPE.slag, 300, 0, ELITE_ID.hasty);
    const hasty = eliteOf(ELITE_ID.hasty);
    expect(sim.c.maxHp[e]).toBe(30 * (hasty?.hpMultiplier ?? 0));
    expect(sim.c.radius[e]).toBeCloseTo(13 * (hasty?.radiusMultiplier ?? 0));
  });

  it('hasty elites move faster', () => {
    const sim = quietSim();
    const normal = at(sim, ENEMY_TYPE.brute, 400);
    const fast = at(sim, ENEMY_TYPE.brute, -400, 0, ELITE_ID.hasty);
    step(sim, 1);
    const speed = (e: number) => Math.hypot(sim.c.velX[e] ?? 0, sim.c.velY[e] ?? 0);
    expect(speed(fast) / speed(normal)).toBeCloseTo(eliteOf(ELITE_ID.hasty)?.speedMultiplier ?? 0);
  });

  it('shielded elites absorb hits from the front but not from behind', () => {
    const sim = quietSim();
    const e = at(sim, ENEMY_TYPE.brute, 200, 0, ELITE_ID.shielded);
    sim.c.facingX[e] = -1;
    sim.c.facingY[e] = 0;
    const factor = eliteOf(ELITE_ID.shielded)?.shieldDamageFactor ?? 1;
    const before = sim.c.hp[e] ?? 0;
    // Player to the left pushes right (+x): the enemy faces the player → blocked.
    damageEnemy(sim, e, { ...hit, swingId: 1, dirX: 1 });
    expect(before - (sim.c.hp[e] ?? 0)).toBeCloseTo(20 * factor);
    const mid = sim.c.hp[e] ?? 0;
    damageEnemy(sim, e, { ...hit, swingId: 2, dirX: -1 });
    expect(mid - (sim.c.hp[e] ?? 0)).toBeCloseTo(20);
  });

  it('volatile elites leave a delayed blast on death; scripted kills do not', () => {
    const sim = quietSim();
    const e = at(sim, ENEMY_TYPE.slag, 300, 0, ELITE_ID.volatile);
    killEnemy(sim, e, 1, 0);
    expect(count(sim, C.Hazard)).toBe(1);
    const quiet = quietSim();
    killEnemy(quiet, at(quiet, ENEMY_TYPE.slag, 300, 0, ELITE_ID.volatile), 1, 0, false);
    expect(count(quiet, C.Hazard)).toBe(0);
  });
});

describe('Glutwächter (boss)', () => {
  it('changes phase as its HP drops, with a roar that opens a punish window', () => {
    const sim = quietSim();
    const boss = at(sim, ENEMY_TYPE.ember_warden, 300);
    const max = sim.c.maxHp[boss] ?? 1;
    const counts = new Map<number, number>();
    step(sim, 1, counts);
    expect(sim.c.aiPhase[boss]).toBe(0);
    sim.c.hp[boss] = max * 0.5;
    step(sim, 1, counts);
    expect(sim.c.aiPhase[boss]).toBe(1);
    expect(sim.c.aiState[boss]).toBe(AiState.Stagger);
    sim.c.hp[boss] = max * 0.2;
    step(sim, 1, counts);
    expect(sim.c.aiPhase[boss]).toBe(2);
    expect(counts.get(Ev.BossPhase)).toBe(2);
  });

  it('uses several different patterns and never repeats one back to back', () => {
    const sim = quietSim();
    sim.debug.godMode = true;
    const boss = at(sim, ENEMY_TYPE.ember_warden, 150);
    const input = createInputFrame();
    const seen = new Set<number>();
    let last = -1;
    for (let t = 0; t < 60 * 40; t++) {
      sim.events.count = 0;
      stepSim(sim, input);
      for (let k = 0; k < sim.events.count; k++) {
        const ev = sim.events.items[k];
        if (ev?.type !== Ev.Telegraph || ev.eid !== boss) continue;
        expect(ev.amount).not.toBe(last);
        last = ev.amount;
        seen.add(ev.amount);
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });

  it('summons mites in phase two and they crumble when the boss dies', () => {
    const sim = quietSim();
    sim.debug.godMode = true;
    const boss = at(sim, ENEMY_TYPE.ember_warden, 150);
    sim.c.hp[boss] = (sim.c.maxHp[boss] ?? 0) * 0.5;
    const input = createInputFrame();
    let mites = 0;
    for (let t = 0; t < 60 * 60 && mites === 0; t++) {
      stepSim(sim, input);
      sim.events.count = 0;
      for (let e = 0; e < sim.world.highWater; e++) {
        if (
          ((sim.world.masks[e] ?? 0) & C.Enemy) !== 0 &&
          sim.c.enemyType[e] === ENEMY_TYPE.ember_mite
        )
          mites++;
      }
    }
    expect(mites).toBeGreaterThan(0);
    killEnemy(sim, boss, 1, 0);
    expect(sim.enemiesAlive).toBe(0);
  });
});
