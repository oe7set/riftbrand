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

/** Ink for every outline in the refuge (picture-book look, ROADMAP M4.5). */
const INK = PALETTE.ink;

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
        fontFamily: '"Baloo 2", system-ui, sans-serif',
        fontSize: 13,
        fontWeight: '800' as const,
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

  /**
   * Static landmark art on top of the plain obstacle shapes (picture-book look, ROADMAP M4.5):
   * filled shapes with ink outlines; never redrawn per frame.
   */
  private drawDecor(layout: HubLayoutDef): void {
    const g = this.decor;
    const ink = { color: INK, width: 3.5, join: 'round' as const, cap: 'round' as const };
    const [tree, stall, tower, wallL, wallR] = layout.obstacles;
    if (tree?.kind === 'circle') {
      // Ember Tree: a round autumn crown of overlapping puffs above the trunk, ember fruit.
      const cx = tree.x;
      const cy = tree.y - tree.r * 1.4;
      const puffs: ReadonlyArray<readonly [number, number, number]> = [
        [-0.9, 0.25, 0.75],
        [0.9, 0.25, 0.75],
        [-0.45, -0.45, 0.85],
        [0.5, -0.4, 0.8],
        [0, 0.15, 1],
      ];
      for (const [dx, dy, k] of puffs) {
        g.circle(cx + dx * tree.r, cy + dy * tree.r, tree.r * k)
          .fill({ color: 0xd9704a })
          .stroke(ink);
      }
      for (const [dx, dy, k] of puffs) {
        g.circle(cx + dx * tree.r - 6, cy + dy * tree.r - 8, tree.r * k * 0.55).fill({
          color: 0xf09a5a,
          alpha: 0.7,
        });
      }
      for (let i = 0; i < 6; i++) {
        const a = i * 1.1;
        const fx = cx + Math.cos(a) * tree.r * 0.9;
        const fy = cy + Math.sin(a) * tree.r * 0.6;
        g.circle(fx, fy, 6).fill({ color: 0xffd36b }).stroke({ color: INK, width: 2.5 });
      }
    }
    if (stall?.kind === 'rect') {
      // Nix's stall: a striped red and cream awning and two lanterns.
      const stripes = 6;
      const top = stall.y - 30;
      for (let i = 0; i < stripes; i++) {
        const x = stall.x - 10 + ((stall.w + 20) / stripes) * i;
        g.rect(x, top, (stall.w + 20) / stripes, 30).fill({
          color: i % 2 === 0 ? 0xd94f4f : 0xfff1d6,
        });
      }
      g.rect(stall.x - 10, top, stall.w + 20, 30).stroke(ink);
      for (let i = 0; i < stripes; i++) {
        const x = stall.x - 10 + ((stall.w + 20) / stripes) * (i + 0.5);
        g.circle(x, top + 30, (stall.w + 20) / stripes / 2)
          .fill({ color: i % 2 === 0 ? 0xd94f4f : 0xfff1d6 })
          .stroke({ color: INK, width: 2.5 });
      }
      for (const lx of [stall.x + 12, stall.x + stall.w - 12]) {
        g.circle(lx, stall.y + 14, 9)
          .fill({ color: 0xffd36b })
          .stroke({ color: INK, width: 2.5 });
      }
    }
    if (tower?.kind === 'rect') {
      // Sel's rune tower: a pointed purple roof, a round window and runes.
      const cx = tower.x + tower.w / 2;
      g.poly([tower.x - 14, tower.y + 6, cx, tower.y - 70, tower.x + tower.w + 14, tower.y + 6])
        .fill({ color: 0x7a5ab8 })
        .stroke(ink);
      g.circle(cx, tower.y + 40, 14)
        .fill({ color: 0xfff1d6 })
        .stroke(ink);
      for (let i = 0; i < 2; i++) {
        const y = tower.y + 85 + i * 34;
        g.poly([cx, y - 10, cx + 8, y, cx, y + 10, cx - 8, y])
          .fill({ color: 0xb8a6ff })
          .stroke({
            color: INK,
            width: 2.5,
          });
      }
    }
    if (wallL?.kind === 'rect' && wallR?.kind === 'rect') {
      // Portal hall: a stone arch over the two pillars with a purple swirl between them.
      const x1 = wallL.x + wallL.w / 2;
      const x2 = wallR.x + wallR.w / 2;
      const y = wallL.y + 10;
      const mid = (x1 + x2) / 2;
      g.moveTo(x1, y)
        .quadraticCurveTo(mid, y - 110, x2, y)
        .stroke({ color: INK, width: 26, cap: 'round' });
      g.moveTo(x1, y)
        .quadraticCurveTo(mid, y - 110, x2, y)
        .stroke({ color: 0xa8a090, width: 18, cap: 'round' });
      g.ellipse(mid, y + 70, (x2 - x1) * 0.32, 80)
        .fill({ color: 0x9a6bff, alpha: 0.55 })
        .stroke(ink);
      g.ellipse(mid, y + 70, (x2 - x1) * 0.18, 46).fill({ color: 0xd8c4ff, alpha: 0.6 });
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

const INK_LINE = { color: INK, width: 3.5, join: 'round' as const, cap: 'round' as const };

/** A ruin is a broken wall with rubble; built sites get walls, a red roof and light. */
function drawSite(g: Graphics, id: string, level: number, r: Rect): void {
  const color = SITE_COLORS[id] ?? PALETTE.ember;
  if (level === 0) {
    const stone = 0xa8a090;
    g.moveTo(r.x, r.y + r.h)
      .lineTo(r.x, r.y + r.h * 0.35)
      .lineTo(r.x + r.w * 0.2, r.y + r.h * 0.2)
      .stroke({ color: INK, width: 9, cap: 'round', join: 'round' });
    g.moveTo(r.x, r.y + r.h)
      .lineTo(r.x, r.y + r.h * 0.35)
      .lineTo(r.x + r.w * 0.2, r.y + r.h * 0.2)
      .stroke({ color: stone, width: 5, cap: 'round', join: 'round' });
    g.moveTo(r.x + r.w, r.y + r.h)
      .lineTo(r.x + r.w, r.y + r.h * 0.55)
      .stroke({ color: INK, width: 9, cap: 'round' });
    g.moveTo(r.x + r.w, r.y + r.h)
      .lineTo(r.x + r.w, r.y + r.h * 0.55)
      .stroke({ color: stone, width: 5, cap: 'round' });
    for (let i = 0; i < 5; i++) {
      const x = r.x + r.w * (0.15 + i * 0.17);
      const y = r.y + r.h * (0.55 + (i % 2) * 0.25);
      g.poly([x - 9, y + 5, x - 3, y - 7, x + 9, y - 3, x + 7, y + 7])
        .fill({ color: stone })
        .stroke({
          color: INK,
          width: 2.5,
        });
    }
    return;
  }
  // Walls in warm cream, the site colour as trim, a red roof.
  g.roundRect(r.x, r.y, r.w, r.h, 10).fill({ color: 0xf2dfb8 }).stroke(INK_LINE);
  g.roundRect(r.x + 6, r.y + r.h - 16, r.w - 12, 10, 4).fill({ color });
  g.poly([r.x - 12, r.y + 8, r.x + r.w / 2, r.y - 34, r.x + r.w + 12, r.y + 8])
    .fill({ color: 0xc8503e })
    .stroke(INK_LINE);
  const cx = r.x + r.w / 2;
  if (id === 'forge') {
    // A glowing hearth mouth and an anvil in front.
    g.roundRect(cx - 24, r.y + r.h - 44, 48, 30, 12)
      .fill({ color: 0xffb347 })
      .stroke(INK_LINE);
    g.poly([
      cx + 44,
      r.y + r.h + 16,
      cx + 76,
      r.y + r.h + 16,
      cx + 70,
      r.y + r.h + 28,
      cx + 50,
      r.y + r.h + 28,
    ])
      .fill({ color: 0x6a6478 })
      .stroke(INK_LINE);
    if (level >= 2) {
      g.roundRect(r.x + r.w - 38, r.y - 54, 20, 48, 4)
        .fill({ color: 0xa8a090 })
        .stroke(INK_LINE);
      g.circle(r.x + r.w - 28, r.y - 66, 9).fill({ color: 0xe8e0d0, alpha: 0.85 });
    }
  } else if (id === 'map_table') {
    // A table with a map spread on it.
    g.roundRect(cx - 32, r.y + 14, 64, 38, 6)
      .fill({ color: 0xfff6e0 })
      .stroke(INK_LINE);
    g.moveTo(cx - 20, r.y + 40)
      .lineTo(cx - 4, r.y + 26)
      .lineTo(cx + 18, r.y + 34)
      .stroke({
        color: 0xd94f4f,
        width: 3,
        cap: 'round',
      });
    if (level >= 2)
      g.circle(cx + 18, r.y + 34, 6)
        .fill({ color: 0xffd36b })
        .stroke({ color: INK, width: 2 });
  } else if (id === 'archive') {
    // Shelves of colourful book spines.
    const shelves = level >= 2 ? 3 : 2;
    const spines = [0xd94f4f, 0x7a5ab8, 0x7fa05e, 0xffd36b];
    for (let sh = 0; sh < shelves; sh++) {
      const y = r.y + 28 + sh * 36;
      for (let b = 0; b < 7; b++) {
        g.rect(r.x + 20 + b * 16, y, 10, 22)
          .fill({ color: spines[b % spines.length] ?? color })
          .stroke({
            color: INK,
            width: 2,
          });
      }
      g.moveTo(r.x + 14, y + 23)
        .lineTo(r.x + r.w - 14, y + 23)
        .stroke({ color: INK, width: 3 });
    }
  }
}

/** Places that worked from the start show their upgrades as lights and furniture. */
function drawUpgrades(
  g: Graphics,
  layout: HubLayoutDef,
  levels: Readonly<Record<string, number>>,
): void {
  const [, stall, tower] = layout.obstacles;
  const market = levels.market ?? 0;
  if (stall?.kind === 'rect' && market > 0) {
    // Bunting over the stall, a second row when expanded.
    for (let row = 0; row < market; row++) {
      const y = stall.y - 52 - row * 18;
      g.moveTo(stall.x - 10, y)
        .quadraticCurveTo(stall.x + stall.w / 2, y + 14, stall.x + stall.w + 10, y)
        .stroke({ color: INK, width: 2 });
      for (let i = 0; i < 7; i++) {
        const x = stall.x + (stall.w / 6) * i;
        const yy = y + 4 + Math.sin((i / 6) * Math.PI) * 8;
        g.poly([x - 6, yy, x + 6, yy, x, yy + 12])
          .fill({ color: i % 2 ? 0xffd36b : 0x7fa05e })
          .stroke({
            color: INK,
            width: 1.5,
          });
      }
    }
  }
  const runes = levels.rune_tower ?? 0;
  if (tower?.kind === 'rect' && runes > 0) {
    const cx = tower.x + tower.w / 2;
    g.circle(cx, tower.y - 90, 12 + runes * 4)
      .fill({ color: 0xd8c4ff, alpha: 0.5 })
      .stroke({ color: INK, width: 3 });
    if (runes >= 2)
      g.star(cx, tower.y - 90, 5, 9, 4)
        .fill({ color: 0xffffff })
        .stroke({ color: INK, width: 2 });
  }
  const fire = levels.campfire ?? 0;
  const campfire = layout.stations.find((st) => st.id === 'campfire');
  if (campfire && fire > 0) {
    // Log benches around the fire, lantern posts once expanded.
    for (const a of [0.6, 2.5, 4.4]) {
      const x = campfire.x + Math.cos(a) * 72;
      const y = campfire.y + Math.sin(a) * 54;
      g.roundRect(x - 20, y - 6, 40, 12, 6)
        .fill({ color: 0x9a6a44 })
        .stroke({ color: INK, width: 3 });
    }
    if (fire >= 2) {
      for (const dx of [-120, 120]) {
        g.moveTo(campfire.x + dx, campfire.y + 10)
          .lineTo(campfire.x + dx, campfire.y - 30)
          .stroke({
            color: INK,
            width: 5,
          });
        g.circle(campfire.x + dx, campfire.y - 36, 8)
          .fill({ color: 0xffd36b })
          .stroke({ color: INK, width: 2.5 });
      }
    }
  }
}

function drawPlant(g: Graphics, x: number, y: number, seed: number): void {
  // Inked leaves; every second plant carries a flower.
  for (let i = -1; i <= 1; i++) {
    const tipX = x + i * 10;
    const tipY = y - 14 - (i === 0 ? 6 : 0);
    g.poly([
      x,
      y,
      (x + tipX) / 2 - 3,
      (y + tipY) / 2,
      tipX,
      tipY,
      (x + tipX) / 2 + 3,
      (y + tipY) / 2,
    ])
      .fill({ color: 0x7fa05e })
      .stroke({ color: INK, width: 2 });
  }
  if (seed % 2 === 0) {
    g.circle(x, y - 22, 5)
      .fill({ color: seed % 4 === 0 ? 0xd94f4f : 0xffd36b })
      .stroke({
        color: INK,
        width: 2,
      });
  }
}

function drawDecoration(g: Graphics, d: DecorationDef): void {
  const { x, y, color } = d;
  if (d.kind === 'lantern') {
    g.moveTo(x, y + 20)
      .lineTo(x, y - 20)
      .stroke({ color: INK, width: 5 });
    g.circle(x, y - 28, 9)
      .fill({ color })
      .stroke({ color: INK, width: 3 });
  } else if (d.kind === 'flowers') {
    for (let i = 0; i < 5; i++) {
      const fx = x + (i - 2) * 13;
      const fy = y + (i % 2) * 6;
      g.moveTo(fx, fy + 10)
        .lineTo(fx, fy)
        .stroke({ color: INK, width: 2.5 });
      g.circle(fx, fy - 3, 5)
        .fill({ color })
        .stroke({ color: INK, width: 2 });
    }
  } else if (d.kind === 'banner') {
    g.moveTo(x, y + 24)
      .lineTo(x, y - 40)
      .stroke({ color: INK, width: 5 });
    g.poly([x, y - 40, x + 34, y - 34, x + 26, y - 22, x + 34, y - 10, x, y - 14])
      .fill({ color: 0xd94f4f })
      .stroke({ color: INK, width: 3, join: 'round' });
  } else {
    g.poly([x, y - 34, x + 12, y - 8, x, y + 6, x - 12, y - 8])
      .fill({ color })
      .stroke({
        color: INK,
        width: 3,
        join: 'round',
      });
  }
}
