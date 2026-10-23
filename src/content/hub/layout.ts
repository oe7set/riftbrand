import { defineHub } from '../schema';

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
  ],
  stations: [
    { id: 'campfire', x: 700, y: 650, radiusPx: 110 },
    { id: 'maren', x: 470, y: 580, radiusPx: 95, npc: { rig: 'maren', speaker: 'maren' } },
    { id: 'nix', x: 990, y: 620, radiusPx: 95, npc: { rig: 'nix', speaker: 'nix' } },
    { id: 'sel', x: 1165, y: 430, radiusPx: 95, npc: { rig: 'sel', speaker: 'sel' } },
    { id: 'portal', x: 700, y: 210, radiusPx: 120 },
  ],
});
