import { defineRig } from '../schema';

/**
 * Aschenpriester (ROADMAP M4.2): a hovering robe with glowing hands that rise while it heals
 * its allies.
 */
export const ASH_PRIEST_RIG = defineRig({
  id: 'ash_priest',
  colors: { body: 0x7dffb0, accent: 0x2f8a5c, core: 0xe0fff0 },
  strideUnits: 2.5,
  bobUnits: 0,
  hoverUnits: 0.14,
  leanDeg: 8,
  heightUnits: 1.55,
  centerUnits: 0.55,
  shadowUnits: 0.6,
  visualScale: 1.25,
  glowAlpha: 0.28,
  parts: [
    {
      id: 'robe',
      x: 0,
      y: -0.05,
      z: 2,
      shapes: [
        {
          kind: 'poly',
          points: [-0.5, 0.5, -0.2, 0.38, 0.05, 0.52, 0.45, 0.45, 0.22, -0.65, -0.22, -0.65],
          fill: 'body',
          fillAlpha: 0.32,
          stroke: 'body',
          strokeWidth: 0.07,
        },
        { kind: 'line', points: [0, -0.6, 0, 0.3], stroke: 'accent', strokeWidth: 0.06 },
        { kind: 'ellipse', x: 0.02, y: -0.3, rx: 0.08, ry: 0.08, fill: 'core', glow: true },
      ],
      motion: { breath: 0.03, windupDeg: -4, flutterDeg: 3 },
    },
    {
      id: 'hem',
      parent: 'robe',
      x: -0.05,
      y: 0.45,
      z: 1,
      shapes: [
        {
          kind: 'poly',
          points: [-0.45, 0, 0.4, 0, 0.15, 0.32, -0.05, 0.12, -0.25, 0.36],
          fill: 'accent',
          fillAlpha: 0.45,
          glow: true,
        },
      ],
      motion: { lagDeg: 18, flutterDeg: 10 },
    },
    {
      id: 'hand_back',
      parent: 'robe',
      x: -0.18,
      y: -0.5,
      z: 1,
      shapes: [
        { kind: 'line', points: [0, 0, 0.05, 0.4], stroke: 'accent', strokeWidth: 0.1 },
        { kind: 'ellipse', x: 0.05, y: 0.45, rx: 0.09, ry: 0.09, fill: 'core', glow: true },
      ],
      motion: { windupDeg: -150, castDeg: -120, flutterDeg: 4 },
    },
    {
      id: 'head',
      parent: 'robe',
      x: 0.02,
      y: -0.65,
      z: 3,
      shapes: [
        {
          kind: 'poly',
          points: [-0.25, 0.05, 0.22, 0.05, 0.12, -0.4, -0.05, -0.5, -0.28, -0.25],
          fill: 'body',
          fillAlpha: 0.45,
          stroke: 'body',
          strokeWidth: 0.07,
        },
        { kind: 'ellipse', x: 0.08, y: -0.18, rx: 0.07, ry: 0.05, fill: 'core', glow: true },
      ],
      motion: { windupDeg: -14, castDeg: -10 },
    },
    {
      id: 'hand_front',
      parent: 'robe',
      x: 0.16,
      y: -0.5,
      z: 4,
      shapes: [
        { kind: 'line', points: [0, 0, 0.05, 0.4], stroke: 'body', strokeWidth: 0.1 },
        { kind: 'ellipse', x: 0.05, y: 0.45, rx: 0.1, ry: 0.1, fill: 'core', glow: true },
      ],
      motion: { windupDeg: -160, castDeg: -130, flutterDeg: 4 },
    },
  ],
});
