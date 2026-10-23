import { afterEach, describe, expect, it } from 'vitest';
import { ENEMY_TYPE } from '../../content/enemies';
import { STATUSES, Status, statusDef } from '../../content/statuses';
import { resetTunables } from '../../content/tunables';
import { createInputFrame } from '../../shared/input-frame';
import { AiState, stacksOf } from '../ecs/components';
import { Ev, StatusCode, StatusFlag } from '../events';
import { createSim, type SimState, spawnEnemy, stepSim } from '../sim';
import { secondsToTicks } from '../time';
import { aimErrorDeg, applyStatus, chillSpeedFactor, windupRate } from './status';

afterEach(() => resetTunables());

function sim(): SimState {
  const s = createSim(7);
  s.debug.wavesEnabled = false;
  s.debug.godMode = true;
  return s;
}

function enemyAt(s: SimState, dx: number, type: number = ENEMY_TYPE.brute): number {
  const e = spawnEnemy(s, type, (s.c.posX[s.playerEid] ?? 0) + dx, s.c.posY[s.playerEid] ?? 0);
  s.c.aiCooldownTicks[e] = 1_000_000;
  return e;
}

function idle(s: SimState, ticks: number): void {
  const input = createInputFrame();
  for (let i = 0; i < ticks; i++) stepSim(s, input);
}

function lastEvent(s: SimState, type: number) {
  for (let i = s.events.count - 1; i >= 0; i--) {
    const e = s.events.items[i];
    if (e?.type === type) return e;
  }
  return undefined;
}

describe('status data', () => {
  it('lists the statuses in index order', () => {
    expect(STATUSES.map((d) => d.id)).toEqual(['burn', 'chill', 'poison', 'blind']);
    expect(statusDef(Status.Poison).id).toBe('poison');
  });
});

describe('stacking', () => {
  it('caps stacks and reports first and full applications', () => {
    const s = sim();
    const e = enemyAt(s, 300);
    const max = statusDef(Status.Poison).maxStacks;
    applyStatus(s, e, Status.Poison, 3);
    expect(lastEvent(s, Ev.StatusApplied)?.flags).toBe(StatusFlag.First);
    applyStatus(s, e, Status.Poison, max);
    expect(stacksOf(s.c, e, Status.Poison)).toBe(max);
    expect(lastEvent(s, Ev.StatusApplied)?.flags).toBe(StatusFlag.Full);
    applyStatus(s, e, Status.Poison, 1);
    expect(lastEvent(s, Ev.StatusApplied)?.flags).toBe(0);
  });

  it('refreshes the duration and drops all stacks at once when it runs out', () => {
    const s = sim();
    const e = enemyAt(s, 300);
    const duration = secondsToTicks(statusDef(Status.Poison).durationSec);
    applyStatus(s, e, Status.Poison, 4);
    idle(s, duration - 10);
    applyStatus(s, e, Status.Poison, 1);
    idle(s, duration - 10);
    expect(stacksOf(s.c, e, Status.Poison)).toBe(5);
    s.events.count = 0;
    idle(s, 11);
    expect(stacksOf(s.c, e, Status.Poison)).toBe(0);
    expect(lastEvent(s, Ev.StatusExpired)?.value).toBe(StatusCode.Poison);
  });

  it('chill at its threshold freezes instead of stacking', () => {
    const s = sim();
    const e = enemyAt(s, 300);
    applyStatus(s, e, Status.Chill, statusDef(Status.Chill).freezeAtStacks);
    expect(s.c.frozenTicks[e]).toBeGreaterThan(0);
    expect(stacksOf(s.c, e, Status.Chill)).toBe(0);
    expect(chillSpeedFactor(s, e)).toBe(0);
  });

  it('slows per chill stack', () => {
    const s = sim();
    const e = enemyAt(s, 300);
    applyStatus(s, e, Status.Chill, 2);
    expect(chillSpeedFactor(s, e)).toBeCloseTo(1 - 2 * statusDef(Status.Chill).slowPerStack);
  });
});

describe('poison', () => {
  it('deals stacks × damage per second, with no damage from blind', () => {
    const s = sim();
    const e = enemyAt(s, 300);
    const before = s.c.hp[e] as number;
    const def = statusDef(Status.Poison);
    applyStatus(s, e, Status.Poison, 5);
    applyStatus(s, e, Status.Blind, 1);
    idle(s, secondsToTicks(3));
    const expected = 5 * def.damagePerStackPerSec * 3;
    expect(before - (s.c.hp[e] as number)).toBeCloseTo(expected, 5);
  });

  it('is weakened by status resistance (bosses)', () => {
    const s = sim();
    const boss = enemyAt(s, 400, ENEMY_TYPE.ember_warden);
    const before = s.c.hp[boss] as number;
    applyStatus(s, boss, Status.Poison, 10);
    idle(s, secondsToTicks(2));
    const full = 10 * statusDef(Status.Poison).damagePerStackPerSec * 2;
    expect(before - (s.c.hp[boss] as number)).toBeCloseTo(full * 0.5, 5);
  });
});

describe('blind', () => {
  it('slows windups and spoils aim, less so on bosses', () => {
    const s = sim();
    const e = enemyAt(s, 300);
    const boss = enemyAt(s, -300, ENEMY_TYPE.ember_warden);
    expect(windupRate(s, e)).toBe(1);
    expect(aimErrorDeg(s, e)).toBe(0);
    applyStatus(s, e, Status.Blind, 1);
    applyStatus(s, boss, Status.Blind, 1);
    const def = statusDef(Status.Blind);
    expect(windupRate(s, e)).toBeCloseTo(1 / def.windupMultiplier);
    expect(aimErrorDeg(s, e)).toBe(def.aimErrorDeg);
    expect(windupRate(s, boss)).toBeCloseTo(1 / (1 + (def.windupMultiplier - 1) * 0.5));
    expect(aimErrorDeg(s, boss)).toBeCloseTo(def.aimErrorDeg * 0.5);
  });

  it('makes a real attack windup take longer', () => {
    const windupTicks = (blind: boolean) => {
      const s = sim();
      const e = enemyAt(s, 60);
      s.c.aiCooldownTicks[e] = 0;
      let start = -1;
      for (let t = 0; t < 600; t++) {
        idle(s, 1);
        if (start < 0 && s.c.aiState[e] === AiState.Windup) {
          start = t;
          if (blind) applyStatus(s, e, Status.Blind, 1);
        }
        if (start >= 0 && s.c.aiState[e] !== AiState.Windup) return t - start;
      }
      return -1;
    };
    const normal = windupTicks(false);
    const blinded = windupTicks(true);
    expect(normal).toBeGreaterThan(0);
    expect(blinded / normal).toBeCloseTo(statusDef(Status.Blind).windupMultiplier, 1);
  });
});
