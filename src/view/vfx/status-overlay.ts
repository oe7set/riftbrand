import { BitmapFont, BitmapText, Container, Sprite } from 'pixi.js';
import { STATUS_COUNT, STATUSES, Status } from '../../content/statuses';
import { stacksOf } from '../../sim/ecs/components';
import type { SimState } from '../../sim/sim';
import type { BakedTextures } from '../render/textures';

export const STATUS_FONT = 'rb-status';
/** Icons shown per enemy at most; the highest-priority statuses win. */
const ICONS_PER_ENEMY = 3;
/** On-screen icon diameter and spacing (world pixels). */
const ICON_SIZE_PX = 15;
/** Icon texture width per status-circle width (SVG viewBox 36 / circle 25). */
const STATUS_ICON_SPAN = 36 / 25;
const ICON_SPACING_PX = 24;
/** Height of the icon row above the enemy's health bar. */
const ICON_LIFT_PX = 22;

/** Status indices by display priority, highest first (computed once). */
const ORDER: readonly number[] = STATUSES.map((_, i) => i).sort(
  (a, b) => (STATUSES[b]?.visual.priority ?? 0) - (STATUSES[a]?.visual.priority ?? 0),
);
/** Pre-built stack labels so updating a count never allocates a string. */
export const STATUS_LABELS: readonly string[] = Array.from({ length: 21 }, (_, i) =>
  i > 1 ? String(i) : '',
);

let fontInstalled = false;

export function installStatusFont(): void {
  if (fontInstalled) return;
  BitmapFont.install({
    name: STATUS_FONT,
    style: {
      fontFamily: 'system-ui, sans-serif',
      fontSize: 24,
      fontWeight: '800',
      fill: 0xffffff,
      stroke: { color: 0x07060d, width: 5 },
    },
    chars: '0123456789',
    resolution: 2,
  });
  fontInstalled = true;
}

interface IconGroup {
  icons: Sprite[];
  counts: BitmapText[];
  /** Label index currently shown per icon, to skip redundant text updates. */
  shown: Int8Array;
}

/**
 * Small status icons with stack counts above enemies (ROADMAP M3.1), so players can read at a
 * glance what is on whom. Groups are created lazily per entity slot and reused.
 */
export class StatusIcons {
  readonly root = new Container();
  enabled = true;
  private readonly groups: Array<IconGroup | undefined> = [];

  constructor(private readonly textures: BakedTextures) {
    installStatusFont();
  }

  private groupFor(eid: number): IconGroup {
    let group = this.groups[eid];
    if (group) return group;
    group = { icons: [], counts: [], shown: new Int8Array(ICONS_PER_ENEMY).fill(-1) };
    for (let i = 0; i < ICONS_PER_ENEMY; i++) {
      const icon = new Sprite(this.textures.statusIcons[0]);
      icon.anchor.set(0.5);
      icon.visible = false;
      const count = new BitmapText({ text: '', style: { fontFamily: STATUS_FONT, fontSize: 24 } });
      count.anchor.set(0, 0.5);
      count.scale.set(0.42);
      count.visible = false;
      this.root.addChild(icon, count);
      group.icons.push(icon);
      group.counts.push(count);
    }
    this.groups[eid] = group;
    return group;
  }

  hide(eid: number): void {
    const group = this.groups[eid];
    if (!group) return;
    for (let i = 0; i < ICONS_PER_ENEMY; i++) {
      (group.icons[i] as Sprite).visible = false;
      (group.counts[i] as BitmapText).visible = false;
    }
  }

  /** `top` is the y of the enemy's health bar; icons sit just above it. */
  sync(sim: SimState, eid: number, x: number, top: number, time: number): void {
    const c = sim.c;
    const frozen = (c.frozenTicks[eid] as number) > 0;
    let n = 0;
    for (let k = 0; k < STATUS_COUNT; k++) {
      const s = ORDER[k] as number;
      if (stacksOf(c, eid, s) > 0 || (frozen && s === Status.Chill)) n++;
    }
    if (!this.enabled || n === 0) {
      this.hide(eid);
      return;
    }
    const group = this.groupFor(eid);
    const shownCount = Math.min(n, ICONS_PER_ENEMY);
    const y = top - ICON_LIFT_PX;
    let left = x - ((shownCount - 1) * ICON_SPACING_PX) / 2;
    let slot = 0;
    for (let k = 0; k < STATUS_COUNT && slot < ICONS_PER_ENEMY; k++) {
      const s = ORDER[k] as number;
      const stacks = stacksOf(c, eid, s);
      const frozenChill = frozen && s === Status.Chill;
      if (stacks === 0 && !frozenChill) continue;
      const icon = group.icons[slot] as Sprite;
      const count = group.counts[slot] as BitmapText;
      icon.visible = true;
      icon.texture = this.textures.statusIcons[s] ?? icon.texture;
      icon.position.set(left, y);
      // Frozen solid: the frost icon pulses instead of showing a count.
      const pulse = frozenChill ? 1 + 0.15 * Math.sin(time * 12) : 1;
      // The status circle covers 25 of the icon's 36 units; it should be ICON_SIZE_PX wide.
      icon.scale.set(((ICON_SIZE_PX * STATUS_ICON_SPAN) / (icon.texture.width || 1)) * pulse);
      const label = frozenChill ? 0 : Math.min(stacks, STATUS_LABELS.length - 1);
      if (group.shown[slot] !== label) {
        group.shown[slot] = label;
        count.text = STATUS_LABELS[label] as string;
      }
      count.visible = label > 1;
      count.position.set(left + ICON_SIZE_PX * 0.32, y + ICON_SIZE_PX * 0.32);
      left += ICON_SPACING_PX;
      slot++;
    }
    for (; slot < ICONS_PER_ENEMY; slot++) {
      (group.icons[slot] as Sprite).visible = false;
      (group.counts[slot] as BitmapText).visible = false;
    }
  }
}
