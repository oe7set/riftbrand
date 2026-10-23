import { afterEach, describe, expect, it } from 'vitest';
import { ENEMY_TYPE } from '../../content/enemies';
import { spellRadiusPx } from '../../content/spells';
import { EMBER_MANTLE } from '../../content/spells/ember-mantle';
import { FROST_NOVA } from '../../content/spells/frost-nova';
import { LIGHT_LANCE } from '../../content/spells/light-lance';
import { METEOR } from '../../content/spells/meteor';
import { Status } from '../../content/statuses';
import { resetTunables } from '../../content/tunables';
import { Button, createInputFrame } from '../../shared/input-frame';
import { killEnemy } from '../combat/damage';
import { C, stacksOf, Team } from '../ecs/components';
import { Ev } from '../events';
import { PlayerAction } from '../player-state';
import { startSpellSlots } from '../run/run-state';
import {
  createSim,
  equipCast,
  equipSpells,
  type SimState,
  spawnEnemy,
  spellSlotsOf,
  stepSim,
} from '../sim';
import { secondsToTicks } from '../time';
import { MAX_COOLDOWN_REDUCTION, spellCooldownTicks } from './spells';

afterEach(() => resetTunables());

function sim(slots = startSpellSlots()): SimState {
  const s = createSim(3);
  s.debug.wavesEnabled = false;
  s.debug.godMode = true;
  equipSpells(s, slots);
  return s;
}

function enemyAt(s: SimState, dx: number, dy = 0): number {
  const e = spawnEnemy(
    s,
    ENEMY_TYPE.brute,
    (s.c.posX[s.playerEid] ?? 0) + dx,
    (s.c.posY[s.playerEid] ?? 0) + dy,
  );
  s.c.aiCooldownTicks[e] = 1_000_000;
  return e;
}

function step(s: SimState, ticks: number, pressed = 0): number[] {
  const input = createInputFrame();
  const seen: number[] = [];
  for (let i = 0; i < ticks; i++) {
    input.pressed = i === 0 ? pressed : 0;
    s.events.count = 0;
    stepSim(s, input);
    for (let k = 0; k < s.events.count; k++) seen.push(s.events.items[k]?.type ?? 0);
  }
  return seen;
}

describe('active spell', () => {
  it('frost nova freezes enemies in its radius after the windup, not beyond', () => {
    const s = sim({ active: { id: 'frost_nova', level: 1, branches: [] }, aura: null });
    const near = enemyAt(s, 100);
    const far = enemyAt(s, spellRadiusPx(FROST_NOVA) + 120);
    const events = step(s, secondsToTicks(FROST_NOVA.windupSec) + 3, Button.Spell);
    expect(events).toContain(Ev.SpellCast);
    expect(s.c.frozenTicks[near]).toBeGreaterThan(0);
    expect(s.c.frozenTicks[far]).toBe(0);
  });

  it('goes on cooldown, refuses a second cast and reports when ready again', () => {
    const s = sim({ active: { id: 'frost_nova', level: 1, branches: [] }, aura: null });
    step(s, 30, Button.Spell);
    expect(s.player.spellCooldownTicks).toBeGreaterThan(0);
    const denied = step(s, 20, Button.Spell);
    expect(denied).toContain(Ev.Denied);
    expect(s.player.action).not.toBe(PlayerAction.Spell);
    const ready = step(s, secondsToTicks(FROST_NOVA.cooldownSec));
    expect(ready).toContain(Ev.SpellReady);
    expect(s.player.spellCooldownTicks).toBe(0);
  });

  it('does nothing without an equipped spell', () => {
    const s = sim({ active: null, aura: null });
    const events = step(s, 20, Button.Spell);
    expect(events).not.toContain(Ev.SpellCast);
  });

  it('caps cooldown reduction', () => {
    const s = sim();
    s.build.stats.cooldownReduction = 0.9;
    expect(spellCooldownTicks(s, FROST_NOVA.cooldownSec)).toBe(
      secondsToTicks(FROST_NOVA.cooldownSec * (1 - MAX_COOLDOWN_REDUCTION)),
    );
  });
});

describe('aura', () => {
  it('ember mantle burns enemies close by, not those further away', () => {
    const s = sim({ active: null, aura: { id: 'ember_mantle', level: 1, branches: [] } });
    const near = enemyAt(s, 60);
    const far = enemyAt(s, spellRadiusPx(EMBER_MANTLE) + 120);
    step(s, 2);
    expect(stacksOf(s.c, near, Status.Burn)).toBeGreaterThan(0);
    expect(stacksOf(s.c, far, Status.Burn)).toBe(0);
  });

  it('pulses once per pulse interval', () => {
    const s = sim({ active: null, aura: { id: 'ember_mantle', level: 1, branches: [] } });
    const events = step(s, secondsToTicks(EMBER_MANTLE.pulseSec * 2.5));
    expect(events.filter((t) => t === Ev.AuraPulse)).toHaveLength(3);
  });

  it('grows with the aura radius stat', () => {
    const s = sim({ active: null, aura: { id: 'ember_mantle', level: 1, branches: [] } });
    s.build.stats.auraRadius = 1;
    const e = enemyAt(s, spellRadiusPx(EMBER_MANTLE) * 1.5);
    step(s, 2);
    expect(stacksOf(s.c, e, Status.Burn)).toBeGreaterThan(0);
  });
});

describe('spell slots', () => {
  it('round-trip between run form and the sim', () => {
    const s = sim();
    expect(spellSlotsOf(s)).toEqual(startSpellSlots());
    equipSpells(s, { active: null, aura: { id: 'ember_mantle', level: 2, branches: [] } });
    expect(spellSlotsOf(s)).toEqual({
      active: null,
      aura: { id: 'ember_mantle', level: 2, branches: [] },
    });
  });

  it('counts spell and aura damage separately for the simulator', () => {
    const s = sim({ active: { id: 'frost_nova', level: 1, branches: [] }, aura: null });
    enemyAt(s, 80);
    step(s, 20, Button.Spell);
    expect(s.damageDealt.some((v) => v > 0)).toBe(true);
  });
});

function cast(s: SimState, id: string, aimX = 1, aimY = 0): number[] {
  equipSpells(s, { active: { id, level: 1, branches: [] }, aura: null });
  const input = createInputFrame();
  input.hasAim = true;
  input.aimX = aimX;
  input.aimY = aimY;
  input.assistDeg = 0;
  input.pressed = Button.Spell;
  s.events.count = 0;
  stepSim(s, input);
  const seen: number[] = [];
  for (let k = 0; k < s.events.count; k++) seen.push(s.events.items[k]?.type ?? 0);
  return seen;
}

describe('spell schools (M3.3)', () => {
  it('meteor marks the spot and only hits after its delay', () => {
    const s = sim({ active: null, aura: null });
    const e = enemyAt(s, METEOR.effect.type === 'burst' ? METEOR.effect.rangePx : 0);
    const hp = s.c.hp[e] as number;
    cast(s, 'meteor');
    step(s, secondsToTicks(METEOR.windupSec) + 2);
    expect(s.c.hp[e]).toBe(hp);
    const events = step(s, secondsToTicks(0.6));
    expect(events).toContain(Ev.ZonePulse);
    expect(s.c.hp[e]).toBeLessThan(hp);
    expect(stacksOf(s.c, e, Status.Burn)).toBeGreaterThan(0);
  });

  it('poison cloud keeps poisoning while it lasts, then disappears', () => {
    const s = sim({ active: null, aura: null });
    const e = enemyAt(s, 200);
    cast(s, 'poison_cloud');
    step(s, secondsToTicks(2.2));
    const mid = stacksOf(s.c, e, Status.Poison);
    expect(mid).toBeGreaterThanOrEqual(3);
    const events = step(s, secondsToTicks(4));
    const zones = events.filter((t) => t === Ev.ZonePulse).length;
    expect(zones).toBeLessThanOrEqual(7);
    let alive = 0;
    for (let i = 0; i < s.world.highWater; i++)
      if (((s.world.masks[i] ?? 0) & C.Zone) !== 0) alive++;
    expect(alive).toBe(0);
  });

  it('light lance pierces enemies on its line and blinds them, not those beside it', () => {
    const s = sim({ active: null, aura: null });
    const a = enemyAt(s, 120);
    const b = enemyAt(s, 300);
    const beside = enemyAt(s, 200, 160);
    cast(s, 'light_lance');
    step(s, secondsToTicks(LIGHT_LANCE.windupSec) + 2);
    expect(stacksOf(s.c, a, Status.Blind)).toBe(1);
    expect(stacksOf(s.c, b, Status.Blind)).toBe(1);
    expect(stacksOf(s.c, beside, Status.Blind)).toBe(0);
  });

  it('plague breath: poisoned enemies leave a cloud when they die', () => {
    const s = sim({ active: null, aura: { id: 'plague_breath', level: 1, branches: [] } });
    const e = enemyAt(s, 60);
    step(s, 2);
    expect(stacksOf(s.c, e, Status.Poison)).toBeGreaterThan(0);
    killEnemy(s, e, 1, 0);
    let zones = 0;
    for (let i = 0; i < s.world.highWater; i++)
      if (((s.world.masks[i] ?? 0) & C.Zone) !== 0) zones++;
    expect(zones).toBe(1);
  });

  it('halo dissolves the nearest enemy shot', () => {
    const s = sim({ active: null, aura: null });
    const spitter = spawnEnemy(
      s,
      ENEMY_TYPE.spitter,
      (s.c.posX[s.playerEid] ?? 0) + 100,
      s.c.posY[s.playerEid] ?? 0,
    );
    s.c.aiCooldownTicks[spitter] = 0;
    let shots = 0;
    for (let i = 0; i < 400 && shots === 0; i++) {
      step(s, 1);
      for (let k = 0; k < s.world.highWater; k++) {
        if (((s.world.masks[k] ?? 0) & C.Projectile) !== 0 && s.c.team[k] === Team.Enemy) shots++;
      }
    }
    expect(shots).toBeGreaterThan(0);
    equipSpells(s, { active: null, aura: { id: 'halo', level: 1, branches: [] } });
    const events = step(s, 2);
    expect(events).toContain(Ev.ShotDissolved);
  });
});

describe('upgraded spells and shots (M3.4)', () => {
  it('a triple shot fires three projectiles', () => {
    const s = sim({ active: null, aura: null });
    equipCast(s, { level: 5, branches: [0, 0] });
    const input = createInputFrame();
    input.pressed = Button.Cast;
    stepSim(s, input);
    step(s, 5);
    let shots = 0;
    for (let i = 0; i < s.world.highWater; i++) {
      if (((s.world.masks[i] ?? 0) & C.Projectile) !== 0 && s.c.team[i] === Team.Player) shots++;
    }
    expect(shots).toBe(3);
  });

  it('a meteor shower lands three impacts', () => {
    const s = sim({ active: null, aura: null });
    equipSpells(s, { active: { id: 'meteor', level: 3, branches: [0] }, aura: null });
    const input = createInputFrame();
    input.pressed = Button.Spell;
    stepSim(s, input);
    const events = step(s, secondsToTicks(1.5));
    expect(events.filter((t) => t === Ev.ZonePulse)).toHaveLength(3);
  });

  it('frost nova echo freezes twice', () => {
    const s = sim({ active: null, aura: null });
    equipSpells(s, { active: { id: 'frost_nova', level: 5, branches: [0, 0] }, aura: null });
    const input = createInputFrame();
    input.pressed = Button.Spell;
    stepSim(s, input);
    const events = step(s, secondsToTicks(1));
    expect(events.filter((t) => t === Ev.ZonePulse)).toHaveLength(1);
    expect(events).toContain(Ev.SpellCast);
  });
});
