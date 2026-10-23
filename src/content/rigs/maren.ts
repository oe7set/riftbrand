import { defineRig } from '../schema';

/** Maren, die Hüterin (ROADMAP M5.1): an old keeper in a long robe, leaning on an ember staff. */
export const MAREN_RIG = defineRig({
  id: 'maren',
  colors: { body: 0xffb36b, accent: 0x8a5a30, core: 0xffe6b0 },
  strideUnits: 2,
  bobUnits: 0.04,
  leanDeg: 4,
  heightUnits: 1.45,
  centerUnits: 0.5,
  shadowUnits: 0.6,
  visualScale: 1.3,
  glowAlpha: 0.22,
  parts: [
    {
      id: 'robe',
      x: 0,
      y: 0.1,
      z: 2,
      rotationDeg: 4,
      shapes: [
        {
          kind: 'poly',
          points: [-0.4, 0.62, 0.38, 0.62, 0.22, -0.75, -0.24, -0.75],
          fill: 'accent',
          fillAlpha: 0.55,
          stroke: 'body',
          strokeWidth: 0.07,
        },
        { kind: 'line', points: [-0.3, 0.1, 0.28, 0.1], stroke: 'body', strokeWidth: 0.05 },
      ],
      motion: { breath: 0.025 },
    },
    {
      id: 'head',
      parent: 'robe',
      x: 0.04,
      y: -0.78,
      z: 3,
      shapes: [
        {
          kind: 'ellipse',
          x: 0.04,
          y: -0.22,
          rx: 0.22,
          ry: 0.24,
          fill: 'body',
          fillAlpha: 0.4,
          stroke: 'body',
          strokeWidth: 0.07,
        },
        // Grey hair tied back.
        {
          kind: 'poly',
          points: [-0.2, -0.38, 0.08, -0.48, -0.06, -0.3, -0.3, -0.12, -0.4, -0.2],
          fill: 'core',
          fillAlpha: 0.7,
        },
        { kind: 'ellipse', x: 0.14, y: -0.24, rx: 0.05, ry: 0.035, fill: 'core', glow: true },
      ],
      motion: { breath: 0.01 },
    },
    {
      id: 'staff',
      parent: 'robe',
      x: 0.3,
      y: -0.4,
      z: 4,
      rotationDeg: -6,
      shapes: [
        { kind: 'line', points: [0, -0.55, 0, 1.0], stroke: 'accent', strokeWidth: 0.07 },
        { kind: 'ellipse', x: 0, y: -0.62, rx: 0.12, ry: 0.14, fill: 'core', glow: true },
      ],
      motion: { breath: 0.04 },
    },
    {
      id: 'hand',
      parent: 'robe',
      x: 0.12,
      y: -0.55,
      z: 5,
      shapes: [
        { kind: 'line', points: [0, 0, 0.18, 0.18], stroke: 'body', strokeWidth: 0.09 },
        { kind: 'ellipse', x: 0.2, y: 0.2, rx: 0.07, ry: 0.07, fill: 'body' },
      ],
    },
  ],
});
