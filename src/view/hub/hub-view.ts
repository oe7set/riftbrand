import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { rigIndex } from '../../content/rigs';
import type { HubLayoutDef, Speaker, StationDef } from '../../content/schema';
import { type TranslationKey, t } from '../../shared/i18n';
import { PALETTE } from '../render/palette';
import { createRigInput, type RigInput } from '../render/rig/animate';
import type { BakedRig } from '../render/rig/bake-rig';
import { RigInstance } from '../render/rig/rig-instance';
import { BAKE_RADIUS_PX, type BakedTextures } from '../render/textures';

/** Figures stand a bit taller than the player; their collision radius for drawing. */
const NPC_RADIUS_PX = 17;
const LABEL_OFFSET_PX = 16;
/** Figures only turn towards Vesper when she is this close. */
const LOOK_RANGE_PX = 320;

interface Npc {
  station: StationDef;
  speaker: Speaker;
  rig: RigInstance;
  input: RigInput;
  label: Text;
  bubble: Text;
  facing: number;
}

/**
 * The walkable refuge's own drawing (ROADMAP M5.1): figures with idle rigs, name labels, station
 * markers and the campfire. Reads the hub layout and the player position, never the sim state.
 */
export class HubView {
  readonly ground = new Container();
  readonly bodies = new Container();
  readonly labels = new Container();
  private readonly npcs: Npc[] = [];
  private readonly markers: Sprite[] = [];
  private readonly fireGlow: Sprite;
  private readonly flames: Sprite[] = [];
  private readonly fire: { x: number; y: number };
  /** Landmarks drawn once: the Ember Tree's crown, Nix's awning, Sel's runes, the portal arch. */
  private readonly decor = new Graphics();
  private time = 0;
  private labelLocale = '';

  constructor(layout: HubLayoutDef, rigs: readonly BakedRig[], textures: BakedTextures) {
    for (const station of layout.stations) {
      const marker = new Sprite(textures.ring);
      marker.anchor.set(0.5);
      marker.position.set(station.x, station.y);
      marker.scale.set(
        station.radiusPx / BAKE_RADIUS_PX,
        (station.radiusPx * 0.45) / BAKE_RADIUS_PX,
      );
      marker.tint = PALETTE.player;
      this.markers.push(marker);
      this.ground.addChild(marker);
      const npc = station.npc;
      const baked = npc ? rigs[rigIndex(npc.rig)] : undefined;
      if (!npc || !baked) continue;
      const rig = new RigInstance(baked, this.bodies, this.ground, textures.dot, textures.softGlow);
      rig.visible = true;
      const style = {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 13,
        fontWeight: '700' as const,
        fill: baked.layout.rig.colors.body,
        stroke: { color: PALETTE.background, width: 4 },
      };
      const label = new Text({ text: '', style, resolution: 2 });
      label.anchor.set(0.5, 1);
      const bubble = new Text({ text: '…', style: { ...style, fontSize: 18 }, resolution: 2 });
      bubble.anchor.set(0.5, 1);
      this.labels.addChild(label, bubble);
      this.npcs.push({
        station,
        speaker: npc.speaker,
        rig,
        input: createRigInput(),
        label,
        bubble,
        facing: 1,
      });
    }
    this.drawDecor(layout);
    this.bodies.addChild(this.decor);
    const campfire = layout.stations.find((s) => s.id === 'campfire');
    this.fire = { x: campfire?.x ?? 0, y: campfire?.y ?? 0 };
    this.fireGlow = new Sprite(textures.softGlow);
    this.fireGlow.anchor.set(0.5);
    this.fireGlow.position.set(this.fire.x, this.fire.y);
    this.fireGlow.tint = PALETTE.ember;
    this.ground.addChild(this.fireGlow);
    for (let i = 0; i < 3; i++) {
      const flame = new Sprite(textures.dot);
      flame.anchor.set(0.5, 0.8);
      flame.tint = i === 2 ? 0xffe0a0 : PALETTE.ember;
      this.flames.push(flame);
      this.bodies.addChild(flame);
    }
  }

  /** Static landmark art on top of the plain obstacle shapes; never redrawn per frame. */
  private drawDecor(layout: HubLayoutDef): void {
    const g = this.decor;
    const [tree, stall, tower, wallL, wallR] = layout.obstacles;
    if (tree?.kind === 'circle') {
      // Ember Tree: glowing branches fanning up from the trunk, embers as fruit.
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i - 3) * 0.32;
        const len = tree.r * (1.5 + (i % 3) * 0.35);
        const x1 = tree.x + Math.cos(a) * tree.r * 0.5;
        const y1 = tree.y + Math.sin(a) * tree.r * 0.5;
        const x2 = tree.x + Math.cos(a) * len;
        const y2 = tree.y + Math.sin(a) * len;
        g.moveTo(x1, y1).lineTo(x2, y2).stroke({ color: PALETTE.ember, width: 9, alpha: 0.08 });
        g.moveTo(x1, y1).lineTo(x2, y2).stroke({ color: PALETTE.ember, width: 2.5, alpha: 0.75 });
        g.circle(x2, y2, 5).fill({ color: 0xffd36b, alpha: 0.9 });
        g.circle(x2, y2, 11).fill({ color: PALETTE.ember, alpha: 0.12 });
      }
    }
    if (stall?.kind === 'rect') {
      // Nix's stall: a striped awning and two lanterns.
      const stripes = 6;
      for (let i = 0; i < stripes; i++) {
        const x = stall.x + (stall.w / stripes) * i;
        g.rect(x, stall.y - 22, stall.w / stripes, 22).fill({
          color: i % 2 === 0 ? 0xc46bff : 0x2a1a3a,
          alpha: 0.5,
        });
      }
      g.rect(stall.x, stall.y - 22, stall.w, 22).stroke({ color: 0xc46bff, width: 2, alpha: 0.8 });
      for (const lx of [stall.x + 12, stall.x + stall.w - 12]) {
        g.circle(lx, stall.y + 8, 12).fill({ color: 0xc46bff, alpha: 0.15 });
        g.circle(lx, stall.y + 8, 5).fill({ color: 0xf0d6ff, alpha: 0.95 });
      }
    }
    if (tower?.kind === 'rect') {
      // Sel's rune tower: glowing runes up the walls and a lit window.
      const cx = tower.x + tower.w / 2;
      for (let i = 0; i < 3; i++) {
        const y = tower.y + 30 + i * 40;
        g.poly([cx, y - 10, cx + 8, y, cx, y + 10, cx - 8, y]).stroke({
          color: 0xb8a6ff,
          width: 2,
          alpha: 0.85,
        });
      }
      g.rect(cx - 10, tower.y + tower.h - 36, 20, 26).fill({ color: 0xeee8ff, alpha: 0.6 });
    }
    if (wallL?.kind === 'rect' && wallR?.kind === 'rect') {
      // Portal hall: an arch spanning the two walls.
      const x1 = wallL.x + wallL.w / 2;
      const x2 = wallR.x + wallR.w / 2;
      const y = wallL.y + 10;
      const mid = (x1 + x2) / 2;
      g.moveTo(x1, y)
        .quadraticCurveTo(mid, y - 90, x2, y)
        .stroke({ color: PALETTE.portal, width: 10, alpha: 0.1 });
      g.moveTo(x1, y)
        .quadraticCurveTo(mid, y - 90, x2, y)
        .stroke({ color: PALETTE.portal, width: 3, alpha: 0.8 });
    }
  }

  set visible(on: boolean) {
    this.ground.visible = on;
    this.bodies.visible = on;
    this.labels.visible = on;
  }

  /**
   * `active` is the station index in reach (-1 = none); `fresh` tells which speakers have a new
   * line for this visit.
   */
  sync(
    dtSec: number,
    playerX: number,
    playerY: number,
    active: number,
    fresh: Readonly<Partial<Record<Speaker, boolean>>>,
    locale: string,
  ): void {
    this.time += dtSec;
    const relabel = locale !== this.labelLocale;
    this.labelLocale = locale;
    for (let i = 0; i < this.markers.length; i++) {
      const m = this.markers[i] as Sprite;
      const on = i === active;
      m.alpha = on ? 0.55 + 0.25 * Math.sin(this.time * 6) : 0.12;
    }
    for (const npc of this.npcs) {
      const s = npc.station;
      const dx = playerX - s.x;
      if (Math.abs(dx) > 8 && Math.hypot(dx, playerY - s.y) < LOOK_RANGE_PX) {
        npc.facing = dx > 0 ? 1 : -1;
      }
      npc.input.timeSec = this.time + s.x * 0.01;
      npc.rig.update(npc.input, s.x, s.y, NPC_RADIUS_PX, npc.facing, 1, 1, false, 0);
      const top =
        s.y - npc.rig.baked.layout.rig.heightUnits * NPC_RADIUS_PX * 1.3 - LABEL_OFFSET_PX;
      if (relabel) npc.label.text = t(`speaker.${npc.speaker}` as TranslationKey);
      npc.label.position.set(s.x, top);
      npc.bubble.visible = fresh[npc.speaker] === true;
      npc.bubble.position.set(s.x + 2, top - 16 + Math.sin(this.time * 3) * 2);
    }
    const flicker = 0.9 + 0.1 * Math.sin(this.time * 13) + 0.05 * Math.sin(this.time * 31);
    this.fireGlow.scale.set(1.3 * flicker);
    this.fireGlow.alpha = 0.35;
    for (let i = 0; i < this.flames.length; i++) {
      const f = this.flames[i] as Sprite;
      const k = Math.sin(this.time * (9 + i * 4) + i);
      f.position.set(this.fire.x + (i - 1) * 7 + k * 1.5, this.fire.y + 4);
      f.scale.set(0.55 - i * 0.12 + k * 0.05, 0.9 - i * 0.15 + k * 0.1);
      f.alpha = 0.85;
    }
  }
}
