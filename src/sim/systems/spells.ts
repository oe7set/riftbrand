import { type SpellDef, type StatusId, statusIdSchema } from '../../content/schema';
import { SPELLS } from '../../content/spells';
import { statusIndex } from '../../content/statuses';
import { TUNING } from '../../content/tuning';
import { C, RenderKind, stacksOf, Team } from '../ecs/components';
import { addComponents, destroyEntity } from '../ecs/world';
import { areaBurst, type BurstSpec, lineBurst } from '../effects/runtime';
import { Ev, pushEvent } from '../events';
import { PlayerAction } from '../player-state';
import type { ResolvedSpell } from '../run/upgrades';
import { type SimState, spawnEntity } from '../sim';
import { secondsToTicks } from '../time';

/** Cooldown reduction never goes beyond this, so spells stay a decision, not a spam button. */
export const MAX_COOLDOWN_REDUCTION = 0.5;
const DEG = Math.PI / 180;

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
  return state.activeSpell?.def;
}

export function auraSpellDef(state: SimState): SpellDef | undefined {
  return state.auraSpell?.def;
}

/** Cooldown in ticks after cooldown reduction from the build. */
export function spellCooldownTicks(state: SimState, cooldownSec: number): number {
  const cdr = Math.min(MAX_COOLDOWN_REDUCTION, Math.max(0, state.build.stats.cooldownReduction));
  return Math.max(1, secondsToTicks(cooldownSec * (1 - cdr)));
}

export function auraRadiusPx(state: SimState, spell: ResolvedSpell): number {
  return spell.radiusPx * (1 + state.build.stats.auraRadius);
}

function statusOf(def: SpellDef): StatusId | undefined {
  const fx = def.effect;
  return fx.type === 'ward' ? undefined : fx.status;
}

/** Fills the shared burst spec from a resolved spell. */
function prepareHit(spell: ResolvedSpell, radiusPx: number): BurstSpec {
  const fx = spell.def.effect;
  spellSpec.radiusPx = radiusPx;
  spellSpec.damage = spell.damage;
  spellSpec.status = statusOf(spell.def) ?? null;
  spellSpec.stacks = spell.stacks;
  spellSpec.knockback = spell.knockback;
  spellSpec.freeze = fx.type === 'burst' && fx.freeze;
  spellSpec.source = spell.def.kind === 'aura' ? 'aura' : 'spell';
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
      spellSpec.radiusPx = r;
      spellSpec.damage = c.projDamage[eid] as number;
      spellSpec.status = status > 0 ? (statusIdSchema.options[status - 1] ?? null) : null;
      spellSpec.stacks = c.projStacks[eid] as number;
      spellSpec.knockback = c.projKnockback[eid] as number;
      spellSpec.freeze = false;
      spellSpec.source = def.kind === 'aura' ? 'aura' : 'spell';
      const hits = areaBurst(state, x, y, spellSpec);
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

/** A delayed copy of the spell's blast (echo of a nova, one meteor of a shower). */
function delayedBlast(
  state: SimState,
  spell: ResolvedSpell,
  x: number,
  y: number,
  delaySec: number,
): void {
  spawnPlayerZone(
    state,
    spell.index,
    x,
    y,
    spell.radiusPx,
    delaySec,
    delaySec,
    spell.damage,
    statusOf(spell.def),
    spell.stacks,
    spell.knockback,
  );
}

/**
 * Releases the active spell at the end of its windup (player-actions calls this). The player's
 * current direction (aim-assisted when the cast started) picks the target point. Upgrades add
 * echoes, meteor showers, more clouds or a fan of beams (ROADMAP M3.4).
 */
export function releaseActiveSpell(state: SimState): void {
  const spell = state.activeSpell;
  if (!spell) return;
  const def = spell.def;
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
  // Beams fan out around the aim; the cast event carries the first beam's direction.
  const beams = fx.type === 'beam' ? 1 + spell.extra : 1;
  const firstAngle = Math.atan2(p.dirY, p.dirX) - ((beams - 1) / 2) * TUNING.upgradeFanDeg * DEG;
  const e = pushEvent(state.events, Ev.SpellCast, x, y);
  if (e) {
    e.value = spell.index;
    e.amount = fx.type === 'beam' ? fx.lengthPx : spell.radiusPx;
    e.dirX = beams > 1 ? Math.cos(firstAngle) : p.dirX;
    e.dirY = beams > 1 ? Math.sin(firstAngle) : p.dirY;
  }
  const echo = TUNING.upgradeEchoSec;
  switch (fx.type) {
    case 'burst':
      if (fx.delaySec > 0) {
        delayedBlast(state, spell, x, y, fx.delaySec);
      } else {
        areaBurst(state, x, y, prepareHit(spell, spell.radiusPx));
      }
      for (let i = 1; i <= spell.extra; i++) {
        if (target) {
          // Meteor shower: the extra impacts ring the target point, a little later each.
          const a = (i / spell.extra) * Math.PI * 2 + Math.atan2(p.dirY, p.dirX);
          const d = spell.radiusPx * 1.2;
          delayedBlast(
            state,
            spell,
            x + Math.cos(a) * d,
            y + Math.sin(a) * d,
            fx.delaySec + echo * i * 0.5,
          );
        } else {
          // Echo: the blast repeats where it was cast.
          delayedBlast(state, spell, x, y, fx.delaySec + echo * i);
        }
      }
      break;
    case 'zone':
      for (let i = 0; i <= spell.extra; i++) {
        // Extra clouds sit side by side across the aim direction.
        const side = i === 0 ? 0 : (i % 2 === 1 ? 1 : -1) * Math.ceil(i / 2) * spell.radiusPx * 1.6;
        spawnPlayerZone(
          state,
          spell.index,
          x - p.dirY * side,
          y + p.dirX * side,
          spell.radiusPx,
          spell.durationSec,
          fx.pulseSec,
          spell.damage,
          fx.status,
          spell.stacks,
          spell.knockback,
        );
      }
      break;
    case 'beam': {
      for (let i = 0; i < beams; i++) {
        const a = firstAngle + i * TUNING.upgradeFanDeg * DEG;
        const dx = Math.cos(a);
        const dy = Math.sin(a);
        lineBurst(
          state,
          px,
          py,
          px + dx * fx.lengthPx,
          py + dy * fx.lengthPx,
          prepareHit(spell, spell.radiusPx),
        );
        if (i > 0) {
          // Further beams of the fan get their own visual (flags = 1: no extra sound).
          const ev = pushEvent(state.events, Ev.SpellCast, px, py);
          if (ev) {
            ev.value = spell.index;
            ev.amount = fx.lengthPx;
            ev.dirX = dx;
            ev.dirY = dy;
            ev.flags = 1;
          }
        }
      }
      break;
    }
    case 'ward':
      dissolveShots(state, spell.index, px, py, spell.radiusPx, 1 + spell.extra);
      break;
  }
}

/** Starts the cooldown when the cast begins, so cancelling the windup can't refund it. */
export function startSpellCooldown(state: SimState): void {
  const spell = state.activeSpell;
  if (!spell) return;
  const ticks = spellCooldownTicks(state, spell.cooldownSec);
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
  for (let slot = 0; slot < 2; slot++) {
    const spell = slot === 0 ? state.activeSpell : state.auraSpell;
    const k = spell?.def.onKill;
    if (!spell || !k) continue;
    if (stacksOf(state.c, eid, statusIndex(k.requiresStatus)) <= 0) continue;
    spawnPlayerZone(
      state,
      spell.index,
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
  const aura = state.auraSpell;
  if (!aura) return;
  if (p.auraTimerTicks > 0) {
    p.auraTimerTicks--;
    return;
  }
  p.auraTimerTicks = Math.max(1, secondsToTicks(aura.pulseSec)) - 1;
  const x = c.posX[eid] as number;
  const y = c.posY[eid] as number;
  const radius = auraRadiusPx(state, aura);
  const hits =
    aura.def.effect.type === 'ward'
      ? dissolveShots(state, aura.index, x, y, radius, 1 + aura.extra)
      : areaBurst(state, x, y, prepareHit(aura, radius));
  const e = pushEvent(state.events, Ev.AuraPulse, x, y);
  if (e) {
    e.value = aura.index;
    e.amount = radius;
    e.flags = hits;
  }
}
