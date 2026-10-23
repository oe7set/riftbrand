import { afterEach, describe, expect, it } from 'vitest';
import { BRAND_BURST, RIFT_SHOT } from '../../content/abilities';
import { ENEMY_TYPE } from '../../content/enemies';
import { Status, statusDef } from '../../content/statuses';
import { resetTunables } from '../../content/tunables';
import { TUNING } from '../../content/tuning';
import { Button, createInputFrame, type InputFrame } from '../../shared/input-frame';
import { damageEnemy, type PlayerHitSpec } from '../combat/damage';
import { C, RenderKind, statusSlot } from '../ecs/components';
import { dominantBeing, type OwnedBoon } from '../effects/build';
import { applyBurn, applyChill } from '../effects/status';
import { Ev } from '../events';
import { PlayerAction } from '../player-state';
import { createSim, type SimState, setBuild, spawnEnemy, stepSim } from '../sim';
import { secondsToTicks } from '../time';

afterEach(() => resetTunables());

function sim(boons: OwnedBoon[] = [], evolutions: string[] = []): SimState {
  const s = createSim(3);
  s.debug.wavesEnabled = false;
  setBuild(s, boons, [], evolutions);
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

function press(s: SimState, button: number, ticks: number, aimX = 1, aimY = 0): void {
  const input: InputFrame = createInputFrame();
  input.hasAim = true;
  input.aimX = aimX;
  input.aimY = aimY;
  input.pressed = button;
  for (let i = 0; i < ticks; i++) {
    stepSim(s, input);
    input.pressed = 0;
  }
}

function count(s: SimState, type: number): number {
  let n = 0;
  for (let i = 0; i < s.events.count; i++) if (s.events.items[i]?.type === type) n++;
  return n;
}

function projectiles(s: SimState, kind: number): number {
  let n = 0;
  for (let e = 0; e < s.world.highWater; e++) {
    if (((s.world.masks[e] ?? 0) & C.Projectile) !== 0 && s.c.renderKind[e] === kind) n++;
  }
  return n;
}

const hit: PlayerHitSpec = {
  damage: 0,
  knockback: 0,
  poiseDamage: 0,
  hitstop: 'none',
  dirX: 1,
  dirY: 0,
  crit: false,
  swingId: 0,
  source: 'attack',
};

describe('rift shot (cast)', () => {
  it('spends charges, refuses when empty and recharges them one by one', () => {
    const s = sim();
    expect(s.player.castCharges).toBe(RIFT_SHOT.charges);
    press(s, Button.Cast, 15);
    expect(count(s, Ev.Shot)).toBe(1);
    press(s, Button.Cast, 15);
    expect(s.player.castCharges).toBe(0);
    press(s, Button.Cast, 15);
    expect(count(s, Ev.Shot)).toBe(2);
    expect(count(s, Ev.Denied)).toBe(1);
    // First charge comes back after rechargeSec (counted from the first shot), not both at once.
    press(s, 0, secondsToTicks(RIFT_SHOT.rechargeSec) - 45 + 2);
    expect(s.player.castCharges).toBe(1);
    press(s, 0, secondsToTicks(RIFT_SHOT.rechargeSec));
    expect(s.player.castCharges).toBe(2);
  });

  it('hits the first enemy in line and stops there', () => {
    const s = sim();
    const near = enemyAt(s, 150);
    const far = enemyAt(s, 300);
    press(s, Button.Cast, 40);
    expect(s.c.hp[near]).toBeLessThan(120);
    expect(s.c.hp[far]).toBe(120);
    expect(projectiles(s, RenderKind.RiftShot)).toBe(0);
  });

  it('cast boons add damage and status to the shot', () => {
    const s = sim([{ id: 'ice_shard', rarity: 'common' }]);
    const e = enemyAt(s, 150);
    press(s, Button.Cast, 40);
    expect(s.c.statusStacks[statusSlot(e, Status.Chill)]).toBe(2);
    expect(120 - (s.c.hp[e] ?? 0)).toBeCloseTo(RIFT_SHOT.damage * 1.25);
  });
});

describe('brand burst (ultimate)', () => {
  it('charges from damage dealt and taken, and is refused until full', () => {
    const s = sim();
    const e = enemyAt(s, 400);
    s.c.hp[e] = 100_000;
    hit.damage = BRAND_BURST.chargeDamageDealt / 2;
    hit.swingId = 1;
    damageEnemy(s, e, hit);
    expect(s.player.ultCharge).toBeCloseTo(0.5);
    press(s, Button.Ultimate, 5);
    expect(count(s, Ev.Denied)).toBe(1);
    hit.swingId = 2;
    damageEnemy(s, e, hit);
    expect(s.player.ultCharge).toBe(1);
    expect(count(s, Ev.UltimateReady)).toBe(1);
  });

  it('blasts every enemy in range, makes the player invulnerable and does not recharge itself', () => {
    const s = sim();
    s.player.ultCharge = 1;
    const inside = enemyAt(s, 200, 100);
    const outside = enemyAt(s, BRAND_BURST.variants.none.radiusPx + 120);
    press(s, Button.Ultimate, 2);
    expect(s.player.action).toBe(PlayerAction.Ultimate);
    expect(s.player.invulnTicks).toBeGreaterThan(0);
    press(s, 0, secondsToTicks(BRAND_BURST.windupSec) + 2);
    expect(count(s, Ev.Ultimate)).toBe(1);
    expect(s.c.hp[inside]).toBe(120 - BRAND_BURST.variants.none.damage);
    expect(s.c.hp[outside]).toBe(120);
    expect(s.player.ultCharge).toBe(0);
  });

  it('takes the flavour of the dominant being', () => {
    const ign = sim([{ id: 'blazing_fury', rarity: 'common' }]);
    ign.player.ultCharge = 1;
    const a = enemyAt(ign, 150);
    press(ign, Button.Ultimate, secondsToTicks(BRAND_BURST.windupSec) + 3);
    expect(ign.c.statusStacks[statusSlot(a, Status.Burn)]).toBe(BRAND_BURST.variants.ignara.stacks);

    const vae = sim([{ id: 'shatter', rarity: 'common' }]);
    vae.player.ultCharge = 1;
    const b = enemyAt(vae, 150);
    press(vae, Button.Ultimate, secondsToTicks(BRAND_BURST.windupSec) + 3);
    expect(vae.c.frozenTicks[b]).toBeGreaterThan(0);
  });

  it('dominant being: most boons, ties go to the latest pick', () => {
    expect(dominantBeing([])).toBeNull();
    expect(
      dominantBeing([
        { id: 'shatter', rarity: 'common' },
        { id: 'blazing_fury', rarity: 'common' },
      ]),
    ).toBe('ignara');
    expect(
      dominantBeing([
        { id: 'shatter', rarity: 'common' },
        { id: 'biting_cold', rarity: 'common' },
        { id: 'blazing_fury', rarity: 'common' },
      ]),
    ).toBe('vaelis');
  });
});

describe('steam burst (duo)', () => {
  it('freezing a burning enemy explodes once and consumes both statuses', () => {
    const s = sim([{ id: 'steam_burst', rarity: 'epic' }]);
    idle(s);
    const target = enemyAt(s, 200);
    const neighbour = enemyAt(s, 260);
    idle(s);
    applyBurn(s, target, 2);
    applyChill(s, target, statusDef(Status.Chill).freezeAtStacks);
    expect(count(s, Ev.Nova)).toBe(1);
    expect(s.c.statusStacks[statusSlot(target, Status.Burn)]).toBe(0);
    expect(s.c.frozenTicks[target]).toBe(0);
    expect(s.c.hp[target]).toBeLessThan(120);
    expect(s.c.hp[neighbour]).toBeLessThan(120);
  });

  it('burning a frozen enemy explodes too', () => {
    const s = sim([{ id: 'steam_burst', rarity: 'epic' }]);
    const target = enemyAt(s, 200);
    idle(s);
    applyChill(s, target, statusDef(Status.Chill).freezeAtStacks);
    expect(count(s, Ev.Nova)).toBe(0);
    applyBurn(s, target, 1);
    expect(count(s, Ev.Nova)).toBe(1);
  });
});

describe('one attack, one hit', () => {
  it('an attack cannot hit again after other attacks landed in between', () => {
    const s = sim();
    const e = enemyAt(s, 400);
    s.c.hp[e] = 10_000;
    hit.damage = 10;
    for (const id of [101, 102, 103]) {
      hit.swingId = id;
      expect(damageEnemy(s, e, hit)).toBe(true);
    }
    // The first attack (e.g. a piercing firebird still overlapping) must not count again.
    hit.swingId = 101;
    expect(damageEnemy(s, e, hit)).toBe(false);
    expect(s.c.hp[e]).toBe(10_000 - 30);
  });

  it('a piercing firebird hits the boss once while the blade keeps hitting it', () => {
    const s = sim([], ['phoenix_blade']);
    const boss = enemyAt(s, 60, 0, ENEMY_TYPE.ember_warden);
    s.c.hp[boss] = 100_000;
    s.c.aiCooldownTicks[boss] = 1_000_000;
    const input = createInputFrame();
    input.hasAim = true;
    input.aimX = 1;
    input.held = Button.Attack;
    let hits = 0;
    for (let i = 0; i < 45; i++) {
      s.events.count = 0;
      stepSim(s, input);
      for (let k = 0; k < s.events.count; k++) {
        const ev = s.events.items[k];
        if (ev?.type === Ev.Hit && ev.eid === boss && (ev.flags & 8) === 0) hits++;
      }
    }
    // One full combo (3 blade hits) plus exactly one firebird hit.
    expect(hits).toBe(4);
  });
});

describe('phoenix blade (evolution)', () => {
  it('the combo finisher releases a piercing firebird that burns', () => {
    const s = sim([], ['phoenix_blade']);
    const a = enemyAt(s, 250, 0, ENEMY_TYPE.brute);
    const b = enemyAt(s, 340, 0, ENEMY_TYPE.brute);
    const input = createInputFrame();
    input.hasAim = true;
    input.aimX = 1;
    input.held = Button.Attack;
    let birds = 0;
    for (let i = 0; i < 90; i++) {
      stepSim(s, input);
      birds = Math.max(birds, projectiles(s, RenderKind.Firebird));
    }
    expect(birds).toBe(1);
    expect(s.c.statusStacks[statusSlot(a, Status.Burn)]).toBeGreaterThan(0);
    expect(s.c.statusStacks[statusSlot(b, Status.Burn)]).toBeGreaterThan(0);
  });

  it('without the evolution, no firebird', () => {
    const s = sim();
    const input = createInputFrame();
    input.held = Button.Attack;
    let birds = 0;
    for (let i = 0; i < 90; i++) {
      stepSim(s, input);
      birds = Math.max(birds, projectiles(s, RenderKind.Firebird));
    }
    expect(birds).toBe(0);
  });
});

function idle(s: SimState, ticks = 1): void {
  press(s, 0, ticks);
}
