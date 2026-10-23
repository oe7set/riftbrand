import { ENEMIES, enemyTypeOf } from '../../content/enemies';
import type { EnemyAttackDef, EnemyDef } from '../../content/schema';
import { AiState, C } from '../ecs/components';
import { Ev, pushEvent } from '../events';
import { type SimState, spawnEnemy } from '../sim';
import { secondsToTicks } from '../time';

/**
 * Mini-boss mechanics of duel rooms (ROADMAP M3.5): parry stances and linked twins. Named
 * handlers, so the content stays declarative (CLAUDE.md rule 4).
 */

/** The linked partner if it is alive and still linked back, else -1. */
export function partnerOf(state: SimState, eid: number): number {
  const c = state.c;
  const other = (c.linkEid[eid] as number) - 1;
  if (other < 0) return -1;
  if (((state.world.masks[other] as number) & C.Enemy) === 0) return -1;
  if ((c.linkEid[other] as number) - 1 !== eid) return -1;
  return other;
}

/** Links a freshly spawned twin to its partner, if one is waiting unlinked. */
export function linkOnSpawn(state: SimState, eid: number, def: EnemyDef): void {
  const link = def.link;
  if (!link) return;
  const partnerType = enemyTypeOf(link.partner);
  const { world, c } = state;
  for (let other = 0; other < world.highWater; other++) {
    if (other === eid || ((world.masks[other] as number) & C.Enemy) === 0) continue;
    if (c.enemyType[other] !== partnerType) continue;
    if (partnerOf(state, other) >= 0) continue;
    c.linkEid[eid] = other + 1;
    c.linkEid[other] = eid + 1;
    c.reviveTicks[other] = 0;
    return;
  }
}

/** Damage factor from the twin bond: close together, both take less damage. */
export function linkedDamageFactor(state: SimState, eid: number): number {
  const def = ENEMIES[state.c.enemyType[eid] as number];
  const link = def?.link;
  if (!link) return 1;
  const other = partnerOf(state, eid);
  if (other < 0) return 1;
  const c = state.c;
  const dx = (c.posX[other] as number) - (c.posX[eid] as number);
  const dy = (c.posY[other] as number) - (c.posY[eid] as number);
  return dx * dx + dy * dy <= link.rangePx * link.rangePx ? 1 - link.damageReduction : 1;
}

/** HP fraction that drives a champion's phase: the pair's combined HP for linked twins. */
export function phaseRatio(state: SimState, eid: number, def: EnemyDef): number {
  const c = state.c;
  const own = (c.hp[eid] as number) / (c.maxHp[eid] as number);
  if (!def.link) return own;
  const other = partnerOf(state, eid);
  if (other < 0) {
    // Enraged (last phase) only once a linked partner has fallen; a twin still waiting for its
    // partner to spawn fights normally.
    return (c.linkEid[eid] as number) > 0 ? 0 : own;
  }
  const hp = (c.hp[eid] as number) + (c.hp[other] as number);
  const max = (c.maxHp[eid] as number) + (c.maxHp[other] as number);
  return hp / max;
}

/** A twin died: its partner starts the revive countdown (unless it is beaten first). */
export function onLinkedDeath(state: SimState, eid: number, type: number): void {
  const def = ENEMIES[type];
  const link = def?.link;
  if (!link) return;
  const other = partnerOf(state, eid);
  if (other < 0) return;
  const c = state.c;
  c.reviveTicks[other] = secondsToTicks(link.reviveSec);
  c.reviveType[other] = type + 1;
  const e = pushEvent(
    state.events,
    Ev.TwinReviveStart,
    c.posX[other] as number,
    c.posY[other] as number,
  );
  if (e) {
    e.eid = other;
    e.amount = link.reviveSec;
  }
}

/** Counts revive timers down; at zero the fallen twin rises next to its partner. */
export function reviveSystem(state: SimState): void {
  const { world, c } = state;
  for (let eid = 0; eid < world.highWater; eid++) {
    if (((world.masks[eid] as number) & C.Enemy) === 0) continue;
    const left = c.reviveTicks[eid] as number;
    if (left <= 0) continue;
    c.reviveTicks[eid] = left - 1;
    if (left > 1) continue;
    const type = (c.reviveType[eid] as number) - 1;
    const def = ENEMIES[type];
    if (!def?.link) continue;
    const x = (c.posX[eid] as number) + 60;
    const y = c.posY[eid] as number;
    const twin = spawnEnemy(state, type, x, y);
    if (twin < 0) continue;
    c.hp[twin] = (c.maxHp[twin] as number) * def.link.reviveHpFraction;
    const e = pushEvent(state.events, Ev.TwinRevived, x, y);
    if (e) {
      e.eid = twin;
      e.value = type;
    }
  }
}

/** The guard attack the enemy is holding right now, if it is in its stance. */
export function activeGuard(
  state: SimState,
  eid: number,
  atk: EnemyAttackDef,
): Extract<EnemyAttackDef, { kind: 'guard' }> | null {
  return atk.kind === 'guard' && state.c.aiState[eid] === AiState.Windup ? atk : null;
}

/** Whether a hit pushing along (dirX, dirY) comes from inside the guarded front. */
export function hitsGuardedFront(
  state: SimState,
  eid: number,
  dirX: number,
  dirY: number,
  frontArcDeg: number,
): boolean {
  const c = state.c;
  // The push points away from the attacker, so the attacker sits at −dir.
  const facing = -dirX * (c.facingX[eid] as number) - dirY * (c.facingY[eid] as number);
  return facing >= Math.cos(((frontArcDeg / 2) * Math.PI) / 180);
}
