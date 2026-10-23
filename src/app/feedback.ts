import { eliteOf } from '../content/elites';
import { attackOf, ENEMIES, ENEMY_TYPE } from '../content/enemies';
import { SPELLS } from '../content/spells';
import { Status, statusDef } from '../content/statuses';
import { TUNING } from '../content/tuning';
import { BRAND_BLADE } from '../content/weapons/brand-blade';
import type { AudioEngine } from '../platform/audio/audio-engine';
import type { Haptics } from '../platform/haptics';
import { type TranslationKey, t } from '../shared/i18n';
import { C, RenderKind, stacksOf } from '../sim/ecs/components';
import {
  BurstCode,
  Ev,
  type EventBuffer,
  EvFlag,
  ProjectileCode,
  type SimEvent,
  STATUS_CODES,
  StatusCode,
  StatusFlag,
} from '../sim/events';
import { PlayerAction } from '../sim/player-state';
import type { SimState } from '../sim/sim';
import type { GameView } from '../view/game-view';
import { PALETTE } from '../view/render/palette';
import { BAKE_RADIUS_PX } from '../view/render/textures';

/** Combo hits climb in pitch so a full combo "sings" (GDD §4.7). */
const COMBO_PITCH_STEP = 1.06;
const AFTERIMAGE_INTERVAL_SEC = 1 / 45;
/** Ember emission rate per burn stack (per second), capped per enemy. */
const EMBERS_PER_STACK_PER_SEC = 3;
const MAX_EMBERS_PER_SEC = 18;
/** Poison bubbles per stack (per second), capped per enemy. */
const BUBBLES_PER_STACK_PER_SEC = 2;
const MAX_BUBBLES_PER_SEC = 14;
/** Trail particles per second behind player projectiles. */
const RIFT_TRAIL_PER_SEC = 40;
const FIREBIRD_TRAIL_PER_SEC = 70;

/** Colour of a status from its event code (content/statuses visual colour). */
function statusColor(code: number): number {
  const index = STATUS_CODES.indexOf(code);
  return index < 0 ? PALETTE.playerSlash : statusDef(index).visual.color;
}

function burstColor(code: number): number {
  if (code === BurstCode.Ignara) return PALETTE.ultimate;
  if (code === BurstCode.Vaelis) return PALETTE.frost;
  return PALETTE.playerSlash;
}

/** Requests from feedback to the game loop. */
export interface SlowMoRequest {
  scale: number;
  durationSec: number;
}

/**
 * The single place that turns sim events into game feel: particles, shake, flashes, sound,
 * vibration and slow motion. Tuning lives in TUNING and the effect recipes.
 */
export class FeedbackDirector {
  private afterimageTimer = 0;
  private panWidth = 960;

  constructor(
    private readonly view: GameView,
    private readonly audio: AudioEngine,
    private readonly haptics: Haptics,
    private readonly requestSlowMo: (req: SlowMoRequest) => void,
  ) {}

  /** Stereo position from world x relative to the camera, so off-screen threats are audible. */
  private pan(x: number): number {
    const cam = this.view.camera;
    this.panWidth = cam.viewWidth / cam.zoom;
    return Math.max(-0.8, Math.min(0.8, (x - cam.x) / (this.panWidth / 2)));
  }

  consume(events: EventBuffer): void {
    for (let i = 0; i < events.count; i++) this.handle(events.items[i] as SimEvent);
  }

  /** Continuous, per-frame feedback (dash afterimages, embers and poison bubbles on enemies). */
  update(sim: SimState, dtSec: number): void {
    this.emitStatusParticles(sim, dtSec);
    this.emitTrails(sim, dtSec);
    const p = sim.player;
    if (p.action !== PlayerAction.Dash) {
      this.afterimageTimer = 0;
      return;
    }
    this.afterimageTimer -= dtSec;
    if (this.afterimageTimer > 0) return;
    this.afterimageTimer = AFTERIMAGE_INTERVAL_SEC;
    const eid = sim.playerEid;
    this.view.effects.afterimage(
      sim.c.posX[eid] ?? 0,
      sim.c.posY[eid] ?? 0,
      Math.atan2(p.dirY, p.dirX),
      TUNING.playerRadiusPx / BAKE_RADIUS_PX,
    );
  }

  private emitStatusParticles(sim: SimState, dtSec: number): void {
    if (dtSec <= 0) return;
    const { world, c } = sim;
    for (let eid = 0; eid < world.highWater; eid++) {
      if (((world.masks[eid] as number) & C.Enemy) === 0) continue;
      const x = c.posX[eid] as number;
      const y = c.posY[eid] as number;
      const r = c.radius[eid] as number;
      // Poisson-ish: expected particles this frame, resolved with a random draw (cosmetic only).
      const burn = stacksOf(c, eid, Status.Burn);
      if (burn > 0) {
        const expected = Math.min(MAX_EMBERS_PER_SEC, burn * EMBERS_PER_STACK_PER_SEC) * dtSec;
        if (Math.random() < expected) this.view.effects.ember(x, y, r);
      }
      const poison = stacksOf(c, eid, Status.Poison);
      if (poison > 0) {
        const expected = Math.min(MAX_BUBBLES_PER_SEC, poison * BUBBLES_PER_STACK_PER_SEC) * dtSec;
        if (Math.random() < expected) {
          this.view.effects.poisonBubble(x, y, r, statusDef(Status.Poison).visual.color);
        }
      }
    }
  }

  private emitTrails(sim: SimState, dtSec: number): void {
    if (dtSec <= 0) return;
    const { world, c } = sim;
    for (let eid = 0; eid < world.highWater; eid++) {
      if (((world.masks[eid] as number) & C.Projectile) === 0) continue;
      const kind = c.renderKind[eid];
      if (kind !== RenderKind.RiftShot && kind !== RenderKind.Firebird) continue;
      const big = kind === RenderKind.Firebird;
      let expected = (big ? FIREBIRD_TRAIL_PER_SEC : RIFT_TRAIL_PER_SEC) * dtSec;
      // Several per frame at low frame rates; the fraction is resolved randomly (cosmetic only).
      while (expected > 0) {
        if (expected >= 1 || Math.random() < expected) {
          this.view.effects.projectileTrail(
            c.posX[eid] as number,
            c.posY[eid] as number,
            c.facingX[eid] as number,
            c.facingY[eid] as number,
            big ? PALETTE.firebird : PALETTE.riftShot,
            big,
          );
        }
        expected -= 1;
      }
    }
  }

  private handle(e: SimEvent): void {
    const fx = this.view.effects;
    const shake = this.view.shake;
    switch (e.type) {
      case Ev.Swing: {
        const hit = BRAND_BLADE.combo[e.value];
        const heavy = hit?.hitstop === 'heavy';
        fx.slash(e.x, e.y, e.dirX, e.dirY, hit?.reachPx ?? 70, hit?.arcDeg ?? 90, heavy);
        this.audio.play('swing', { pitch: COMBO_PITCH_STEP ** e.value, volume: heavy ? 1 : 0.8 });
        break;
      }
      case Ev.Special:
        fx.whirl(e.x, e.y, BRAND_BLADE.special.radiusPx);
        this.audio.play('special');
        shake.add(TUNING.shakeLightTrauma);
        break;
      case Ev.Hit: {
        if ((e.flags & EvFlag.Dot) !== 0) {
          // Burn ticks: quiet, small orange numbers only.
          this.view.entities.hit(e.eid, 0, 0);
          this.view.damageNumbers.spawnText(
            e.x,
            e.y,
            String(Math.round(e.amount)),
            PALETTE.burnText,
            0.38,
          );
          break;
        }
        const crit = (e.flags & EvFlag.Crit) !== 0;
        const heavy = (e.flags & EvFlag.Heavy) !== 0;
        const color = ENEMIES[e.value]?.visual.color ?? PALETTE.ember;
        this.view.entities.hit(e.eid, e.dirX, e.dirY);
        fx.hitSparks(e.x, e.y, e.dirX, e.dirY, crit ? PALETTE.crit : color, heavy || crit ? 14 : 9);
        this.view.damageNumbers.spawn(e.x, e.y, e.amount, crit);
        shake.add(heavy || crit ? TUNING.shakeHeavyTrauma : TUNING.shakeLightTrauma);
        this.audio.play(crit ? 'crit' : heavy ? 'hitHeavy' : 'hit', { pan: this.pan(e.x) });
        this.haptics.pulse(heavy || crit ? 25 : 10, heavy ? 0.6 : 0.3);
        break;
      }
      case Ev.Kill: {
        const def = ENEMIES[e.value];
        const elite = eliteOf(e.flags);
        fx.killBurst(
          e.x,
          e.y,
          e.dirX,
          e.dirY,
          def?.visual.color ?? PALETTE.ember,
          (def?.radiusPx ?? 14) * (elite ? 1.5 : 1),
        );
        if (elite) fx.killBurst(e.x, e.y, -e.dirX, -e.dirY, elite.color, 16);
        shake.add(e.value === ENEMY_TYPE.brute ? TUNING.shakeHeavyTrauma : TUNING.shakeLightTrauma);
        this.audio.play('kill', {
          pan: this.pan(e.x),
          pitch: e.value === ENEMY_TYPE.brute ? 0.7 : 1,
        });
        break;
      }
      case Ev.Dash:
        fx.dashPuff(e.x, e.y, e.dirX, e.dirY);
        this.audio.play('dash');
        break;
      case Ev.PerfectDash:
        fx.perfectDash(e.x, e.y);
        this.audio.play('perfectDash', { pitchVariation: 0 });
        this.haptics.pulse(30, 0.5);
        this.requestSlowMo({
          scale: TUNING.perfectDashTimeScale,
          durationSec: TUNING.perfectDashSlowMoSec,
        });
        break;
      case Ev.Telegraph: {
        const def = ENEMIES[e.value];
        const heavy =
          def?.role === 'boss' || (def ? attackOf(def, e.flags, e.amount).kind === 'slam' : false);
        this.audio.play(heavy ? 'telegraphHeavy' : 'telegraph', {
          pan: this.pan(e.x),
          volume: 0.8,
        });
        break;
      }
      case Ev.EnemyAttack: {
        const def = ENEMIES[e.value];
        const atk = def ? attackOf(def, e.flags, e.amount) : undefined;
        if (atk?.kind === 'slam') {
          fx.slamShockwave(e.x, e.y, atk.slamRadiusPx);
          shake.add(def?.role === 'boss' ? 0.6 : TUNING.shakeHeavyTrauma);
          this.audio.play('slam', { pan: this.pan(e.x), pitch: def?.role === 'boss' ? 0.75 : 1 });
          this.haptics.pulse(20, 0.4);
        } else if (atk?.kind === 'volley' || atk?.kind === 'mine') {
          fx.muzzle(e.x + e.dirX * 14, e.y + e.dirY * 14, PALETTE.enemyShot);
          this.audio.play('enemyShoot', {
            pan: this.pan(e.x),
            pitch: atk.kind === 'mine' ? 0.7 : 1,
          });
        } else if (atk?.kind === 'summon') {
          fx.portal(e.x, e.y, 0.5, PALETTE.portal);
          this.audio.play('spawn', { pan: this.pan(e.x), pitch: 0.8 });
        }
        break;
      }
      case Ev.HazardPlaced:
        fx.statusPuff(e.x, e.y, PALETTE.telegraph);
        this.audio.play('mineLand', { pan: this.pan(e.x) });
        break;
      case Ev.HazardBlast:
        fx.slamShockwave(e.x, e.y, e.amount);
        fx.killBurst(e.x, e.y, 0, -1, PALETTE.enemyShot, e.amount * 0.3);
        shake.add(TUNING.shakeLightTrauma * 1.5);
        this.audio.play('slam', { pan: this.pan(e.x), pitch: 1.3, volume: 0.8 });
        this.haptics.pulse(15, 0.3);
        break;
      case Ev.ShieldBlock:
        fx.hitSparks(e.x - e.dirX * 20, e.y - e.dirY * 20, -e.dirX, -e.dirY, 0xffffff, 10);
        this.audio.play('block', { pan: this.pan(e.x) });
        break;
      case Ev.EnemyMend:
        fx.nova(e.x, e.y, e.amount, PALETTE.heal);
        this.audio.play('heal', { pan: this.pan(e.x), pitch: 0.7 });
        break;
      case Ev.BossPhase: {
        const last = e.value >= 2;
        fx.waveCleared(e.x, e.y);
        fx.ultimateCharge(e.x, e.y, last ? PALETTE.hpFill : PALETTE.ultimate);
        shake.add(0.8);
        this.view.addZoomPunch(TUNING.lastEnemyZoomPunch);
        this.view.hud.onBossPhase(last);
        this.audio.play('roar', { pitchVariation: 0, pitch: last ? 1.15 : 1 });
        this.audio.duckMusic(0.7, 0.6);
        this.haptics.pulse(80, 0.8);
        this.requestSlowMo({
          scale: TUNING.lastEnemyTimeScale,
          durationSec: TUNING.lastEnemySlowMoSec,
        });
        break;
      }
      case Ev.LastSpark:
        // The tree caught you: unmistakable, a little holy, then back to the fight.
        fx.ultimate(e.x, e.y, 160, PALETTE.ember);
        fx.heal(e.x, e.y);
        this.view.hud.onBanner(t('hud.last_spark'));
        shake.add(0.6);
        this.audio.play('ultimateReady', { pitch: 0.8, pitchVariation: 0 });
        this.audio.play('heal', { pitchVariation: 0 });
        this.haptics.pulse(60, 0.8);
        this.requestSlowMo({ scale: 0.25, durationSec: 0.7 });
        break;
      case Ev.BossDefeated: {
        const def = ENEMIES[e.value];
        fx.killBurst(e.x, e.y, 0, -1, def?.visual.color ?? PALETTE.ember, 60);
        fx.killBurst(e.x, e.y, 0, 1, PALETTE.ultimate, 50);
        fx.ultimate(e.x, e.y, 360, PALETTE.ultimate);
        shake.add(1);
        this.view.addZoomPunch(TUNING.lastEnemyZoomPunch * 2);
        this.audio.play('ultimate', { pitchVariation: 0, pitch: 0.7 });
        this.haptics.pulse(150, 1);
        this.requestSlowMo({ scale: 0.25, durationSec: 1.2 });
        break;
      }
      case Ev.PlayerHit:
        fx.playerHit(e.x, e.y, e.dirX, e.dirY);
        this.view.entities.hit(e.eid, e.dirX, e.dirY);
        this.view.hud.onPlayerHit();
        shake.add(TUNING.shakePlayerHitTrauma);
        this.audio.play('playerHit', { pitchVariation: 0.04 });
        this.audio.duckMusic(0.5, 0.2);
        this.haptics.pulse(40, 1);
        break;
      case Ev.StaminaEmpty:
        this.view.hud.onStaminaEmpty();
        this.audio.play('staminaEmpty', { pitchVariation: 0 });
        break;
      case Ev.SpawnWarn:
        fx.portal(e.x, e.y, e.amount, PALETTE.portal);
        this.audio.play('spawn', { pan: this.pan(e.x), volume: 0.6 });
        break;
      case Ev.Spawn: {
        const def = ENEMIES[e.value];
        fx.spawnFlash(e.x, e.y, eliteOf(e.flags)?.color ?? def?.visual.color ?? PALETTE.portal);
        if (def?.role === 'boss') {
          this.view.hud.onBoss(t(`boss.${def.id}.name` as TranslationKey));
          fx.slamShockwave(e.x, e.y, 200);
          shake.add(0.7);
          this.audio.play('roar', { pitchVariation: 0 });
          this.haptics.pulse(60, 0.7);
        }
        break;
      }
      case Ev.ProjectileExpired:
        fx.shotPop(
          e.x,
          e.y,
          e.value === ProjectileCode.RiftShot
            ? PALETTE.riftShot
            : e.value === ProjectileCode.Firebird
              ? PALETTE.firebird
              : PALETTE.enemyShot,
        );
        break;
      case Ev.Shot:
        if (e.value === ProjectileCode.Firebird) {
          fx.hitSparks(e.x, e.y, e.dirX, e.dirY, PALETTE.firebird, 16);
          fx.muzzle(e.x, e.y, PALETTE.firebird);
          shake.add(TUNING.shakeLightTrauma);
          this.audio.play('firebird', { pan: this.pan(e.x) });
          this.haptics.pulse(20, 0.4);
        } else {
          fx.muzzle(e.x, e.y, PALETTE.riftShot);
          this.audio.play('cast', { pan: this.pan(e.x) });
          this.haptics.pulse(8, 0.2);
        }
        break;
      case Ev.UltimateStart:
        fx.ultimateCharge(e.x, e.y, burstColor(e.value));
        this.view.addZoomPunch(TUNING.lastEnemyZoomPunch * 0.5);
        this.audio.play('ultimateCharge', { pitchVariation: 0 });
        this.haptics.pulse(30, 0.3);
        break;
      case Ev.Ultimate:
        // The biggest moment in a fight: everything at once, then a short breath of slow-mo.
        fx.ultimate(e.x, e.y, e.amount, burstColor(e.value));
        shake.add(1);
        this.view.addZoomPunch(TUNING.lastEnemyZoomPunch * 1.5);
        this.audio.play('ultimate', { pitchVariation: 0 });
        this.audio.duckMusic(0.7, 0.4);
        this.haptics.pulse(90, 1);
        this.requestSlowMo({
          scale: TUNING.ultimateTimeScale,
          durationSec: TUNING.ultimateSlowMoSec,
        });
        break;
      case Ev.UltimateReady:
        this.view.hud.onUltimateReady();
        this.audio.play('ultimateReady', { pitchVariation: 0 });
        this.haptics.pulse(15, 0.3);
        break;
      case Ev.Denied:
        if (e.value === 3) this.view.hud.onSpellDenied();
        else this.view.hud.onDenied(e.value === 2);
        this.audio.play('staminaEmpty', { pitchVariation: 0, pitch: 1.2 });
        break;
      case Ev.SpellCast: {
        const def = SPELLS[e.value];
        const color = def?.visual.color ?? PALETTE.playerSlash;
        const kind = def?.effect;
        if (kind?.type === 'beam') {
          // Beams start at the player, which is where the event sits.
          fx.beam(e.x, e.y, e.dirX, e.dirY, e.amount, kind.widthPx, color);
          if (e.flags === 1) break;
          shake.add(TUNING.shakeLightTrauma);
          this.audio.play('spellBeam', { pan: this.pan(e.x) });
          this.haptics.pulse(20, 0.5);
        } else if (kind?.type === 'burst' && kind.delaySec > 0) {
          // The marker on the ground carries the telegraph; the impact gets the big feedback.
          fx.statusPuff(e.x, e.y, color);
          this.audio.play('spellWhoosh', { pan: this.pan(e.x) });
        } else if (kind?.type === 'zone') {
          fx.nova(e.x, e.y, e.amount, color);
          fx.cloudPuff(e.x, e.y, e.amount, color);
          this.audio.play('poisonApply', { pan: this.pan(e.x) });
          this.haptics.pulse(15, 0.4);
        } else {
          fx.nova(e.x, e.y, e.amount, color);
          fx.nova(e.x, e.y, e.amount * 0.6, 0xffffff);
          if (kind?.type === 'burst' && kind.freeze) fx.freezeBurst(e.x, e.y, e.amount * 0.3);
          shake.add(TUNING.shakeHeavyTrauma);
          this.audio.play('spellCast', { pan: this.pan(e.x) });
          this.haptics.pulse(30, 0.6);
        }
        break;
      }
      case Ev.ZonePulse: {
        const def = SPELLS[e.value];
        const color = def?.visual.color ?? PALETTE.playerSlash;
        if (def?.effect.type === 'burst') {
          // Delayed blast (meteor): the impact.
          fx.nova(e.x, e.y, e.amount, color);
          fx.nova(e.x, e.y, e.amount * 0.5, 0xffffff);
          fx.killBurst(e.x, e.y, 0, -1, color, 24);
          shake.add(TUNING.shakeHeavyTrauma);
          this.audio.play('meteorImpact', { pan: this.pan(e.x) });
          this.haptics.pulse(35, 0.7);
        } else {
          fx.cloudPuff(e.x, e.y, e.amount, color);
        }
        break;
      }
      case Ev.ShotDissolved: {
        const color = SPELLS[e.value]?.visual.color ?? PALETTE.playerSlash;
        fx.statusPuff(e.x, e.y, color);
        this.audio.play('shotDissolved', { pan: this.pan(e.x), volume: 0.7 });
        break;
      }
      case Ev.AuraPulse: {
        const color = SPELLS[e.value]?.visual.color ?? PALETTE.playerSlash;
        fx.auraRing(e.x, e.y, e.amount, color, e.flags > 0);
        this.view.hud.onAuraPulse();
        if (e.flags > 0) this.audio.play('auraPulse', { volume: 0.5 });
        break;
      }
      case Ev.SpellReady:
        this.view.hud.onSpellReady();
        this.audio.play('spellReady', { pitchVariation: 0 });
        break;
      case Ev.StatusApplied: {
        const first = (e.flags & StatusFlag.First) !== 0;
        const full = (e.flags & StatusFlag.Full) !== 0;
        if (e.value === StatusCode.Burn) {
          fx.statusPuff(e.x, e.y, PALETTE.ember);
          this.audio.play('burnApply', { pan: this.pan(e.x), volume: 0.6 });
        } else if (e.value === StatusCode.Chill) {
          fx.statusPuff(e.x, e.y, PALETTE.frost);
          this.audio.play('chillApply', {
            pan: this.pan(e.x),
            volume: 0.6,
            pitch: 1 + e.amount * 0.05,
          });
        } else {
          // Poison and blind tick often (auras); only the first and the full stack make a sound.
          const color = statusColor(e.value);
          if (first || full) fx.statusPuff(e.x, e.y, color);
          if (full) fx.nova(e.x, e.y, 36, color);
          if (e.value === StatusCode.Poison && (first || full)) {
            this.audio.play(full ? 'poisonFull' : 'poisonApply', { pan: this.pan(e.x) });
          } else if (e.value === StatusCode.Blind && first) {
            this.audio.play('blindApply', { pan: this.pan(e.x) });
          }
        }
        break;
      }
      case Ev.StatusExpired:
        fx.statusPuff(e.x, e.y, statusColor(e.value));
        break;
      case Ev.Frozen:
        fx.freezeBurst(e.x, e.y, 24);
        shake.add(TUNING.shakeLightTrauma);
        this.audio.play('freeze', { pan: this.pan(e.x) });
        this.haptics.pulse(15, 0.4);
        break;
      case Ev.Nova: {
        if (e.value === StatusCode.Steam) {
          // Duo combo: bigger and louder than a normal nova so the synergy is felt.
          fx.nova(e.x, e.y, e.amount, PALETTE.steam);
          fx.freezeBurst(e.x, e.y, 30);
          fx.killBurst(e.x, e.y, 0, -1, PALETTE.ember, 20);
          shake.add(TUNING.shakeHeavyTrauma);
          this.audio.play('steam', { pan: this.pan(e.x) });
          this.haptics.pulse(30, 0.6);
          break;
        }
        const color =
          e.value === StatusCode.Burn
            ? PALETTE.ember
            : e.value === StatusCode.None
              ? PALETTE.playerSlash
              : e.value === StatusCode.Chill || e.value === StatusCode.Freeze
                ? PALETTE.frost
                : statusColor(e.value);
        fx.nova(e.x, e.y, e.amount, color);
        this.audio.play('nova', { pan: this.pan(e.x) });
        break;
      }
      case Ev.Shards:
        fx.shards(e.x, e.y, e.amount);
        this.view.hud.onShards();
        this.audio.play('shard', { pan: this.pan(e.x), volume: 0.5, pitchVariation: 0.15 });
        break;
      case Ev.Heal:
        fx.heal(e.x, e.y);
        this.view.damageNumbers.spawnText(
          e.x,
          e.y - 10,
          `+${Math.round(e.amount)}`,
          PALETTE.heal,
          0.55,
        );
        this.audio.play('heal');
        break;
      case Ev.WaveStart:
        this.view.hud.onWaveStart(e.value, e.amount);
        break;
      case Ev.RoomCleared:
        // The "ahh" moment of a room: slow motion, zoom punch, chord, portal opens.
        fx.waveCleared(e.x, e.y);
        fx.portal(e.x, e.y, 0.6, PALETTE.player);
        this.view.hud.onRoomCleared();
        this.view.addZoomPunch(TUNING.lastEnemyZoomPunch);
        this.audio.play('waveCleared', { pitchVariation: 0 });
        this.requestSlowMo({
          scale: TUNING.lastEnemyTimeScale,
          durationSec: TUNING.lastEnemySlowMoSec,
        });
        break;
      case Ev.ExitReached:
        fx.perfectDash(e.x, e.y);
        this.audio.play('spawn', { pitch: 1.4, pitchVariation: 0 });
        this.haptics.pulse(20, 0.4);
        break;
      case Ev.WaveCleared:
        // The "ahh" moment: slow motion, zoom punch, chord.
        fx.waveCleared(e.x, e.y);
        this.view.addZoomPunch(TUNING.lastEnemyZoomPunch);
        this.audio.play('waveCleared', { pitchVariation: 0 });
        this.requestSlowMo({
          scale: TUNING.lastEnemyTimeScale,
          durationSec: TUNING.lastEnemySlowMoSec,
        });
        break;
      case Ev.PlayerDied:
        fx.playerDeath(e.x, e.y);
        shake.add(1);
        this.audio.play('death', { pitchVariation: 0 });
        this.haptics.pulse(120, 1);
        this.requestSlowMo({ scale: 0.25, durationSec: 0.8 });
        break;
    }
  }
}
