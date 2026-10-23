import { BitmapText, Container, Sprite, Text, type Texture } from 'pixi.js';
import { RIFT_SHOT } from '../../content/abilities';
import { ENEMIES } from '../../content/enemies';
import { STATUS_COUNT, Status } from '../../content/statuses';
import { type TranslationKey, t } from '../../shared/i18n';
import { C, stacksOf } from '../../sim/ecs/components';
import type { SimState } from '../../sim/sim';
import { partnerOf } from '../../sim/systems/champions';
import { TICK_RATE_HZ } from '../../sim/time';
import { PALETTE } from '../render/palette';
import { installStatusFont, STATUS_FONT, STATUS_LABELS } from '../vfx/status-overlay';

const MARGIN_PX = 16;
const HP_WIDTH_PX = 180;
const HP_HEIGHT_PX = 10;
const PIP_WIDTH_PX = 34;
const PIP_HEIGHT_PX = 7;
const PIP_GAP_PX = 6;
const BANNER_SEC = 1.6;
const STAMINA_PULSE_SEC = 0.35;
const DAMAGE_FLASH_SEC = 0.35;
const CAST_PIP_WIDTH_PX = 14;
const ULT_HEIGHT_PX = 5;
const DENIED_PULSE_SEC = 0.35;
const BOSS_BAR_MAX_WIDTH_PX = 520;
const BOSS_BAR_HEIGHT_PX = 12;
/** Status icons under the boss bar (screen pixels). */
const BOSS_STATUS_ICON_PX = 20;
const BOSS_STATUS_GAP_PX = 42;
/** Spell slot icons under the ultimate meter (screen pixels). */
const SPELL_ICON_PX = 26;
const SPELL_GAP_PX = 8;

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
  private readonly shardLabel: Text;
  private readonly castBack: Sprite[] = [];
  private readonly castFill: Sprite[] = [];
  private readonly ultBack: Sprite;
  private readonly ultFill: Sprite;
  private castDeniedSec = 0;
  private ultDeniedSec = 0;
  private ultReadySec = 0;
  private readonly bossBack: Sprite;
  private readonly bossLag: Sprite;
  private readonly bossFill: Sprite;
  private readonly bossMarks: Sprite[] = [];
  private readonly bossName: Text;
  /** One icon and stack count per status, shown under the boss bar while active. */
  private readonly bossStatusIcons: Sprite[] = [];
  private readonly bossStatusCounts: BitmapText[] = [];
  private readonly bossStatusShown = new Int8Array(STATUS_COUNT).fill(-1);
  /** Active spell and aura icons; a dark sweep covers the active one while it cools down. */
  private readonly spellIcon: Sprite;
  private readonly spellShade: Sprite;
  private readonly auraIcon: Sprite;
  private readonly spellIcons: readonly Texture[];
  private spellReadySec = 0;
  private spellDeniedSec = 0;
  private auraPulseSec = 0;
  private bossType = -1;
  private bossLagRatio = 1;
  private bossVisible = false;
  private shownShards = -1;
  private shardPulseSec = 0;
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

  constructor(
    white: Texture,
    vignette: Texture,
    arrow: Texture,
    statusIcons: readonly Texture[],
    spellIcons: readonly Texture[],
  ) {
    this.spellIcons = spellIcons;
    this.spellIcon = new Sprite(white);
    this.spellIcon.anchor.set(0.5);
    this.spellShade = new Sprite(white);
    this.spellShade.tint = PALETTE.background;
    this.spellShade.anchor.set(0.5, 1);
    this.auraIcon = new Sprite(white);
    this.auraIcon.anchor.set(0.5);
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
    for (let i = 0; i < RIFT_SHOT.charges; i++) {
      const back = bar(white, PALETTE.hpBack);
      const fill = bar(white, PALETTE.riftShot);
      this.castBack.push(back);
      this.castFill.push(fill);
      this.root.addChild(back, fill);
    }
    this.ultBack = bar(white, PALETTE.hpBack);
    this.ultFill = bar(white, PALETTE.ultimate);
    this.root.addChild(this.ultBack, this.ultFill);
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
    this.shardLabel = new Text({
      text: '',
      style: { ...style, fontSize: 15, fill: PALETTE.shard },
    });
    this.shardLabel.anchor.set(0, 0);
    this.bossBack = bar(white, PALETTE.hpBack);
    this.bossLag = bar(white, 0xffffff);
    this.bossFill = bar(white, PALETTE.ultimate);
    for (let i = 0; i < 4; i++) {
      const mark = bar(white, 0xffffff);
      mark.alpha = 0.8;
      this.bossMarks.push(mark);
    }
    this.bossName = new Text({
      text: '',
      style: { ...style, fontSize: 15, fill: PALETTE.ultimate, letterSpacing: 4 },
    });
    this.bossName.anchor.set(0.5, 1);
    this.root.addChild(this.waveLabel, this.banner, this.exitArrow, this.shardLabel);
    this.root.addChild(
      this.bossBack,
      this.bossLag,
      this.bossFill,
      ...this.bossMarks,
      this.bossName,
    );
    this.root.addChild(this.spellIcon, this.spellShade, this.auraIcon);
    installStatusFont();
    for (let s = 0; s < STATUS_COUNT; s++) {
      const icon = new Sprite(statusIcons[s] ?? white);
      icon.anchor.set(0.5);
      icon.visible = false;
      const count = new BitmapText({ text: '', style: { fontFamily: STATUS_FONT, fontSize: 24 } });
      count.anchor.set(0, 0.5);
      count.scale.set(0.6);
      count.visible = false;
      this.bossStatusIcons.push(icon);
      this.bossStatusCounts.push(count);
      this.root.addChild(icon, count);
    }
  }

  /** Statuses on the boss, left-aligned under its bar (ROADMAP M3.1). */
  private syncBossStatus(sim: SimState, boss: number, x: number, y: number): void {
    const c = sim.c;
    const frozen = boss >= 0 && (c.frozenTicks[boss] as number) > 0;
    let left = x + BOSS_STATUS_ICON_PX / 2;
    for (let s = 0; s < STATUS_COUNT; s++) {
      const icon = this.bossStatusIcons[s] as Sprite;
      const count = this.bossStatusCounts[s] as BitmapText;
      const stacks = boss >= 0 ? stacksOf(c, boss, s) : 0;
      const on = stacks > 0 || (frozen && s === Status.Chill);
      icon.visible = on;
      count.visible = on && stacks > 1;
      if (!on) continue;
      icon.position.set(left, y);
      // The status circle covers 25 of the icon's 36 units.
      icon.scale.set(
        (BOSS_STATUS_ICON_PX * (36 / 25)) / (icon.texture.width || BOSS_STATUS_ICON_PX),
      );
      const label = Math.min(stacks, STATUS_LABELS.length - 1);
      if (this.bossStatusShown[s] !== label) {
        this.bossStatusShown[s] = label;
        count.text = STATUS_LABELS[label] as string;
      }
      count.position.set(left + BOSS_STATUS_ICON_PX * 0.45, y + 2);
      left += BOSS_STATUS_GAP_PX;
    }
  }

  /** Big boss bar with name and phase marks (GDD §11); hidden without a boss. */
  private syncBoss(sim: SimState, dtSec: number): void {
    const { world, c } = sim;
    // The boss, else a duel champion (ROADMAP M3.5); twins share one bar.
    let boss = -1;
    for (let eid = 0; eid < world.highWater; eid++) {
      if (((world.masks[eid] as number) & C.Enemy) === 0) continue;
      const role = ENEMIES[c.enemyType[eid] as number]?.role;
      if (role === 'boss') {
        boss = eid;
        break;
      }
      if (role === 'champion' && boss < 0) boss = eid;
    }
    const visible = boss >= 0;
    this.bossVisible = visible;
    this.bossBack.visible = this.bossLag.visible = this.bossFill.visible = visible;
    this.bossName.visible = visible;
    for (const m of this.bossMarks) m.visible = false;
    if (!visible) {
      this.syncBossStatus(sim, -1, 0, 0);
      return;
    }
    const type = c.enemyType[boss] as number;
    const def = ENEMIES[type];
    if (type !== this.bossType) {
      this.bossType = type;
      this.bossLagRatio = 1;
      this.bossName.text = t(`boss.${def?.id ?? ''}.name` as TranslationKey);
    }
    const width = Math.min(BOSS_BAR_MAX_WIDTH_PX, this.width - 2 * MARGIN_PX - 40);
    const narrow = this.width < HP_WIDTH_PX * 2 + 200;
    const x = (this.width - width) / 2;
    const y = narrow ? 118 : 64;
    const partner = partnerOf(sim, boss);
    const hp = (c.hp[boss] as number) + (partner >= 0 ? (c.hp[partner] as number) : 0);
    const maxHp = (c.maxHp[boss] as number) + (partner >= 0 ? (c.maxHp[partner] as number) : 0);
    const ratio = Math.max(0, hp / maxHp);
    this.bossLagRatio =
      this.bossLagRatio > ratio ? Math.max(ratio, this.bossLagRatio - dtSec * 0.4) : ratio;
    this.bossBack.position.set(x, y);
    this.bossBack.scale.set(width, BOSS_BAR_HEIGHT_PX);
    this.bossLag.position.set(x, y);
    this.bossLag.scale.set(width * this.bossLagRatio, BOSS_BAR_HEIGHT_PX);
    this.bossFill.position.set(x, y);
    this.bossFill.scale.set(width * ratio, BOSS_BAR_HEIGHT_PX);
    // Enraged (last phase) glows hotter.
    const phases = def?.boss?.phases ?? [];
    const last = (c.aiPhase[boss] as number) >= phases.length - 1 && phases.length > 1;
    this.bossFill.tint = last ? PALETTE.hpFill : PALETTE.ultimate;
    this.bossName.position.set(this.width / 2, y - 4);
    this.syncBossStatus(sim, boss, x, y + BOSS_BAR_HEIGHT_PX + BOSS_STATUS_ICON_PX * 0.75);
    for (let i = 1; i < phases.length && i - 1 < this.bossMarks.length; i++) {
      // Twins enrage at 0 % (when one falls): no mark for that.
      if ((phases[i]?.hpBelow ?? 0) <= 0) continue;
      const mark = this.bossMarks[i - 1] as Sprite;
      mark.visible = true;
      mark.position.set(x + width * (phases[i]?.hpBelow ?? 0) - 1, y - 3);
      mark.scale.set(2, BOSS_BAR_HEIGHT_PX + 6);
    }
  }

  onBanner(text: string): void {
    this.banner.text = text;
    this.bannerSec = BANNER_SEC;
  }

  onBoss(name: string): void {
    this.banner.text = name;
    this.bannerSec = BANNER_SEC * 1.5;
  }

  onBossPhase(enraged: boolean): void {
    this.banner.text = enraged ? t('hud.boss_enraged') : t('hud.boss_phase');
    this.bannerSec = BANNER_SEC;
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
      narrow ? MARGIN_PX + HP_HEIGHT_PX + PIP_HEIGHT_PX + ULT_HEIGHT_PX + 22 : MARGIN_PX - 2,
    );
    this.banner.position.set(width / 2, height * 0.3);
  }

  onWaveStart(wave: number, total: number): void {
    this.banner.text =
      total > 0 ? t('hud.wave_of', { n: wave, total }) : t('hud.wave', { n: wave });
    this.bannerSec = BANNER_SEC;
  }

  onShards(): void {
    this.shardPulseSec = 0.25;
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

  onDenied(ultimate: boolean): void {
    if (ultimate) this.ultDeniedSec = DENIED_PULSE_SEC;
    else this.castDeniedSec = DENIED_PULSE_SEC;
  }

  onUltimateReady(): void {
    this.ultReadySec = 0.6;
  }

  /** Label: arena wave, room wave x/y, or the horde countdown. */
  private label(sim: SimState): string {
    const room = sim.room;
    // The boss bar says everything; a "wave 1/1" label would only add noise.
    if (this.bossVisible) return '';
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

  /** Cast charges sit right of the stamina pips; the ultimate meter runs below both. */
  private syncCastAndUlt(sim: SimState, dtSec: number, segments: number): void {
    const p = sim.player;
    const rowY = MARGIN_PX + HP_HEIGHT_PX + 8;
    const castX = MARGIN_PX + segments * (PIP_WIDTH_PX + PIP_GAP_PX) + 6;
    const recharge = 1 - p.castRechargeTicks / Math.max(1, sim.cast.rechargeSec * TICK_RATE_HZ);
    this.castDeniedSec = Math.max(0, this.castDeniedSec - dtSec);
    const castPulse = this.castDeniedSec > 0 ? Math.sin(this.time * 50) * 0.5 + 0.5 : 0;
    for (let i = 0; i < this.castBack.length; i++) {
      const back = this.castBack[i] as Sprite;
      const fill = this.castFill[i] as Sprite;
      const x = castX + i * (CAST_PIP_WIDTH_PX + 4);
      back.position.set(x, rowY);
      back.scale.set(CAST_PIP_WIDTH_PX, PIP_HEIGHT_PX);
      back.tint = castPulse > 0.5 ? PALETTE.hpFill : PALETTE.hpBack;
      // The next charge to return fills up gradually; later ones stay empty.
      const amount = i < p.castCharges ? 1 : i === p.castCharges ? Math.max(0, recharge) : 0;
      fill.position.set(x, rowY);
      fill.scale.set(CAST_PIP_WIDTH_PX * amount, PIP_HEIGHT_PX);
      fill.alpha = amount >= 1 ? 1 : 0.4;
    }

    const ultY = rowY + PIP_HEIGHT_PX + 5;
    const width = castX + RIFT_SHOT.charges * (CAST_PIP_WIDTH_PX + 4) - 4 - MARGIN_PX;
    this.ultDeniedSec = Math.max(0, this.ultDeniedSec - dtSec);
    this.ultReadySec = Math.max(0, this.ultReadySec - dtSec);
    this.ultBack.position.set(MARGIN_PX, ultY);
    this.ultBack.scale.set(width, ULT_HEIGHT_PX);
    this.ultBack.tint =
      this.ultDeniedSec > 0 && Math.sin(this.time * 50) > 0 ? PALETTE.hpFill : PALETTE.hpBack;
    this.ultFill.position.set(MARGIN_PX, ultY);
    this.ultFill.scale.set(width * p.ultCharge, ULT_HEIGHT_PX + this.ultReadySec * 6);
    this.ultFill.tint = p.ultCharge >= 1 ? 0xffffff : PALETTE.ultimate;
    this.ultFill.alpha = p.ultCharge >= 1 ? 0.75 + 0.25 * Math.sin(this.time * 6) : 0.85;
    this.syncSpells(sim, dtSec, ultY + ULT_HEIGHT_PX + 8 + SPELL_ICON_PX / 2);
  }

  /** The two spell slots (ROADMAP M3.2): active spell with cooldown sweep, aura with pulse. */
  private syncSpells(sim: SimState, dtSec: number, y: number): void {
    const p = sim.player;
    this.spellReadySec = Math.max(0, this.spellReadySec - dtSec);
    this.spellDeniedSec = Math.max(0, this.spellDeniedSec - dtSec);
    this.auraPulseSec = Math.max(0, this.auraPulseSec - dtSec);
    const activeTex = this.spellIcons[p.activeSpell];
    const auraTex = this.spellIcons[p.auraSpell];
    const x = MARGIN_PX + SPELL_ICON_PX / 2;
    const scaleFor = (tex: Texture) => SPELL_ICON_PX / Math.max(1, tex.width * 0.8);
    this.spellIcon.visible = activeTex !== undefined;
    this.spellShade.visible = activeTex !== undefined && p.spellCooldownTicks > 0;
    if (activeTex) {
      this.spellIcon.texture = activeTex;
      const pop = 1 + this.spellReadySec * 0.8;
      this.spellIcon.scale.set(scaleFor(activeTex) * pop);
      this.spellIcon.position.set(x, y);
      const denied = this.spellDeniedSec > 0 && Math.sin(this.time * 50) > 0;
      this.spellIcon.tint = denied ? PALETTE.hpFill : 0xffffff;
      const cooling = p.spellCooldownTicks / Math.max(1, p.spellCooldownTotal);
      this.spellIcon.alpha = cooling > 0 ? 0.55 : 1;
      // The shade shrinks from the top as the cooldown runs out.
      this.spellShade.position.set(x, y + SPELL_ICON_PX / 2);
      this.spellShade.scale.set(SPELL_ICON_PX, SPELL_ICON_PX * cooling);
      this.spellShade.alpha = 0.6;
    }
    this.auraIcon.visible = auraTex !== undefined;
    if (auraTex) {
      this.auraIcon.texture = auraTex;
      this.auraIcon.scale.set(scaleFor(auraTex) * (1 + this.auraPulseSec * 0.6));
      this.auraIcon.position.set(x + SPELL_ICON_PX + SPELL_GAP_PX, y);
    }
  }

  onSpellReady(): void {
    this.spellReadySec = 0.3;
  }

  onSpellDenied(): void {
    this.spellDeniedSec = DENIED_PULSE_SEC;
  }

  onAuraPulse(): void {
    this.auraPulseSec = 0.25;
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

    const segments = Math.min(this.pipsBack.length, Math.round(sim.staminaMax));
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

    this.syncCastAndUlt(sim, dtSec, segments);

    if (sim.shards !== this.shownShards) {
      this.shownShards = sim.shards;
      this.shardLabel.text = `◆ ${sim.shards}`;
    }
    this.shardPulseSec = Math.max(0, this.shardPulseSec - dtSec);
    this.shardLabel.position.set(MARGIN_PX + HP_WIDTH_PX + 12, MARGIN_PX - 3);
    this.shardLabel.scale.set(1 + this.shardPulseSec * 0.8);
    const label = this.label(sim);
    if (label !== this.shownLabel) {
      this.shownLabel = label;
      this.waveLabel.text = label;
    }
    this.syncExitArrow(sim, exitScreen);
    this.syncBoss(sim, dtSec);
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
