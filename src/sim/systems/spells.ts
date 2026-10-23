import { type SpellDef, type StatusId, statusIdSchema } from '../../content/schema';
import { SPELLS } from '../../content/spells';
import { statusIndex } from '../../content/statuses';
import { C, RenderKind, stacksOf, Team } from '../ecs/components';
import { addComponents, destroyEntity } from '../ecs/world';
import { areaBurst, type BurstSpec, lineBurst } from '../effects/runtime';
import { Ev, pushEvent } from '../events';
import { PlayerAction } from '../player-state';
import { type SimState, spawnEntity } from '../sim';
import { secondsToTicks } from '../time';

/** Cooldown reduction never goes beyond this, so spells stay a decision, not a spam button. */
export const MAX_COOLDOWN_REDUCTION = 0.5;

const spellSpec: BurstSpec = {
  radiusPx: 0,
  damage: 0,
  status: null,
  stacks: 0,
  freeze: false,
  knockback: 0,
  source: 'spell',
};

export function activeSpellDef(state: SimState): SpellDef | undefined {
  return SPELLS[state.player.activeSpell];
}

export function auraSpellDef(state: SimState): SpellDef | undefined {
  return SPELLS[state.player.auraSpell];
}

/** Cooldown of the active spell in ticks, after cooldown reduction. */
export function spellCooldownTicks(state: SimState, def: SpellDef): number {
  const cdr = Math.min(MAX_COOLDOWN_REDUCTION, Math.max(0, state.build.stats.cooldownReduction));
  return Math.max(1, secondsToTicks(def.cooldownSec * (1 - cdr)));
}

export function auraRadiusPx(state: SimState, def: SpellDef): number {
  const fx = def.effect;
  const base = fx.type === 'beam' ? fx.widthPx / 2 : fx.radiusPx;
  return base * (1 + state.build.stats.auraRadius);
}

/** Fills the shared burst spec from a spell's hit data. */
function prepareHit(
  def: SpellDef,
  radiusPx: number,
  damage: number,
  status: StatusId | undefined,
  stacks: number,
  knockback: number,
  freeze: boolean,
): BurstSpec {
  spellSpec.radiusPx = radiusPx;
  spellSpec.damage = damage;
  spellSpec.status = status ?? null;
  spellSpec.stacks = stacks;
  spellSpec.knockback = knockback;
  spellSpec.freeze = freeze;
  spellSpec.source = def.kind === 'aura' ? 'aura' : 'spell';
  return spellSpec;
}

/**
 * A lingering player area (meteor impact marker, poison cloud). It pulses its hit every
 * `pulseSec`; a single pulse at the end of its life makes a delayed blast.
 */
export function spawnPlayerZone(
  state: SimState,
  spell: number,
  x: number,
  y: number,
  radiusPx: number,
  lifeSec: number,
  pulseSec: number,
  damage: number,
  status: StatusId | undefined,
  stacks: number,
  knockback: number,
): number {
  const r = radiusPx;
  const cx = Math.min(Math.max(x, r * 0.3), state.arenaWidthPx - r * 0.3);
  const cy = Math.min(Math.max(y, r * 0.3), state.arenaHeightPx - r * 0.3);
  const eid = spawnEntity(state, cx, cy);
  if (eid === -1) return -1;
  addComponents(state.world, eid, C.Transform | C.Zone | C.Renderable);
  const c = state.c;
  c.radius[eid] = r;
  c.renderKind[eid] = RenderKind.Zone;
  c.team[eid] = Team.Player;
  c.zoneSpell[eid] = spell;
  c.projDamage[eid] = damage;
  c.projStatus[eid] = status ? statusIndex(status) + 1 : 0;
  c.projStacks[eid] = stacks;
  c.projKnockback[eid] = knockback;
  const life = Math.max(1, secondsToTicks(lifeSec));
  const pulse = Math.max(1, secondsToTicks(pulseSec));
  c.projLifeTicks[eid] = life;
  c.hazFuseTotal[eid] = life;
  c.zonePulseTicks[eid] = pulse;
  c.zoneTimer[eid] = pulse;
  return eid;
}

/** Pulses and expires player zones. */
export function playerZoneSystem(state: SimState): void {
  const { world, c } = state;
  for (let eid = 0; eid < world.highWater; eid++) {
    if (((world.masks[eid] as number) & C.Zone) === 0) continue;
    const def = SPELLS[c.zoneSpell[eid] as number];
    const timer = (c.zoneTimer[eid] as number) - 1;
    const life = (c.projLifeTicks[eid] as number) - 1;
    c.projLifeTicks[eid] = life;
    if (timer <= 0 && def) {
      c.zoneTimer[eid] = c.zonePulseTicks[eid] as number;
      const x = c.posX[eid] as number;
      const y = c.posY[eid] as number;
      const r = c.radius[eid] as number;
      const status = c.projStatus[eid] as number;
      const spec = prepareHit(
        def,
        r,
        c.projDamage[eid] as number,
        status > 0 ? statusIdSchema.options[status - 1] : undefined,
        c.projStacks[eid] as number,
        c.projKnockback[eid] as number,
        false,
      );
      const hits = areaBurst(state, x, y, spec);
      const e = pushEvent(state.events, Ev.ZonePulse, x, y);
      if (e) {
        e.value = c.zoneSpell[eid] as number;
        e.amount = r;
        e.flags = hits;
      }
    } else {
      c.zoneTimer[eid] = timer;
    }
    if (life <= 0) destroyEntity(world, eid);
  }
}

/**
 * Releases the active spell at the end of its windup (player-actions calls this). The player's
 * current direction (aim-assisted when the cast started) picks the target point.
 */
export function releaseActiveSpell(state: SimState): void {
  const def = activeSpellDef(state);
  if (!def) return;
  const p = state.player;
  const c = state.c;
  const eid = state.playerEid;
  const fx = def.effect;
  const px = c.posX[eid] as number;
  const py = c.posY[eid] as number;
  const target = (fx.type === 'burst' || fx.type === 'zone') && fx.at === 'target';
  const range = target ? fx.rangePx : 0;
  const x = px + p.dirX * range;
  const y = py + p.dirY * range;
  const e = pushEvent(state.events, Ev.SpellCast, x, y);
  if (e) {
    e.value = p.activeSpell;
    e.amount = fx.type === 'beam' ? fx.lengthPx : fx.radiusPx;
    e.dirX = p.dirX;
    e.dirY = p.dirY;
  }
  switch (fx.type) {
    case 'burst':
      if (fx.delaySec > 0) {
        // The impact spot is marked and fills up, then the blast lands (meteor).
        spawnPlayerZone(
          state,
          p.activeSpell,
          x,
          y,
          fx.radiusPx,
          fx.delaySec,
          fx.delaySec,
          fx.damage,
          fx.status,
          fx.stacks,
          fx.knockback,
        );
      } else {
        areaBurst(
          state,
          x,
          y,
          prepareHit(def, fx.radiusPx, fx.damage, fx.status, fx.stacks, fx.knockback, fx.freeze),
        );
      }
      break;
    case 'zone':
      spawnPlayerZone(
        state,
        p.activeSpell,
        x,
        y,
        fx.radiusPx,
        fx.durationSec,
        fx.pulseSec,
        fx.damage,
        fx.status,
        fx.stacks,
        fx.knockback,
      );
      break;
    case 'beam':
      lineBurst(
        state,
        px,
        py,
        px + p.dirX * fx.lengthPx,
        py + p.dirY * fx.lengthPx,
        prepareHit(def, fx.widthPx / 2, fx.damage, fx.status, fx.stacks, fx.knockback, false),
      );
      break;
    case 'ward':
      dissolveShots(state, p.activeSpell, px, py, fx.radiusPx, fx.count);
      break;
  }
}

/** Starts the cooldown when the cast begins, so cancelling the windup can't refund it. */
export function startSpellCooldown(state: SimState): void {
  const def = activeSpellDef(state);
  if (!def) return;
  const ticks = spellCooldownTicks(state, def);
  state.player.spellCooldownTicks = ticks;
  state.player.spellCooldownTotal = ticks;
}

/**
 * Removes up to `count` enemy shots within the radius, nearest first (halo ward). Shots are
 * not in the spatial hash, so this scans entities; it only runs once per pulse.
 */
function dissolveShots(
  state: SimState,
  spell: number,
  x: number,
  y: number,
  radiusPx: number,
  count: number,
): number {
  const { world, c } = state;
  let removed = 0;
  for (let k = 0; k < count; k++) {
    let best = -1;
    let bestDist = radiusPx * radiusPx;
    for (let e = 0; e < world.highWater; e++) {
      if (((world.masks[e] as number) & C.Projectile) === 0 || c.team[e] !== Team.Enemy) continue;
      const dx = (c.posX[e] as number) - x;
      const dy = (c.posY[e] as number) - y;
      const d = dx * dx + dy * dy;
      if (d <= bestDist) {
        best = e;
        bestDist = d;
      }
    }
    if (best < 0) break;
    const ev = pushEvent(
      state.events,
      Ev.ShotDissolved,
      c.posX[best] as number,
      c.posY[best] as number,
    );
    if (ev) ev.value = spell;
    destroyEntity(world, best);
    removed++;
  }
  return removed;
}

/**
 * Follow-up of an equipped spell when an enemy dies (plague breath: poisoned enemies leave a
 * small cloud). killEnemy calls this while the enemy's status slots are still intact.
 */
export function onEnemyKilledWithSpells(state: SimState, eid: number, x: number, y: number): void {
  const p = state.player;
  for (let slot = 0; slot < 2; slot++) {
    const index = slot === 0 ? p.activeSpell : p.auraSpell;
    const def = SPELLS[index];
    const k = def?.onKill;
    if (!k) continue;
    if (stacksOf(state.c, eid, statusIndex(k.requiresStatus)) <= 0) continue;
    spawnPlayerZone(
      state,
      index,
      x,
      y,
      k.radiusPx,
      k.durationSec,
      k.pulseSec,
      k.damage,
      k.status,
      k.stacks,
      k.knockback,
    );
  }
}

/** Spell cooldown, aura pulses and spell zones (ROADMAP M3.2/M3.3). Runs after player actions. */
export function spellSystem(state: SimState): void {
  playerZoneSystem(state);
  const p = state.player;
  const eid = state.playerEid;
  if (eid < 0 || state.gameOver || p.action === PlayerAction.Dead) return;
  const c = state.c;
  if (p.spellCooldownTicks > 0) {
    p.spellCooldownTicks--;
    if (p.spellCooldownTicks === 0 && p.activeSpell >= 0) {
      const e = pushEvent(
        state.events,
        Ev.SpellReady,
        c.posX[eid] as number,
        c.posY[eid] as number,
      );
      if (e) e.value = p.activeSpell;
    }
  }
  const aura = auraSpellDef(state);
  if (!aura) return;
  if (p.auraTimerTicks > 0) {
    p.auraTimerTicks--;
    return;
  }
  p.auraTimerTicks = Math.max(1, secondsToTicks(aura.pulseSec)) - 1;
  const x = c.posX[eid] as number;
  const y = c.posY[eid] as number;
  const radius = auraRadiusPx(state, aura);
  const fx = aura.effect;
  let hits = 0;
  if (fx.type === 'ward') hits = dissolveShots(state, p.auraSpell, x, y, radius, fx.count);
  else if (fx.type === 'burst' || fx.type === 'zone') {
    hits = areaBurst(
      state,
      x,
      y,
      prepareHit(
        aura,
        radius,
        fx.damage,
        fx.status,
        fx.stacks,
        fx.knockback,
        fx.type === 'burst' && fx.freeze,
      ),
    );
  }
  const e = pushEvent(state.events, Ev.AuraPulse, x, y);
  if (e) {
    e.value = p.auraSpell;
    e.amount = radius;
    e.flags = hits;
  }
}
