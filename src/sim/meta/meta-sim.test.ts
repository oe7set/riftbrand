import { describe, expect, it } from 'vitest';
import { ENEMY_TYPE } from '../../content/enemies';
import { ROOMS } from '../../content/rooms';
import type { RoomTemplateDef } from '../../content/schema';
import { TUNING } from '../../content/tuning';
import { damagePlayer } from '../combat/damage';
import { Ev } from '../events';
import type { RoomSetup } from '../run/run-state';
import { createSim } from '../sim';

function setup(over: Partial<RoomSetup>): RoomSetup {
  return {
    template: ROOMS[0] as RoomTemplateDef,
    encounter: { kind: 'none' },
    playerHp: 50,
    playerMaxHp: 100,
    boons: [],
    relics: [],
    shards: 0,
    evolutions: [],
    ultCharge: 0,
    bonusAllDamage: 0,
    bonusStaminaRegen: 0,
    staminaBonus: 0,
    lastSparks: 0,
    lastSparkHeal: 0,
    ...over,
  };
}

describe('Ember Tree effects in the room', () => {
  it('Last Spark refuses one lethal hit, then the next one kills', () => {
    const sim = createSim(1, setup({ lastSparks: 1, lastSparkHeal: 0.4 }));
    damagePlayer(sim, 999, 0, 0, ENEMY_TYPE.brute);
    expect(sim.gameOver).toBe(false);
    expect(sim.c.hp[sim.playerEid]).toBe(40);
    expect(sim.lastSparks).toBe(0);
    expect(sim.events.items.slice(0, sim.events.count).some((e) => e.type === Ev.LastSpark)).toBe(
      true,
    );
    sim.player.invulnTicks = 0;
    damagePlayer(sim, 999, 0, 0, ENEMY_TYPE.brute);
    expect(sim.gameOver).toBe(true);
    expect(sim.killedBy).toBe(ENEMY_TYPE.brute);
  });

  it('a fourth stamina segment and damage bonus apply', () => {
    const sim = createSim(1, setup({ staminaBonus: 1, bonusAllDamage: 0.12 }));
    expect(sim.staminaMax).toBe(TUNING.staminaMax + 1);
    expect(sim.player.stamina).toBe(TUNING.staminaMax + 1);
    expect(sim.build.stats.allDamage).toBeCloseTo(0.12);
  });
});
