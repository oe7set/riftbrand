import { afterEach, describe, expect, it } from 'vitest';
import { ENEMY_TYPE } from '../../content/enemies';
import { resetTunables } from '../../content/tunables';
import { TUNING } from '../../content/tuning';
import { BRAND_BLADE } from '../../content/weapons/brand-blade';
import { Button, createInputFrame, type InputFrame } from '../../shared/input-frame';
import { damagePlayer } from '../combat/damage';
import { AiState } from '../ecs/components';
import { Ev } from '../events';
import { createSim, type SimState, setBuild, spawnEnemy, stepSim } from '../sim';
import { secondsToTicks } from '../time';
import { compileBuild, type OwnedBoon } from './build';
import { applyChill } from './status';

afterEach(() => resetTunables());

function sim(boons: OwnedBoon[]): SimState {
  const s = createSim(2);
  s.debug.wavesEnabled = false;
  setBuild(s, boons);
  TUNING.critChance = 0;
  return s;
}

function enemyAt(s: SimState, dx: number, dy = 0, type: number = ENEMY_TYPE.brute): number {
  const e = spawnEnemy(
    s,
    type,
    (s.c.posX[s.playerEid] ?? 0) + dx,
    (s.c.posY[s.playerEid] ?? 0) + dy,
  );
  s.c.aiCooldownTicks[e] = 1_000_000;
  return e;
}

function attackRight(s: SimState, ticks = 20): void {
  const input: InputFrame = createInputFrame();
  input.hasAim = true;
  input.aimX = 1;
  input.pressed = Button.Attack;
  for (let i = 0; i < ticks; i++) {
    stepSim(s, input);
    input.pressed = 0;
  }
}

function idle(s: SimState, ticks: number): void {
  const input = createInputFrame();
  for (let i = 0; i < ticks; i++) stepSim(s, input);
}

function eventsOf(s: SimState, type: number): number {
  let n = 0;
  for (let i = 0; i < s.events.count; i++) if (s.events.items[i]?.type === type) n++;
  return n;
}

describe('build compilation', () => {
  it('resolves values for the owned rarity', () => {
    const common = compileBuild([{ id: 'searing_strike', rarity: 'common' }]);
    const epic = compileBuild([{ id: 'searing_strike', rarity: 'epic' }]);
    const stacks = (b: typeof common) =>
      b.onHit[0]?.action.type === 'applyStatus' ? b.onHit[0].action.stacks : -1;
    expect(stacks(common)).toBe(1);
    expect(stacks(epic)).toBe(3);
  });

  it('sums stat boons', () => {
    const b = compileBuild([
      { id: 'blazing_fury', rarity: 'common' },
      { id: 'ember_heart', rarity: 'rare' },
    ]);
    expect(b.stats.attackDamage).toBeCloseTo(0.15);
    expect(b.stats.damageVsBurning).toBeCloseTo(0.3);
  });
});

describe('burn (Ignara)', () => {
  it('attacks apply burn that ticks damage and then expires', () => {
    const s = sim([{ id: 'searing_strike', rarity: 'common' }]);
    const e = enemyAt(s, 50);
    attackRight(s);
    expect(s.c.burnStacks[e]).toBe(1);
    const hpAfterHit = s.c.hp[e] ?? 0;
    idle(s, secondsToTicks(TUNING.burnDurationSec + 0.5));
    expect(s.c.hp[e]).toBeLessThan(hpAfterHit);
    expect(s.c.burnStacks[e]).toBe(0);
  });

  it('blazing fury raises attack damage', () => {
    const s = sim([{ id: 'blazing_fury', rarity: 'common' }]);
    const e = enemyAt(s, 50);
    attackRight(s);
    const dealt = (s.c.maxHp[e] ?? 0) - (s.c.hp[e] ?? 0);
    expect(dealt).toBeCloseTo((BRAND_BLADE.combo[0]?.damage ?? 0) * 1.15);
  });

  it('ignition: a burning kill explodes and burns neighbours', () => {
    const s = sim([
      { id: 'searing_strike', rarity: 'heroic' },
      { id: 'ignition', rarity: 'common' },
    ]);
    const victim = enemyAt(s, 50, 0, ENEMY_TYPE.slag);
    const neighbour = enemyAt(s, 110, 0);
    s.c.hp[victim] = 1;
    s.c.burnStacks[victim] = 5;
    s.c.burnTicks[victim] = 100;
    attackRight(s, 6);
    expect(s.c.hp[neighbour]).toBeLessThan(s.c.maxHp[neighbour] ?? 0);
    expect(s.c.burnStacks[neighbour]).toBeGreaterThan(0);
  });

  it('phoenix ember heals on burning kills', () => {
    const s = sim([{ id: 'phoenix_ember', rarity: 'common' }]);
    s.c.hp[s.playerEid] = 50;
    const victim = enemyAt(s, 50, 0, ENEMY_TYPE.slag);
    s.c.hp[victim] = 1;
    s.c.burnStacks[victim] = 1;
    s.c.burnTicks[victim] = 100;
    attackRight(s, 6);
    expect(s.c.hp[s.playerEid]).toBe(52);
  });

  it('spark trail damages enemies around the dash start', () => {
    const s = sim([{ id: 'spark_trail', rarity: 'common' }]);
    const e = enemyAt(s, 40);
    const input = createInputFrame();
    input.pressed = Button.Dash;
    input.moveX = -1;
    stepSim(s, input);
    expect(s.c.hp[e]).toBeLessThan(s.c.maxHp[e] ?? 0);
    expect(s.c.burnStacks[e]).toBe(1);
  });
});

describe('chill and freeze (Vaelis)', () => {
  it('max chill freezes; frozen enemies stop acting and take extra damage', () => {
    const s = sim([]);
    const e = enemyAt(s, 50, 0, ENEMY_TYPE.slag);
    s.c.aiCooldownTicks[e] = 0;
    applyChill(s, e, TUNING.chillMaxStacks);
    expect(s.c.frozenTicks[e]).toBeGreaterThan(0);
    expect(s.c.chillStacks[e]).toBe(0);
    const x0 = s.c.posX[e];
    idle(s, 30);
    expect(s.c.posX[e]).toBe(x0);
    expect(s.c.aiState[e]).toBe(AiState.Position);
    s.c.hp[e] = 1000;
    s.c.maxHp[e] = 1000;
    attackRight(s, 6);
    const dealt = 1000 - (s.c.hp[e] ?? 0);
    expect(dealt).toBeCloseTo((BRAND_BLADE.combo[0]?.damage ?? 0) * (1 + TUNING.frozenDamageBonus));
  });

  it('chill slows movement per stack', () => {
    const s = sim([]);
    const far = enemyAt(s, 400, 0, ENEMY_TYPE.slag);
    applyChill(s, far, 3);
    idle(s, 1);
    expect(Math.abs(s.c.velX[far] ?? 0)).toBeCloseTo(115 * (1 - 3 * TUNING.chillSlowPerStack));
  });

  it('ice age freezes nearby enemies on a perfect dash', () => {
    const s = sim([{ id: 'ice_age', rarity: 'common' }]);
    const e = enemyAt(s, 80);
    const input = createInputFrame();
    input.pressed = Button.Dash;
    stepSim(s, input);
    expect(damagePlayer(s, 10, 0, 0)).toBe('dodged');
    expect(s.c.frozenTicks[e]).toBeGreaterThan(0);
  });

  it('glacier skin chills enemies when the player is hit', () => {
    const s = sim([{ id: 'glacier_skin', rarity: 'common' }]);
    const e = enemyAt(s, 80);
    // One tick so the new enemy is in the broadphase the nova queries.
    idle(s, 1);
    damagePlayer(s, 10, 200, 200);
    expect(s.c.chillStacks[e]).toBe(3);
  });
});

describe('effect safety', () => {
  it('chained explosions in a crowd terminate within the budget', () => {
    const s = sim([
      { id: 'ignition', rarity: 'heroic' },
      { id: 'searing_strike', rarity: 'heroic' },
    ]);
    for (let i = 0; i < 40; i++) {
      const e = enemyAt(s, 40 + (i % 8) * 20, Math.floor(i / 8) * 20 - 40, ENEMY_TYPE.slag);
      s.c.hp[e] = 1;
      s.c.burnStacks[e] = 5;
      s.c.burnTicks[e] = 100;
    }
    attackRight(s, 30);
    expect(s.effectDepth).toBe(0);
    expect(eventsOf(s, Ev.Nova)).toBeLessThanOrEqual(TUNING.effectBudgetPerTick * 30);
  });
});
