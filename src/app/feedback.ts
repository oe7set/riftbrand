import { ENEMIES, ENEMY_TYPE } from '../content/enemies';
import { TUNING } from '../content/tuning';
import { BRAND_BLADE } from '../content/weapons/brand-blade';
import type { AudioEngine } from '../platform/audio/audio-engine';
import type { Haptics } from '../platform/haptics';
import { Ev, type EventBuffer, EvFlag, type SimEvent } from '../sim/events';
import { PlayerAction } from '../sim/player-state';
import type { SimState } from '../sim/sim';
import type { GameView } from '../view/game-view';
import { PALETTE } from '../view/render/palette';
import { BAKE_RADIUS_PX } from '../view/render/textures';

/** Combo hits climb in pitch so a full combo "sings" (GDD §4.7). */
const COMBO_PITCH_STEP = 1.06;
const AFTERIMAGE_INTERVAL_SEC = 1 / 45;

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

  /** Continuous, per-frame feedback (dash afterimages). */
  update(sim: SimState, dtSec: number): void {
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
        fx.killBurst(
          e.x,
          e.y,
          e.dirX,
          e.dirY,
          def?.visual.color ?? PALETTE.ember,
          def?.radiusPx ?? 14,
        );
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
        const heavy = ENEMIES[e.value]?.attack.kind === 'slam';
        this.audio.play(heavy ? 'telegraphHeavy' : 'telegraph', {
          pan: this.pan(e.x),
          volume: 0.8,
        });
        break;
      }
      case Ev.EnemyAttack: {
        const atk = ENEMIES[e.value]?.attack;
        if (atk?.kind === 'slam') {
          fx.slamShockwave(e.x, e.y, atk.slamRadiusPx);
          shake.add(TUNING.shakeHeavyTrauma);
          this.audio.play('slam', { pan: this.pan(e.x) });
          this.haptics.pulse(20, 0.4);
        } else if (atk?.kind === 'volley') {
          fx.muzzle(e.x + e.dirX * 14, e.y + e.dirY * 14, PALETTE.enemyShot);
          this.audio.play('enemyShoot', { pan: this.pan(e.x) });
        }
        break;
      }
      case Ev.PlayerHit:
        fx.playerHit(e.x, e.y, e.dirX, e.dirY);
        this.view.entities.hit(e.eid, e.dirX, e.dirY);
        this.view.hud.onPlayerHit();
        shake.add(TUNING.shakePlayerHitTrauma);
        this.audio.play('playerHit', { pitchVariation: 0.04 });
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
      case Ev.Spawn:
        fx.spawnFlash(e.x, e.y, ENEMIES[e.value]?.visual.color ?? PALETTE.portal);
        break;
      case Ev.ProjectileExpired:
        fx.shotPop(e.x, e.y);
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
