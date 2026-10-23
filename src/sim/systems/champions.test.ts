import { describe, expect, it } from 'vitest';
import { EMBER_WASTES } from '../../content/biomes/ember-wastes';
import { ENEMY_TYPE } from '../../content/enemies';
import { TWIN_SPARK } from '../../content/enemies/twin-spark';
import { createInputFrame } from '../../shared/input-frame';
import { damageEnemy, killEnemy, type PlayerHitSpec } from '../combat/damage';
import { AiState, C } from '../ecs/components';
import { Ev } from '../events';
import { createRng } from '../rng/rng';
import { buildEncounter } from '../run/encounter';
import { generateMap } from '../run/map';
import { createSim, type SimState, spawnEnemy, stepSim } from '../sim';
import { secondsToTicks } from '../time';
import { linkedDamageFactor, partnerOf } from './champions';

function sim(): SimState {
  const s = createSim(9);
  s.debug.wavesEnabled = false;
  s.debug.godMode = true;
  return s;
}

function at(s: SimState, type: number, dx: number, dy = 0): number {
  const e = spawnEnemy(
    s,
    type,
    (s.c.posX[s.playerEid] ?? 0) + dx,
    (s.c.posY[s.playerEid] ?? 0) + dy,
  );
  s.c.aiCooldownTicks[e] = 1_000_000;
  return e;
}

function idle(s: SimState, ticks: number): number[] {
  const input = createInputFrame();
  const seen: number[] = [];
  for (let i = 0; i < ticks; i++) {
    s.events.count = 0;
    stepSim(s, input);
    for (let k = 0; k < s.events.count; k++) seen.push(s.events.items[k]?.type ?? 0);
  }
  return seen;
}

let swing = 1000;
function hit(source: PlayerHitSpec['source'], dirX: number, dirY = 0): PlayerHitSpec {
  return {
    damage: 30,
    knockback: 0,
    poiseDamage: 0,
    hitstop: 'none',
    dirX,
    dirY,
    crit: false,
    swingId: ++swing,
    source,
  };
}

/** Puts the duelist into its parry stance, facing the player (to its left). */
function guarding(s: SimState): number {
  const e = at(s, ENEMY_TYPE.ember_duelist, 60);
  s.c.aiPattern[e] = 2;
  s.c.aiState[e] = AiState.Windup;
  s.c.aiTicks[e] = 0;
  s.c.facingX[e] = -1;
  s.c.facingY[e] = 0;
  return e;
}

describe('duel rooms on the map', () => {
  it('places one or two duels between layer 3 and the rest layer', () => {
    for (let seed = 1; seed < 40; seed++) {
      const map = generateMap(createRng(seed), EMBER_WASTES);
      const duels = map.nodes.filter((n) => n.type === 'duel');
      expect(duels.length).toBeGreaterThanOrEqual(EMBER_WASTES.duelsMin);
      expect(duels.length).toBeLessThanOrEqual(EMBER_WASTES.duelsMax);
      for (const d of duels) {
        expect(d.layer).toBeGreaterThanOrEqual(EMBER_WASTES.duelMinLayer);
        expect(d.layer).toBeLessThan(EMBER_WASTES.layers - 2);
      }
    }
  });

  it('a duel encounter is one of the line-ups', () => {
    const enc = buildEncounter(createRng(3), EMBER_WASTES, 'duel', 4);
    expect(enc.kind).toBe('waves');
    if (enc.kind === 'waves') expect([1, 2]).toContain(enc.waves[0]?.length);
  });
});

describe('parry stance', () => {
  it('counters a melee hit into its front and takes no damage', () => {
    const s = sim();
    s.debug.godMode = false;
    const e = guarding(s);
    const hp = s.c.hp[e] as number;
    const playerHp = s.c.hp[s.playerEid] as number;
    s.events.count = 0;
    // The push points away from the player (who stands to the left): +x.
    damageEnemy(s, e, hit('attack', 1));
    expect(s.c.hp[e]).toBe(hp);
    expect(s.c.hp[s.playerEid]).toBeLessThan(playerHp);
    expect(s.c.aiState[e]).toBe(AiState.Recover);
  });

  it('breaks on a hit from behind or from a shot, and takes the damage', () => {
    for (const [source, dir] of [
      ['attack', -1],
      ['cast', 1],
    ] as const) {
      const s = sim();
      const e = guarding(s);
      const hp = s.c.hp[e] as number;
      damageEnemy(s, e, hit(source, dir));
      expect(s.c.hp[e]).toBeLessThan(hp);
      expect(s.c.aiState[e]).toBe(AiState.Stagger);
    }
  });
});

describe('twins', () => {
  it('link on spawn and shield each other only when close', () => {
    const s = sim();
    const spark = at(s, ENEMY_TYPE.twin_spark, 200);
    const ash = at(s, ENEMY_TYPE.twin_ash, 260);
    expect(partnerOf(s, spark)).toBe(ash);
    expect(linkedDamageFactor(s, spark)).toBeCloseTo(1 - (TWIN_SPARK.link?.damageReduction ?? 0));
    s.c.posX[ash] = (s.c.posX[spark] as number) + 600;
    expect(linkedDamageFactor(s, spark)).toBe(1);
  });

  it('the survivor revives its partner unless it falls first', () => {
    const s = sim();
    const spark = at(s, ENEMY_TYPE.twin_spark, 300);
    const ash = at(s, ENEMY_TYPE.twin_ash, 360);
    killEnemy(s, ash, 1, 0);
    expect(s.c.reviveTicks[spark]).toBeGreaterThan(0);
    const events = idle(s, secondsToTicks(TWIN_SPARK.link?.reviveSec ?? 8) + 2);
    expect(events).toContain(Ev.TwinRevived);
    let ashes = 0;
    for (let i = 0; i < s.world.highWater; i++) {
      if (((s.world.masks[i] ?? 0) & C.Enemy) !== 0 && s.c.enemyType[i] === ENEMY_TYPE.twin_ash) {
        ashes++;
        expect((s.c.hp[i] as number) / (s.c.maxHp[i] as number)).toBeCloseTo(0.3);
        expect(partnerOf(s, i)).toBe(spark);
      }
    }
    expect(ashes).toBe(1);
  });

  it('a twin waiting for its partner to spawn is not enraged', () => {
    const s = sim();
    const spark = at(s, ENEMY_TYPE.twin_spark, 300);
    idle(s, 2);
    expect(s.c.aiPhase[spark]).toBe(0);
  });

  it('a lone twin fights in its enraged last phase', () => {
    const s = sim();
    const spark = at(s, ENEMY_TYPE.twin_spark, 300);
    const ash = at(s, ENEMY_TYPE.twin_ash, 360);
    killEnemy(s, ash, 1, 0);
    idle(s, 2);
    expect(s.c.aiPhase[spark]).toBe((TWIN_SPARK.boss?.phases.length ?? 1) - 1);
  });
});
