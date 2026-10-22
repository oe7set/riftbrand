import { Container, Sprite, Text, type Texture } from 'pixi.js';
import { TUNING } from '../../content/tuning';
import { t } from '../../shared/i18n';
import type { SimState } from '../../sim/sim';
import { TICK_RATE_HZ } from '../../sim/time';
import { PALETTE } from '../render/palette';

const MARGIN_PX = 16;
const HP_WIDTH_PX = 180;
const HP_HEIGHT_PX = 10;
const PIP_WIDTH_PX = 34;
const PIP_HEIGHT_PX = 7;
const PIP_GAP_PX = 6;
const BANNER_SEC = 1.6;
const STAMINA_PULSE_SEC = 0.35;
const DAMAGE_FLASH_SEC = 0.35;

function bar(texture: Texture, tint: number, anchorX = 0): Sprite {
  const s = new Sprite(texture);
  s.tint = tint;
  s.anchor.set(anchorX, 0);
  return s;
}

/**
 * Minimal combat HUD (GDD §11): health, stamina segments, wave label, plus full-screen
 * feedback layers (damage vignette, low-health pulse). Built from tinted white sprites so
 * nothing is redrawn per frame.
 */
export class HudView {
  readonly root = new Container();
  private readonly hpBack: Sprite;
  private readonly hpLag: Sprite;
  private readonly hpFill: Sprite;
  private readonly pipsBack: Sprite[] = [];
  private readonly pipsFill: Sprite[] = [];
  private readonly waveLabel: Text;
  private readonly banner: Text;
  private readonly vignette: Sprite;
  private readonly exitArrow: Sprite;
  private shownLabel = '';
  private lagHp = 1;
  private bannerSec = 0;
  private staminaPulseSec = 0;
  private damageFlashSec = 0;
  private width = 1;
  private height = 1;
  private time = 0;
  /** Player setting 0..1 for full-screen flashes (photosensitivity, GDD §13). */
  flashIntensity = 1;

  constructor(white: Texture, vignette: Texture, arrow: Texture) {
    this.vignette = new Sprite(vignette);
    this.vignette.tint = 0xff2040;
    this.vignette.alpha = 0;
    this.hpBack = bar(white, PALETTE.hpBack);
    this.hpLag = bar(white, 0xffffff);
    this.hpFill = bar(white, PALETTE.hpPlayer);
    this.root.addChild(this.vignette, this.hpBack, this.hpLag, this.hpFill);
    for (let i = 0; i < 8; i++) {
      const back = bar(white, PALETTE.hpBack);
      const fill = bar(white, PALETTE.stamina);
      back.visible = fill.visible = false;
      this.pipsBack.push(back);
      this.pipsFill.push(fill);
      this.root.addChild(back, fill);
    }
    const style = {
      fontFamily: 'system-ui, sans-serif',
      fontWeight: '700' as const,
      fill: 0xffffff,
      letterSpacing: 2,
    };
    this.waveLabel = new Text({ text: '', style: { ...style, fontSize: 16 } });
    this.waveLabel.anchor.set(0.5, 0);
    this.waveLabel.alpha = 0.75;
    this.banner = new Text({
      text: '',
      style: { ...style, fontSize: 40, fill: PALETTE.ember, letterSpacing: 8 },
    });
    this.banner.anchor.set(0.5);
    this.banner.alpha = 0;
    this.exitArrow = new Sprite(arrow);
    this.exitArrow.tint = PALETTE.player;
    this.exitArrow.anchor.set(0.5);
    this.exitArrow.visible = false;
    this.root.addChild(this.waveLabel, this.banner, this.exitArrow);
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.vignette.width = width;
    this.vignette.height = height;
    this.hpBack.position.set(MARGIN_PX, MARGIN_PX);
    this.hpLag.position.set(MARGIN_PX, MARGIN_PX);
    this.hpFill.position.set(MARGIN_PX, MARGIN_PX);
    this.hpBack.scale.set(HP_WIDTH_PX, HP_HEIGHT_PX);
    // Narrow (portrait) screens: tuck the wave label under the bars instead of centring it.
    const narrow = width < HP_WIDTH_PX * 2 + 200;
    this.waveLabel.anchor.set(narrow ? 0 : 0.5, 0);
    this.waveLabel.position.set(
      narrow ? MARGIN_PX : width / 2,
      narrow ? MARGIN_PX + HP_HEIGHT_PX + PIP_HEIGHT_PX + 16 : MARGIN_PX - 2,
    );
    this.banner.position.set(width / 2, height * 0.3);
  }

  onWaveStart(wave: number, total: number): void {
    this.banner.text =
      total > 0 ? t('hud.wave_of', { n: wave, total }) : t('hud.wave', { n: wave });
    this.bannerSec = BANNER_SEC;
  }

  onRoomCleared(): void {
    this.banner.text = t('hud.room_cleared');
    this.bannerSec = BANNER_SEC;
  }

  onStaminaEmpty(): void {
    this.staminaPulseSec = STAMINA_PULSE_SEC;
  }

  onPlayerHit(): void {
    this.damageFlashSec = DAMAGE_FLASH_SEC;
  }

  /** Label: arena wave, room wave x/y, or the horde countdown. */
  private label(sim: SimState): string {
    const room = sim.room;
    if (room.mode === 'horde' && !room.cleared && sim.waves.wave > 0) {
      const sec = Math.ceil(Math.max(0, room.hordeTicksLeft) / TICK_RATE_HZ);
      return t('hud.horde', {
        time: `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`,
      });
    }
    if (room.mode === 'waves') {
      return room.waveIndex >= 0 && !room.cleared
        ? t('hud.wave_of', { n: room.waveIndex + 1, total: room.waves.length })
        : '';
    }
    return sim.waves.wave > 0 ? t('hud.wave', { n: sim.waves.wave }) : '';
  }

  /** Points at the open exit from the screen edge when it is off-screen. */
  private syncExitArrow(sim: SimState, exit: { x: number; y: number }): void {
    const arrow = this.exitArrow;
    const margin = 36;
    const onScreen =
      exit.x > margin &&
      exit.y > margin &&
      exit.x < this.width - margin &&
      exit.y < this.height - margin;
    arrow.visible = sim.room.exitOpen && !sim.room.exitReached && !onScreen;
    if (!arrow.visible) return;
    const cx = this.width / 2;
    const cy = this.height / 2;
    const angle = Math.atan2(exit.y - cy, exit.x - cx);
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    // Scale the direction until it touches the inset screen rectangle.
    const k = Math.min(
      Math.abs((this.width / 2 - margin) / (dx || 1e-6)),
      Math.abs((this.height / 2 - margin) / (dy || 1e-6)),
    );
    arrow.position.set(cx + dx * k, cy + dy * k);
    arrow.rotation = angle;
    const s = 1.3 + Math.sin(this.time * 6) * 0.15;
    arrow.scale.set(s * 1.4, s);
    arrow.alpha = 0.85;
  }

  sync(sim: SimState, dtSec: number, exitScreen: { x: number; y: number }): void {
    this.time += dtSec;
    const eid = sim.playerEid;
    const maxHp = sim.c.maxHp[eid] ?? 1;
    const ratio = Math.max(0, (sim.c.hp[eid] ?? 0) / maxHp);
    // A white "lag" bar shows how much was just lost, then catches up.
    this.lagHp = this.lagHp > ratio ? Math.max(ratio, this.lagHp - dtSec * 0.6) : ratio;
    this.hpFill.scale.set(HP_WIDTH_PX * ratio, HP_HEIGHT_PX);
    this.hpLag.scale.set(HP_WIDTH_PX * this.lagHp, HP_HEIGHT_PX);
    this.hpFill.tint = ratio < 0.3 ? PALETTE.hpFill : PALETTE.hpPlayer;

    const segments = Math.min(this.pipsBack.length, Math.round(TUNING.staminaMax));
    const stamina = sim.player.stamina;
    const pulse = this.staminaPulseSec > 0 ? Math.sin(this.time * 50) * 0.5 + 0.5 : 0;
    this.staminaPulseSec = Math.max(0, this.staminaPulseSec - dtSec);
    for (let i = 0; i < this.pipsBack.length; i++) {
      const back = this.pipsBack[i] as Sprite;
      const fill = this.pipsFill[i] as Sprite;
      const visible = i < segments;
      back.visible = fill.visible = visible;
      if (!visible) continue;
      const x = MARGIN_PX + i * (PIP_WIDTH_PX + PIP_GAP_PX);
      const y = MARGIN_PX + HP_HEIGHT_PX + 8;
      back.position.set(x, y);
      back.scale.set(PIP_WIDTH_PX, PIP_HEIGHT_PX);
      back.tint = pulse > 0.5 ? PALETTE.hpFill : PALETTE.hpBack;
      const amount = Math.max(0, Math.min(1, stamina - i));
      fill.position.set(x, y);
      fill.scale.set(PIP_WIDTH_PX * amount, PIP_HEIGHT_PX);
      fill.alpha = amount >= 1 ? 1 : 0.45;
    }

    const label = this.label(sim);
    if (label !== this.shownLabel) {
      this.shownLabel = label;
      this.waveLabel.text = label;
    }
    this.syncExitArrow(sim, exitScreen);
    if (this.bannerSec > 0) {
      this.bannerSec -= dtSec;
      const k = this.bannerSec / BANNER_SEC;
      this.banner.alpha = Math.min(1, k * 3) * Math.min(1, (1 - k) * 6);
      this.banner.scale.set(1 + (1 - k) * 0.08);
    } else {
      this.banner.alpha = 0;
    }

    // Red vignette: a sharp flash on hits plus a slow pulse at low health.
    this.damageFlashSec = Math.max(0, this.damageFlashSec - dtSec);
    const hitFlash = (this.damageFlashSec / DAMAGE_FLASH_SEC) * 0.8;
    const lowHp =
      ratio > 0 && ratio < 0.3 ? (0.25 + 0.15 * Math.sin(this.time * 5)) * (1 - ratio / 0.3) : 0;
    this.vignette.alpha = Math.min(1, (hitFlash + lowHp) * this.flashIntensity);
    this.vignette.width = this.width;
    this.vignette.height = this.height;
  }
}
