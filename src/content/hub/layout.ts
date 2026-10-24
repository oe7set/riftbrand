import { defineHub } from '../schema';

/** Building sites with their own footprint, in obstacle order from SITE_OBSTACLE_START. */
export const SITE_BUILDINGS = ['forge', 'map_table', 'archive'] as const;
export const SITE_OBSTACLE_START = 6;

/**
 * The refuge as a walkable place (ROADMAP M5.1): the campfire in the middle, the Ember Tree with
 * Maren to the west, Nix's stall to the east, Sel's rune tower in the north-east and the portal
 * hall up north.
 */
export const REFUGE = defineHub({
  widthPx: 1400,
  heightPx: 1150,
  playerStart: { x: 760, y: 760 },
  portal: { x: 700, y: 190 },
  portalArrival: { x: 700, y: 310 },
  // Order matters: the refuge view draws its landmarks (tree, stall, tower, portal arch) onto
  // the first five obstacles.
  obstacles: [
    // Ember Tree trunk.
    { kind: 'circle', x: 360, y: 470, r: 60 },
    // Nix's stall.
    { kind: 'rect', x: 900, y: 470, w: 190, h: 70 },
    // Sel's rune tower.
    { kind: 'rect', x: 1100, y: 190, w: 130, h: 160 },
    // Portal hall walls.
    { kind: 'rect', x: 520, y: 110, w: 70, h: 170 },
    { kind: 'rect', x: 810, y: 110, w: 70, h: 170 },
    // Campfire stones.
    { kind: 'circle', x: 700, y: 650, r: 30 },
    // Building sites (ROADMAP M5.3), in SITE_BUILDINGS order: forge, map table, archive.
    { kind: 'rect', x: 1040, y: 820, w: 170, h: 90 },
    { kind: 'rect', x: 300, y: 840, w: 120, h: 70 },
    { kind: 'rect', x: 170, y: 160, w: 150, h: 150 },
  ],
  stations: [
    { id: 'campfire', x: 700, y: 650, radiusPx: 110, building: 'campfire' },
    { id: 'maren', x: 470, y: 580, radiusPx: 95, npc: { rig: 'maren', speaker: 'maren' } },
    {
      id: 'nix',
      x: 990,
      y: 620,
      radiusPx: 95,
      npc: { rig: 'nix', speaker: 'nix' },
      building: 'market',
    },
    {
      id: 'sel',
      x: 1165,
      y: 430,
      radiusPx: 95,
      npc: { rig: 'sel', speaker: 'sel' },
      building: 'rune_tower',
    },
    {
      id: 'forge',
      x: 1125,
      y: 965,
      radiusPx: 95,
      npc: { rig: 'toll', speaker: 'toll' },
      building: 'forge',
    },
    {
      id: 'map_table',
      x: 360,
      y: 965,
      radiusPx: 95,
      npc: { rig: 'iskra', speaker: 'iskra' },
      building: 'map_table',
    },
    {
      id: 'archive',
      x: 245,
      y: 375,
      radiusPx: 90,
      npc: { rig: 'archivist', speaker: 'archivist' },
      building: 'archive',
    },
    { id: 'portal', x: 700, y: 210, radiusPx: 120 },
  ],
});
