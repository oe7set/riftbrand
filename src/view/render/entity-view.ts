import { Container, Sprite, type Texture } from 'pixi.js';
import { eliteOf } from '../../content/elites';
import { attackOf, ENEMIES } from '../../content/enemies';
import { SPELLS } from '../../content/spells';
import { Status, statusDef } from '../../content/statuses';
import { TUNING } from '../../content/tuning';
import { AiState, C, RenderKind, stacksOf } from '../../sim/ecs/components';
import { PlayerAction } from '../../sim/player-state';
import type { SimState } from '../../sim/sim';
import { linkedDamageFactor, partnerOf } from '../../sim/systems/champions';
import { secondsToTicks } from '../../sim/time';
import { StatusIcons } from '../vfx/status-overlay';
import { PALETTE } from './palette';
import { BAKE_RADIUS_PX, type BakedTextures, type BodyTextures } from './textures';

const SPAWN_POP_SEC = 0.25;
const HP_BAR_WIDTH_PX = 34;
const HP_BAR_HEIGHT_PX = 4;
const INVULN_BLINK_HZ = 16;

/** Per-entity-slot display objects, created lazily and reused for the slot's next occupant. */
interface Slot {
  body: Sprite;
  /** Ground telegraph: ring outline + filling disc (slam) or bar + filling bar (lunge). */
  teleBack: Sprite;
  teleFill: Sprite;
  hpBack: Sprite;
  hpFill: Sprite;
  /** Status aura: ember glow (burn), poison haze or ice shell (frozen). */
  aura: Sprite;
  /** Ice crust that thickens with chill stacks. */
  crust: Sprite;
  /** Light halo over the head of blinded enemies. */
  halo: Sprite;
  /** Twin bond: a line to the partner while it shields (ROADMAP M3.5). */
  tether: Sprite;
  /** Twin revive countdown: a ring closing in on the survivor. */
  revive: Sprite;
  /** Elite marker: coloured halo, plus the frontal shield arc for shielded elites. */
  eliteRing: Sprite;
  shield: Sprite;
  generation: number;
}

/**
 * Draws all sim entities with interpolation, hit flash, squash & stretch, spawn pop,
 * invulnerability blink, enemy health bars and attack telegraphs (GDD §4.6/§4.7).
 */
export class EntityView {
  readonly groundLayer = new Container();
  readonly bodyLayer = new Container();
  readonly overlayLayer = new Container();
  readonly statusIcons: StatusIcons;
  private readonly slots: Array<Slot | undefined> = [];
  private readonly flashSec = new Float32Array(4096);
  private readonly squashSec = new Float32Array(4096);
  private readonly squashDirX = new Float32Array(4096);
  private readonly squashDirY = new Float32Array(4096);
  private readonly ageSec = new Float32Array(4096);
  private time = 0;

  constructor(private readonly textures: BakedTextures) {
    this.statusIcons = new StatusIcons(textures);
  }

  /** Hit feedback: white flash plus a squash along the hit direction. */
  hit(eid: number, dirX: number, dirY: number): void {
    this.flashSec[eid] = TUNING.hitFlashSec;
    this.squashSec[eid] = TUNING.squashSec;
    this.squashDirX[eid] = dirX;
    this.squashDirY[eid] = dirY;
  }

  private bodyTextures(sim: SimState, eid: number): BodyTextures | null {
    switch (sim.c.renderKind[eid]) {
      case RenderKind.Player:
        return this.textures.player;
      case RenderKind.Drifter:
        return this.textures.drifter;
      case RenderKind.Enemy:
        return this.textures.enemies[sim.c.enemyType[eid] as number] ?? null;
      case RenderKind.RiftShot:
        return this.textures.riftShot;
      case RenderKind.Firebird:
        return this.textures.firebird;
      default:
        return null;
    }
  }

  private slotFor(eid: number, texture: Texture): Slot {
    let slot = this.slots[eid];
    if (slot) return slot;
    const make = (t: Texture, layer: Container) => {
      const s = new Sprite(t);
      s.anchor.set(0.5);
      s.visible = false;
      layer.addChild(s);
      return s;
    };
    slot = {
      teleBack: make(this.textures.ring, this.groundLayer),
      teleFill: make(this.textures.disc, this.groundLayer),
      body: make(texture, this.bodyLayer),
      hpBack: make(this.textures.white, this.overlayLayer),
      hpFill: make(this.textures.white, this.overlayLayer),
      aura: make(this.textures.disc, this.overlayLayer),
      crust: make(this.textures.ring, this.overlayLayer),
      halo: make(this.textures.ring, this.overlayLayer),
      tether: make(this.textures.white, this.groundLayer),
      revive: make(this.textures.ring, this.overlayLayer),
      eliteRing: make(this.textures.ring, this.groundLayer),
      shield: make(this.textures.shieldArc, this.overlayLayer),
      generation: -1,
    };
    slot.hpBack.tint = PALETTE.hpBack;
    slot.hpFill.tint = PALETTE.hpFill;
    slot.hpFill.anchor.set(0, 0.5);
    this.slots[eid] = slot;
    return slot;
  }

  private hideSlot(slot: Slot): void {
    slot.body.visible = false;
    slot.teleBack.visible = false;
    slot.teleFill.visible = false;
    slot.hpBack.visible = false;
    slot.hpFill.visible = false;
    slot.aura.visible = false;
    slot.crust.visible = false;
    slot.halo.visible = false;
    slot.tether.visible = false;
    slot.revive.visible = false;
    slot.eliteRing.visible = false;
    slot.shield.visible = false;
  }

  /** `alpha` interpolates between the previous and the current tick (0..1). */
  sync(sim: SimState, alpha: number, dtSec: number): void {
    this.time += dtSec;
    const { world, c } = sim;
    const masks = world.masks;
    const renderMask = C.Transform | C.Renderable;
    for (let eid = 0; eid < world.highWater; eid++) {
      const slot = this.slots[eid];
      const mask = masks[eid] as number;
      const tex = this.bodyTextures(sim, eid);
      if ((mask & renderMask) === renderMask && c.renderKind[eid] === RenderKind.Hazard) {
        this.syncHazard(sim, eid, this.slotFor(eid, this.textures.disc));
        this.statusIcons.hide(eid);
        continue;
      }
      if ((mask & renderMask) === renderMask && c.renderKind[eid] === RenderKind.Zone) {
        this.syncZone(sim, eid, this.slotFor(eid, this.textures.disc));
        this.statusIcons.hide(eid);
        continue;
      }
      if (
        (mask & renderMask) !== renderMask ||
        (!tex && c.renderKind[eid] !== RenderKind.EnemyProjectile)
      ) {
        if (slot) this.hideSlot(slot);
        this.statusIcons.hide(eid);
        continue;
      }
      const s = this.slotFor(eid, tex?.normal ?? this.textures.enemyShot);
      // A new occupant of this id: reset per-entity effects.
      if (s.generation !== world.generations[eid]) {
        s.generation = world.generations[eid] as number;
        this.ageSec[eid] = 0;
        this.flashSec[eid] = 0;
        this.squashSec[eid] = 0;
      }
      this.ageSec[eid] = (this.ageSec[eid] as number) + dtSec;
      const px = c.prevX[eid] as number;
      const py = c.prevY[eid] as number;
      const x = px + ((c.posX[eid] as number) - px) * alpha;
      const y = py + ((c.posY[eid] as number) - py) * alpha;
      const body = s.body;
      body.visible = true;
      body.position.set(x, y);
      body.rotation = Math.atan2(c.facingY[eid] as number, c.facingX[eid] as number);

      const flashing = (this.flashSec[eid] as number) > 0;
      if (flashing) this.flashSec[eid] = (this.flashSec[eid] as number) - dtSec;
      body.texture = tex ? (flashing ? tex.flash : tex.normal) : this.textures.enemyShot;

      let scale = (c.radius[eid] as number) / BAKE_RADIUS_PX;
      const age = this.ageSec[eid] as number;
      if (age < SPAWN_POP_SEC) {
        const t = age / SPAWN_POP_SEC;
        scale *= 0.4 + 0.6 * (1 + 1.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2);
      }
      let sx = 1;
      let sy = 1;
      const squash = this.squashSec[eid] as number;
      if (squash > 0) {
        this.squashSec[eid] = squash - dtSec;
        const k = TUNING.squashAmount * (squash / TUNING.squashSec);
        // Squash along the body's local x; good enough for round, rotating bodies.
        sx = 1 - k;
        sy = 1 + k;
      }
      body.alpha = 1;

      if (eid === sim.playerEid) {
        const p = sim.player;
        if (p.action === PlayerAction.Dash) {
          sx *= 1 + TUNING.squashAmount;
          sy *= 1 - TUNING.squashAmount * 0.6;
        }
        if (p.invulnTicks > 0)
          body.alpha = Math.sin(this.time * INVULN_BLINK_HZ * Math.PI * 2) > 0 ? 1 : 0.35;
        if (p.action === PlayerAction.Dead) body.alpha = 0;
      }
      body.scale.set(scale * sx, scale * sy);

      if ((mask & C.Enemy) !== 0) this.syncEnemyExtras(sim, eid, s, x, y);
      else {
        s.body.tint = 0xffffff;
        s.aura.visible = false;
        s.crust.visible = false;
        s.halo.visible = false;
        s.tether.visible = false;
        s.revive.visible = false;
        this.statusIcons.hide(eid);
        s.eliteRing.visible = false;
        s.shield.visible = false;
        s.teleBack.visible = false;
        s.teleFill.visible = false;
        s.hpBack.visible = false;
        s.hpFill.visible = false;
      }
    }
    for (let i = world.highWater; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (slot) this.hideSlot(slot);
      this.statusIcons.hide(i);
    }
  }

  /** Mines and death blasts: a ring at the blast radius with a disc filling up to detonation. */
  private syncHazard(sim: SimState, eid: number, s: Slot): void {
    const c = sim.c;
    this.hideSlot(s);
    const x = c.posX[eid] as number;
    const y = c.posY[eid] as number;
    const scale = (c.radius[eid] as number) / BAKE_RADIUS_PX;
    const total = Math.max(1, c.hazFuseTotal[eid] as number);
    const progress = 1 - (c.projLifeTicks[eid] as number) / total;
    s.teleBack.visible = true;
    s.teleBack.texture = this.textures.ring;
    s.teleBack.anchor.set(0.5);
    s.teleBack.position.set(x, y);
    s.teleBack.rotation = 0;
    s.teleBack.scale.set(scale);
    s.teleBack.tint = PALETTE.telegraph;
    // Blinks faster as the fuse runs out, so the last moment is unmistakable.
    s.teleBack.alpha = 0.6 + 0.4 * Math.sin(this.time * (10 + progress * 30));
    s.teleFill.visible = true;
    s.teleFill.texture = this.textures.disc;
    s.teleFill.anchor.set(0.5);
    s.teleFill.position.set(x, y);
    s.teleFill.rotation = 0;
    s.teleFill.scale.set(scale * progress);
    s.teleFill.tint = PALETTE.telegraphFill;
    s.teleFill.alpha = 0.15 + 0.3 * progress;
    s.body.visible = true;
    s.body.texture = this.textures.dot;
    s.body.position.set(x, y);
    s.body.rotation = 0;
    s.body.alpha = 1;
    s.body.tint = PALETTE.telegraph;
    s.body.scale.set(0.5);
  }

  /**
   * Player spell zones in the spell's colour: a delayed blast (meteor) shows a ring with a disc
   * filling up to the impact; a lingering cloud shows a slowly breathing disc.
   */
  private syncZone(sim: SimState, eid: number, s: Slot): void {
    const c = sim.c;
    this.hideSlot(s);
    const x = c.posX[eid] as number;
    const y = c.posY[eid] as number;
    const scale = (c.radius[eid] as number) / BAKE_RADIUS_PX;
    const color = SPELLS[c.zoneSpell[eid] as number]?.visual.color ?? PALETTE.playerSlash;
    const total = Math.max(1, c.hazFuseTotal[eid] as number);
    const left = c.projLifeTicks[eid] as number;
    const delayed = (c.zonePulseTicks[eid] as number) >= total;
    s.teleBack.visible = true;
    s.teleBack.texture = this.textures.ring;
    s.teleBack.anchor.set(0.5);
    s.teleBack.position.set(x, y);
    s.teleBack.rotation = 0;
    s.teleBack.scale.set(scale);
    s.teleBack.tint = color;
    s.teleFill.visible = true;
    s.teleFill.texture = this.textures.disc;
    s.teleFill.anchor.set(0.5);
    s.teleFill.position.set(x, y);
    s.teleFill.rotation = 0;
    s.teleFill.tint = color;
    if (delayed) {
      const progress = 1 - left / total;
      s.teleBack.alpha = 0.9;
      s.teleFill.scale.set(scale * progress);
      s.teleFill.alpha = 0.2 + 0.35 * progress;
    } else {
      // Fades out over its last half second.
      const fade = Math.min(1, left / 30);
      s.teleBack.alpha = 0.5 * fade;
      s.teleFill.scale.set(scale * (0.95 + 0.05 * Math.sin(this.time * 3 + eid)));
      s.teleFill.alpha = (0.16 + 0.06 * Math.sin(this.time * 2 + eid)) * fade;
    }
  }

  /** Elites: a coloured halo; shielded ones carry a bright arc on their facing side. */
  private syncElite(sim: SimState, eid: number, s: Slot, x: number, y: number, r: number): void {
    const elite = eliteOf(sim.c.eliteMod[eid] as number);
    s.eliteRing.visible = elite !== undefined;
    s.shield.visible = elite !== undefined && elite.shieldArcDeg > 0;
    if (!elite) return;
    s.eliteRing.tint = elite.color;
    s.eliteRing.position.set(x, y);
    s.eliteRing.rotation = 0;
    s.eliteRing.scale.set(((r * 1.45) / BAKE_RADIUS_PX) * (1 + 0.05 * Math.sin(this.time * 6)));
    s.eliteRing.alpha = 0.85;
    if (!s.shield.visible) return;
    const angle = Math.atan2(sim.c.facingY[eid] as number, sim.c.facingX[eid] as number);
    s.shield.tint = elite.color;
    s.shield.position.set(x, y);
    s.shield.rotation = angle;
    s.shield.scale.set((r * 1.35) / BAKE_RADIUS_PX);
    s.shield.alpha = (sim.c.frozenTicks[eid] as number) > 0 ? 0.25 : 0.95;
  }

  /**
   * Status looks (ROADMAP M3.1): frozen = icy tint and shell; chill = cooler tint and an ice
   * crust that thickens per stack; burn = flickering ember glow; poison = green tint and haze;
   * blind = light halo over the head. Icons with stack counts are drawn by StatusIcons.
   */
  private syncStatus(sim: SimState, eid: number, s: Slot, x: number, y: number, r: number): void {
    const c = sim.c;
    const frozen = (c.frozenTicks[eid] as number) > 0;
    const chill = stacksOf(c, eid, Status.Chill);
    const burn = stacksOf(c, eid, Status.Burn);
    const poison = stacksOf(c, eid, Status.Poison);
    const blind = stacksOf(c, eid, Status.Blind);
    s.body.tint = frozen
      ? PALETTE.frozen
      : chill > 0
        ? chill >= 3
          ? PALETTE.chillHeavy
          : PALETTE.chillLight
        : poison > 0
          ? PALETTE.poisonTint
          : 0xffffff;
    const aura = s.aura;
    if (frozen) {
      aura.visible = true;
      aura.texture = this.textures.disc;
      aura.tint = PALETTE.frozen;
      aura.alpha = 0.35;
      aura.position.set(x, y);
      aura.scale.set((r * 1.35) / BAKE_RADIUS_PX);
    } else if (burn > 0) {
      aura.visible = true;
      aura.texture = this.textures.dot;
      aura.tint = PALETTE.ember;
      aura.alpha = 0.25 + 0.15 * Math.sin(this.time * 18 + eid) + Math.min(0.3, burn * 0.03);
      aura.position.set(x, y);
      aura.scale.set((r * 2.2) / BAKE_RADIUS_PX);
    } else if (poison > 0) {
      // Slow, sickly breathing instead of burn's fast flicker.
      aura.visible = true;
      aura.texture = this.textures.dot;
      aura.tint = statusDef(Status.Poison).visual.color;
      aura.alpha = 0.18 + 0.08 * Math.sin(this.time * 4 + eid) + Math.min(0.25, poison * 0.025);
      aura.position.set(x, y);
      aura.scale.set((r * 2) / BAKE_RADIUS_PX);
    } else {
      aura.visible = false;
    }

    const crust = s.crust;
    crust.visible = chill > 0 && !frozen;
    if (crust.visible) {
      crust.tint = PALETTE.frost;
      crust.position.set(x, y);
      crust.rotation = 0;
      crust.scale.set((r * (1.1 + 0.06 * chill)) / BAKE_RADIUS_PX);
      crust.alpha = 0.3 + 0.12 * chill;
    }

    const halo = s.halo;
    halo.visible = blind > 0;
    if (halo.visible) {
      halo.tint = statusDef(Status.Blind).visual.color;
      halo.position.set(x, y - r * 1.05);
      halo.rotation = 0;
      // A flat ellipse reads as a halo above the body.
      halo.scale.set((r * 0.8) / BAKE_RADIUS_PX, (r * 0.3) / BAKE_RADIUS_PX);
      halo.alpha = 0.65 + 0.3 * Math.sin(this.time * 9 + eid);
    }
  }

  /** Twin bond line and revive countdown ring (ROADMAP M3.5). */
  private syncChampion(sim: SimState, eid: number, s: Slot, x: number, y: number, r: number): void {
    const c = sim.c;
    const partner = partnerOf(sim, eid);
    const factor = linkedDamageFactor(sim, eid);
    // Draw the bond once per pair (from the lower id).
    s.tether.visible = partner > eid && factor < 1;
    if (s.tether.visible) {
      const ox = c.posX[partner] as number;
      const oy = c.posY[partner] as number;
      const dx = ox - x;
      const dy = oy - y;
      s.tether.anchor.set(0, 0.5);
      s.tether.position.set(x, y);
      s.tether.rotation = Math.atan2(dy, dx);
      s.tether.scale.set(Math.sqrt(dx * dx + dy * dy), 3 + Math.sin(this.time * 10));
      s.tether.tint = PALETTE.ember;
      s.tether.alpha = 0.55;
    }
    const left = c.reviveTicks[eid] as number;
    s.revive.visible = left > 0;
    if (s.revive.visible) {
      const def = ENEMIES[(c.reviveType[eid] as number) - 1];
      const total = Math.max(1, secondsToTicks(def?.link?.reviveSec ?? 1));
      const t = left / total;
      s.revive.position.set(x, y);
      s.revive.rotation = 0;
      s.revive.scale.set((r * (1.4 + 2.2 * t)) / BAKE_RADIUS_PX);
      s.revive.tint = PALETTE.hpFill;
      s.revive.alpha = 0.5 + 0.4 * Math.sin(this.time * (8 + (1 - t) * 20));
    }
  }

  private syncEnemyExtras(sim: SimState, eid: number, s: Slot, x: number, y: number): void {
    const c = sim.c;
    const def = ENEMIES[c.enemyType[eid] as number];
    if (!def) return;
    const r = c.radius[eid] as number;
    this.syncStatus(sim, eid, s, x, y, r);
    this.syncElite(sim, eid, s, x, y, r);

    const hp = c.hp[eid] as number;
    const maxHp = c.maxHp[eid] as number;
    const showHp = hp < maxHp;
    s.hpBack.visible = showHp;
    s.hpFill.visible = showHp;
    if (showHp) {
      const top = y - r - 10;
      s.hpBack.position.set(x, top);
      s.hpBack.scale.set(HP_BAR_WIDTH_PX + 2, HP_BAR_HEIGHT_PX + 2);
      s.hpFill.position.set(x - HP_BAR_WIDTH_PX / 2, top);
      s.hpFill.scale.set(HP_BAR_WIDTH_PX * Math.max(0, hp / maxHp), HP_BAR_HEIGHT_PX);
    }
    this.statusIcons.sync(sim, eid, x, y - r - 10, this.time);

    this.syncChampion(sim, eid, s, x, y, r);
    const state = c.aiState[eid];
    const atk = attackOf(def, c.aiPhase[eid] as number, c.aiPattern[eid] as number);
    const windupTicks = Math.max(1, secondsToTicks(atk.windupSec));
    const telegraphing = state === AiState.Windup;
    const slamActive = state === AiState.Active && atk.kind === 'slam';
    if (!telegraphing && !slamActive) {
      s.teleBack.visible = false;
      s.teleFill.visible = false;
      if (state === AiState.Stagger) s.body.alpha = 0.6 + 0.4 * Math.sin(this.time * 40);
      return;
    }
    const progress = slamActive ? 1 : Math.min(1, (c.aiTicks[eid] as number) / windupTicks);
    if (atk.kind === 'guard') {
      // Parry stance: cool blue, never the warm attack colours (GDD §12.1 rule 2 reversed:
      // this is a defence, attacking into the front is the mistake).
      s.teleFill.visible = false;
      s.teleBack.visible = true;
      s.teleBack.texture = this.textures.ring;
      s.teleBack.anchor.set(0.5);
      s.teleBack.position.set(x, y);
      s.teleBack.rotation = 0;
      s.teleBack.scale.set(((r * 1.7) / BAKE_RADIUS_PX) * (1 + 0.06 * Math.sin(this.time * 14)));
      s.teleBack.tint = PALETTE.guard;
      s.teleBack.alpha = 0.9;
      s.shield.visible = true;
      s.shield.tint = PALETTE.guard;
      s.shield.position.set(x, y);
      s.shield.rotation = Math.atan2(c.facingY[eid] as number, c.facingX[eid] as number);
      s.shield.scale.set((r * 1.5) / BAKE_RADIUS_PX);
      s.shield.alpha = 1;
      s.body.tint = PALETTE.guard;
      return;
    }
    s.teleBack.visible = true;
    s.teleFill.visible = true;
    s.teleBack.tint = PALETTE.telegraph;
    s.teleFill.tint = PALETTE.telegraphFill;
    const dirX = c.aiDirX[eid] as number;
    const dirY = c.aiDirY[eid] as number;
    const angle = Math.atan2(dirY, dirX);

    if (atk.kind === 'slam') {
      // Ground circle that fills up (GDD §5.2); full = impact.
      const scale = atk.slamRadiusPx / BAKE_RADIUS_PX;
      s.teleBack.texture = this.textures.ring;
      s.teleBack.position.set(x, y);
      s.teleBack.rotation = 0;
      s.teleBack.scale.set(scale);
      s.teleBack.alpha = 0.9;
      s.teleFill.texture = this.textures.disc;
      s.teleFill.position.set(x, y);
      s.teleFill.rotation = 0;
      s.teleFill.scale.set(scale * progress);
      s.teleFill.alpha = slamActive ? 0.6 : 0.18 + 0.2 * progress;
    } else if (atk.kind === 'lunge') {
      // Lane on the ground showing exactly where the lunge will go.
      const length = atk.lungePx + r;
      const width = r * 1.6;
      s.teleBack.texture = this.textures.white;
      s.teleBack.anchor.set(0, 0.5);
      s.teleBack.position.set(x, y);
      s.teleBack.rotation = angle;
      s.teleBack.scale.set(length, width);
      s.teleBack.alpha = 0.12;
      s.teleFill.texture = this.textures.white;
      s.teleFill.anchor.set(0, 0.5);
      s.teleFill.position.set(x, y);
      s.teleFill.rotation = angle;
      s.teleFill.scale.set(length * progress, width * 0.35);
      s.teleFill.alpha = 0.55;
      // Coil up before springing.
      s.body.scale.set(
        s.body.scale.x * (1 - 0.18 * progress),
        s.body.scale.y * (1 + 0.1 * progress),
      );
    } else if (
      atk.kind === 'mend' ||
      atk.kind === 'summon' ||
      (atk.kind === 'volley' && atk.spreadDeg >= 180)
    ) {
      // Area casts: a ring around the caster that closes in as the windup completes.
      const radius = atk.kind === 'mend' ? atk.radiusPx : atk.kind === 'summon' ? r + 70 : r * 2.6;
      const tint =
        atk.kind === 'mend'
          ? PALETTE.heal
          : atk.kind === 'summon'
            ? PALETTE.portal
            : PALETTE.telegraph;
      s.teleBack.texture = this.textures.ring;
      s.teleBack.anchor.set(0.5);
      s.teleBack.position.set(x, y);
      s.teleBack.rotation = 0;
      s.teleBack.scale.set((radius / BAKE_RADIUS_PX) * (1.4 - 0.4 * progress));
      s.teleBack.tint = tint;
      s.teleBack.alpha = 0.5 + 0.4 * progress;
      s.teleFill.texture = this.textures.dot;
      s.teleFill.anchor.set(0.5);
      s.teleFill.position.set(x, y);
      s.teleFill.rotation = 0;
      s.teleFill.scale.set((r / BAKE_RADIUS_PX) * (1.5 + progress));
      s.teleFill.tint = tint;
      s.teleFill.alpha = 0.3 + 0.4 * Math.sin(this.time * 20) * progress;
    } else {
      // Ranged (aimed volley, mine lob): a pulsing muzzle glow in the aim direction plus
      // swelling body.
      s.teleBack.texture = this.textures.dot;
      s.teleBack.anchor.set(0.5);
      s.teleBack.position.set(x + dirX * r * 1.4, y + dirY * r * 1.4);
      s.teleBack.rotation = 0;
      s.teleBack.scale.set(0.4 + 0.8 * progress);
      s.teleBack.alpha = 0.5 + 0.5 * Math.sin(this.time * 30) * progress;
      s.teleFill.texture = this.textures.white;
      s.teleFill.anchor.set(0, 0.5);
      s.teleFill.position.set(x, y);
      s.teleFill.rotation = angle;
      s.teleFill.scale.set(90 * progress, 1.5);
      s.teleFill.alpha = 0.35;
      s.body.scale.set(
        s.body.scale.x * (1 + 0.25 * progress),
        s.body.scale.y * (1 + 0.25 * progress),
      );
    }
    if (atk.kind === 'slam') {
      s.teleBack.anchor.set(0.5);
      s.teleFill.anchor.set(0.5);
    }
  }
}
