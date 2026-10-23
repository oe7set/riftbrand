import { afterEach, describe, expect, it } from 'vitest';
import { ENEMY_TYPE } from '../../content/enemies';
import { EMBER_MANTLE } from '../../content/spells/ember-mantle';
import { FROST_NOVA } from '../../content/spells/frost-nova';
import { Status } from '../../content/statuses';
import { resetTunables } from '../../content/tunables';
import { Button, createInputFrame } from '../../shared/input-frame';
import { stacksOf } from '../ecs/components';
import { Ev } from '../events';
import { PlayerAction } from '../player-state';
import { startSpellSlots } from '../run/run-state';
import { createSim, equipSpells, type SimState, spawnEnemy, spellSlotsOf, stepSim } from '../sim';
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
    const s = sim({ active: { id: 'frost_nova', level: 1 }, aura: null });
    const near = enemyAt(s, 100);
    const far = enemyAt(s, FROST_NOVA.effect.radiusPx + 120);
    const events = step(s, secondsToTicks(FROST_NOVA.windupSec) + 3, Button.Spell);
    expect(events).toContain(Ev.SpellCast);
    expect(s.c.frozenTicks[near]).toBeGreaterThan(0);
    expect(s.c.frozenTicks[far]).toBe(0);
  });

  it('goes on cooldown, refuses a second cast and reports when ready again', () => {
    const s = sim({ active: { id: 'frost_nova', level: 1 }, aura: null });
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
    expect(spellCooldownTicks(s, FROST_NOVA)).toBe(
      secondsToTicks(FROST_NOVA.cooldownSec * (1 - MAX_COOLDOWN_REDUCTION)),
    );
  });
});

describe('aura', () => {
  it('ember mantle burns enemies close by, not those further away', () => {
    const s = sim({ active: null, aura: { id: 'ember_mantle', level: 1 } });
    const near = enemyAt(s, 60);
    const far = enemyAt(s, EMBER_MANTLE.effect.radiusPx + 120);
    step(s, 2);
    expect(stacksOf(s.c, near, Status.Burn)).toBeGreaterThan(0);
    expect(stacksOf(s.c, far, Status.Burn)).toBe(0);
  });

  it('pulses once per pulse interval', () => {
    const s = sim({ active: null, aura: { id: 'ember_mantle', level: 1 } });
    const events = step(s, secondsToTicks(EMBER_MANTLE.pulseSec * 2.5));
    expect(events.filter((t) => t === Ev.AuraPulse)).toHaveLength(3);
  });

  it('grows with the aura radius stat', () => {
    const s = sim({ active: null, aura: { id: 'ember_mantle', level: 1 } });
    s.build.stats.auraRadius = 1;
    const e = enemyAt(s, EMBER_MANTLE.effect.radiusPx * 1.5);
    step(s, 2);
    expect(stacksOf(s.c, e, Status.Burn)).toBeGreaterThan(0);
  });
});

describe('spell slots', () => {
  it('round-trip between run form and the sim', () => {
    const s = sim();
    expect(spellSlotsOf(s)).toEqual(startSpellSlots());
    equipSpells(s, { active: null, aura: { id: 'ember_mantle', level: 2 } });
    expect(spellSlotsOf(s)).toEqual({ active: null, aura: { id: 'ember_mantle', level: 2 } });
  });

  it('counts spell and aura damage separately for the simulator', () => {
    const s = sim({ active: { id: 'frost_nova', level: 1 }, aura: null });
    enemyAt(s, 80);
    step(s, 20, Button.Spell);
    expect(s.damageDealt.some((v) => v > 0)).toBe(true);
  });
});
