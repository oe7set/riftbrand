import { afterEach, describe, expect, it } from 'vitest';
import { ENEMIES, ENEMY_TYPE } from '../../content/enemies';
import { resetTunables } from '../../content/tunables';
import { TUNING } from '../../content/tuning';
import { BRAND_BLADE } from '../../content/weapons/brand-blade';
import { Button, createInputFrame } from '../../shared/input-frame';
import { killEnemy } from '../combat/damage';
import { createSim, type SimState, setBuild, spawnEnemy, stepSim } from '../sim';
import { forceClearRoom } from '../systems/waves';
import type { OwnedRelic } from './build';

afterEach(() => resetTunables());

function sim(relics: OwnedRelic[]): SimState {
  const s = createSim(6);
  s.debug.wavesEnabled = false;
  setBuild(s, [], relics);
  TUNING.critChance = 0;
  return s;
}

function enemyAt(s: SimState, dx: number, type: number = ENEMY_TYPE.brute): number {
  const e = spawnEnemy(s, type, (s.c.posX[s.playerEid] ?? 0) + dx, s.c.posY[s.playerEid] ?? 0);
  s.c.aiCooldownTicks[e] = 1_000_000;
  return e;
}

describe('relics in combat', () => {
  it('ember stone raises all damage', () => {
    const s = sim([{ id: 'ember_stone', stacks: 2 }]);
    const e = enemyAt(s, 50);
    const input = createInputFrame();
    input.hasAim = true;
    input.aimX = 1;
    input.pressed = Button.Attack;
    for (let i = 0; i < 12; i++) {
      stepSim(s, input);
      input.pressed = 0;
    }
    expect((s.c.maxHp[e] ?? 0) - (s.c.hp[e] ?? 0)).toBeCloseTo(
      (BRAND_BLADE.combo[0]?.damage ?? 0) * 1.16,
    );
  });

  it('kills drop shards, boosted by shard gain', () => {
    const s = sim([]);
    killEnemy(s, enemyAt(s, 300, ENEMY_TYPE.slag), 1, 0);
    expect(s.shards).toBe(ENEMIES[ENEMY_TYPE.slag]?.shardValue);
  });

  it('leech charm heals on every kill', () => {
    const s = sim([{ id: 'leech_charm', stacks: 2 }]);
    s.c.hp[s.playerEid] = 50;
    killEnemy(s, enemyAt(s, 300, ENEMY_TYPE.slag), 1, 0);
    expect(s.c.hp[s.playerEid]).toBe(52);
  });

  it('second wind heals when the room is cleared, not on scripted kills', () => {
    const s = createSim(1, {
      template: {
        id: 'test_room',
        widthPx: 800,
        heightPx: 800,
        types: ['combat'],
        obstacles: [],
        playerStart: { x: 400, y: 600 },
        exit: { x: 400, y: 100 },
        spawnPoints: [],
      },
      encounter: { kind: 'waves', waves: [[0]] },
      playerHp: 50,
      playerMaxHp: 100,
      boons: [],
      relics: [{ id: 'second_wind', stacks: 1 }],
      shards: 0,
    });
    const input = createInputFrame();
    for (let i = 0; i < 120; i++) stepSim(s, input);
    forceClearRoom(s);
    stepSim(s, input);
    expect(s.room.cleared).toBe(true);
    expect(s.c.hp[s.playerEid]).toBe(56);
    expect(s.shards).toBe(0);
  });
});
