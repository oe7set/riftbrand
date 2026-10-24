import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { buildingById, DECORATIONS } from '../../content/hub/buildings';
import { SITE_BUILDINGS, SITE_OBSTACLE_START } from '../../content/hub/layout';
import { rigIndex } from '../../content/rigs';
import type { DecorationDef, HubLayoutDef, Speaker, StationDef } from '../../content/schema';
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

/** How far the refuge is rebuilt (ROADMAP M5.3); `version` changes whenever anything does. */
export interface RefugeLook {
  version: number;
  /** Building levels by id; missing = 0. */
  levels: Readonly<Record<string, number>>;
  decorations: readonly string[];
  /** 0..1, see refugeGrowth(). */
  growth: number;
}

/** Plant spots around the paths; more of them sprout as the refuge grows (GDD §2.3). */
const PLANT_SPOTS: ReadonlyArray<readonly [number, number]> = [
  [560, 520],
  [840, 560],
  [620, 800],
  [860, 780],
  [420, 700],
  [980, 380],
  [460, 330],
  [940, 1000],
  [560, 1000],
  [1250, 620],
  [180, 600],
  [760, 960],
];

const SITE_COLORS: Readonly<Record<string, number>> = {
  forge: 0xff9a5a,
  map_table: 0x7ff6c8,
  archive: 0x9fa8ff,
  market: 0xc46bff,
  rune_tower: 0xb8a6ff,
  campfire: 0xffb347,
};

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
  /** Building levels, plants and decorations; redrawn only when the refuge changes. */
  private readonly growthArt = new Graphics();
  /** Soft light over each building site, brighter with its level. */
  private readonly siteGlows: Array<{ sprite: Sprite; building: string }> = [];
  private refugeVersion = -1;
  private levels: Readonly<Record<string, number>> = {};
  private readonly layout: HubLayoutDef;

  constructor(layout: HubLayoutDef, rigs: readonly BakedRig[], textures: BakedTextures) {
    this.layout = layout;
    for (const station of layout.stations) {
      if (station.building) {
        const glow = new Sprite(textures.softGlow);
        glow.anchor.set(0.5);
        glow.position.set(station.x, station.y - 60);
        glow.scale.set(3.2, 2.2);
        glow.tint = SITE_COLORS[station.building] ?? PALETTE.ember;
        glow.alpha = 0;
        this.siteGlows.push({ sprite: glow, building: station.building });
        this.ground.addChild(glow);
      }
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
    this.ground.addChild(this.growthArt);
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

  /** A ruin stays empty until it is built; its figure moves in then. */
  private inhabited(station: StationDef): boolean {
    const def = station.building ? buildingById(station.building) : undefined;
    return !def?.ruin || (this.levels[def.id] ?? 0) > 0;
  }

  /** Redraws building levels, plants and decorations (only when the refuge changed). */
  private rebuild(look: RefugeLook): void {
    this.levels = look.levels;
    const g = this.growthArt;
    g.clear();
    SITE_BUILDINGS.forEach((id, i) => {
      const site = this.layout.obstacles[SITE_OBSTACLE_START + i];
      if (site?.kind === 'rect') drawSite(g, id, look.levels[id] ?? 0, site);
    });
    drawUpgrades(g, this.layout, look.levels);
    const plants = Math.round(look.growth * PLANT_SPOTS.length);
    for (let i = 0; i < plants; i++) {
      const spot = PLANT_SPOTS[i];
      if (spot) drawPlant(g, spot[0], spot[1], i);
    }
    for (const d of DECORATIONS) if (look.decorations.includes(d.id)) drawDecoration(g, d);
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
    look: RefugeLook,
  ): void {
    this.time += dtSec;
    if (look.version !== this.refugeVersion) {
      this.refugeVersion = look.version;
      this.rebuild(look);
    }
    for (const glow of this.siteGlows) {
      const level = this.levels[glow.building] ?? 0;
      glow.sprite.alpha = level * 0.09 + (level > 0 ? 0.02 * Math.sin(this.time * 2) : 0);
    }
    const relabel = locale !== this.labelLocale;
    this.labelLocale = locale;
    for (let i = 0; i < this.markers.length; i++) {
      const m = this.markers[i] as Sprite;
      const on = i === active;
      m.alpha = on ? 0.55 + 0.25 * Math.sin(this.time * 6) : 0.12;
    }
    for (const npc of this.npcs) {
      const s = npc.station;
      const home = this.inhabited(s);
      npc.rig.visible = home;
      npc.label.visible = home;
      if (!home) {
        npc.bubble.visible = false;
        continue;
      }
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
    // The campfire burns brighter as its place is built up.
    const fire = this.levels.campfire ?? 0;
    this.fireGlow.scale.set((1.3 + fire * 0.35) * flicker);
    this.fireGlow.alpha = 0.35 + fire * 0.08;
    for (let i = 0; i < this.flames.length; i++) {
      const f = this.flames[i] as Sprite;
      const k = Math.sin(this.time * (9 + i * 4) + i);
      f.position.set(this.fire.x + (i - 1) * 7 + k * 1.5, this.fire.y + 4);
      f.scale.set(0.55 - i * 0.12 + k * 0.05, 0.9 - i * 0.15 + k * 0.1);
      f.alpha = 0.85;
    }
  }
}

type Rect = { x: number; y: number; w: number; h: number };

/** A ruin is a broken outline with rubble; built sites get walls, roof and light. */
function drawSite(g: Graphics, id: string, level: number, r: Rect): void {
  const color = SITE_COLORS[id] ?? PALETTE.ember;
  if (level === 0) {
    const grey = 0x6a6478;
    g.moveTo(r.x, r.y + r.h)
      .lineTo(r.x, r.y + r.h * 0.35)
      .lineTo(r.x + r.w * 0.2, r.y + r.h * 0.2)
      .stroke({ color: grey, width: 3, alpha: 0.7 });
    g.moveTo(r.x + r.w, r.y + r.h)
      .lineTo(r.x + r.w, r.y + r.h * 0.55)
      .stroke({ color: grey, width: 3, alpha: 0.7 });
    g.moveTo(r.x, r.y + r.h)
      .lineTo(r.x + r.w, r.y + r.h)
      .stroke({ color: grey, width: 2, alpha: 0.5 });
    for (let i = 0; i < 5; i++) {
      const x = r.x + r.w * (0.15 + i * 0.17);
      const y = r.y + r.h * (0.55 + (i % 2) * 0.25);
      g.poly([x - 7, y + 4, x - 2, y - 5, x + 7, y - 2, x + 5, y + 5]).fill({
        color: grey,
        alpha: 0.6,
      });
    }
    return;
  }
  g.rect(r.x, r.y, r.w, r.h)
    .fill({ color, alpha: 0.08 })
    .stroke({ color, width: 2.5, alpha: 0.85 });
  // Roof ridge.
  g.moveTo(r.x - 8, r.y)
    .lineTo(r.x + r.w / 2, r.y - 26)
    .lineTo(r.x + r.w + 8, r.y)
    .stroke({ color, width: 3, alpha: 0.9 });
  const cx = r.x + r.w / 2;
  if (id === 'forge') {
    // Anvil in front and a glowing hearth mouth.
    g.rect(cx - 22, r.y + r.h - 34, 44, 26).fill({ color: 0xffd36b, alpha: 0.18 + level * 0.12 });
    g.poly([
      cx + 40,
      r.y + r.h + 18,
      cx + 70,
      r.y + r.h + 18,
      cx + 64,
      r.y + r.h + 28,
      cx + 46,
      r.y + r.h + 28,
    ]).fill({ color, alpha: 0.6 });
    if (level >= 2) {
      g.rect(r.x + r.w - 34, r.y - 50, 18, 46).stroke({ color, width: 2.5, alpha: 0.9 });
      g.circle(r.x + r.w - 25, r.y - 60, 8).fill({ color: 0xffd36b, alpha: 0.5 });
    }
  } else if (id === 'map_table') {
    // A table with a glowing map spread on it.
    g.rect(cx - 30, r.y + 16, 60, 36).fill({ color: 0xe0fff4, alpha: 0.15 + level * 0.1 });
    g.moveTo(cx - 20, r.y + 40)
      .lineTo(cx - 4, r.y + 26)
      .lineTo(cx + 18, r.y + 34)
      .stroke({ color, width: 2, alpha: 0.9 });
    if (level >= 2) g.circle(cx + 18, r.y + 34, 5).fill({ color: 0xffd36b, alpha: 0.9 });
  } else if (id === 'archive') {
    // Shelves of glowing book spines.
    const shelves = level >= 2 ? 3 : 2;
    for (let s = 0; s < shelves; s++) {
      const y = r.y + 30 + s * 36;
      g.moveTo(r.x + 16, y + 22)
        .lineTo(r.x + r.w - 16, y + 22)
        .stroke({ color, width: 2, alpha: 0.8 });
      for (let b = 0; b < 7; b++) {
        g.rect(r.x + 22 + b * 16, y, 8, 20).fill({
          color: b % 3 === 0 ? 0xf2f0ff : color,
          alpha: 0.5,
        });
      }
    }
  }
}

/** Places that worked from the start show their upgrades as extra light and furniture. */
function drawUpgrades(
  g: Graphics,
  layout: HubLayoutDef,
  levels: Readonly<Record<string, number>>,
): void {
  const [, stall, tower] = layout.obstacles;
  const market = levels.market ?? 0;
  if (stall?.kind === 'rect' && market > 0) {
    // A string of lights over the stall, a second one when expanded.
    for (let row = 0; row < market; row++) {
      const y = stall.y - 40 - row * 16;
      for (let i = 0; i <= 6; i++) {
        const x = stall.x + (stall.w / 6) * i;
        g.circle(x, y + Math.sin(i) * 4, 3.5).fill({
          color: row === 0 ? 0xf0d6ff : 0xffd36b,
          alpha: 0.9,
        });
      }
    }
  }
  const runes = levels.rune_tower ?? 0;
  if (tower?.kind === 'rect' && runes > 0) {
    const cx = tower.x + tower.w / 2;
    g.circle(cx, tower.y - 24, 10 + runes * 4).stroke({ color: 0xb8a6ff, width: 2.5, alpha: 0.85 });
    if (runes >= 2) g.circle(cx, tower.y - 24, 6).fill({ color: 0xeee8ff, alpha: 0.9 });
  }
  const fire = levels.campfire ?? 0;
  const campfire = layout.stations.find((s) => s.id === 'campfire');
  if (campfire && fire > 0) {
    // Benches around the fire, lantern posts once expanded.
    for (const a of [0.6, 2.5, 4.4]) {
      const x = campfire.x + Math.cos(a) * 70;
      const y = campfire.y + Math.sin(a) * 52;
      g.rect(x - 16, y - 4, 32, 8).fill({ color: 0x8a5a30, alpha: 0.8 });
    }
    if (fire >= 2) {
      for (const dx of [-120, 120]) {
        g.moveTo(campfire.x + dx, campfire.y + 10)
          .lineTo(campfire.x + dx, campfire.y - 30)
          .stroke({ color: 0x8a5a30, width: 3 });
        g.circle(campfire.x + dx, campfire.y - 34, 6).fill({ color: 0xffd36b, alpha: 0.95 });
        g.circle(campfire.x + dx, campfire.y - 34, 14).fill({ color: 0xffb347, alpha: 0.15 });
      }
    }
  }
}

function drawPlant(g: Graphics, x: number, y: number, seed: number): void {
  const color = seed % 3 === 0 ? 0x7ff6c8 : 0x5fd38a;
  for (let i = -1; i <= 1; i++) {
    const tipX = x + i * 9 + (seed % 2) * 2;
    const tipY = y - 16 - Math.abs(i) * -4;
    g.moveTo(x, y)
      .quadraticCurveTo(x + i * 3, y - 8, tipX, tipY)
      .stroke({ color, width: 2, alpha: 0.8 });
  }
  if (seed % 2 === 0) g.circle(x, y - 18, 3).fill({ color: 0xffd36b, alpha: 0.9 });
}

function drawDecoration(g: Graphics, d: DecorationDef): void {
  const { x, y, color } = d;
  if (d.kind === 'lantern') {
    g.moveTo(x, y + 20)
      .lineTo(x, y - 20)
      .stroke({ color: 0x8a5a30, width: 3 });
    g.circle(x, y - 26, 7).fill({ color, alpha: 0.95 });
    g.circle(x, y - 26, 18).fill({ color, alpha: 0.15 });
  } else if (d.kind === 'flowers') {
    for (let i = 0; i < 5; i++) {
      const fx = x + (i - 2) * 12;
      const fy = y + (i % 2) * 6;
      g.moveTo(fx, fy + 10)
        .lineTo(fx, fy)
        .stroke({ color: 0x5fd38a, width: 2 });
      g.circle(fx, fy - 2, 4).fill({ color, alpha: 0.95 });
    }
  } else if (d.kind === 'banner') {
    g.moveTo(x, y + 24)
      .lineTo(x, y - 40)
      .stroke({ color: 0x8a5a30, width: 3 });
    g.poly([x, y - 40, x + 34, y - 34, x + 26, y - 22, x + 34, y - 10, x, y - 14])
      .fill({ color, alpha: 0.6 })
      .stroke({ color, width: 2 });
  } else {
    g.poly([x, y - 34, x + 12, y - 8, x, y + 6, x - 12, y - 8])
      .fill({ color, alpha: 0.4 })
      .stroke({ color, width: 2 });
    g.circle(x, y - 12, 20).fill({ color, alpha: 0.1 });
  }
}
