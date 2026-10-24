import { defineRig } from '../schema';

/** Toll, der Schmied (ROADMAP M5.3): broad and stocky, leather apron, a hammer over the shoulder. */
export const TOLL_RIG = defineRig({
  id: 'toll',
  colors: { body: 0xff9a5a, accent: 0x5a3a2a, core: 0xffd6a0 },
  strideUnits: 1.8,
  bobUnits: 0.04,
  leanDeg: 3,
  heightUnits: 1.35,
  centerUnits: 0.45,
  shadowUnits: 0.75,
  visualScale: 1.3,
  glowAlpha: 0.2,
  parts: [
    {
      id: 'torso',
      x: 0,
      y: 0.1,
      z: 2,
      shapes: [
        {
          kind: 'poly',
          points: [-0.5, 0.6, 0.5, 0.6, 0.42, -0.62, -0.42, -0.62],
          fill: 'accent',
          fillAlpha: 0.6,
          stroke: 'body',
          strokeWidth: 0.08,
        },
        // Apron with a glowing burn mark.
        {
          kind: 'poly',
          points: [-0.26, -0.2, 0.26, -0.2, 0.3, 0.55, -0.3, 0.55],
          fill: 'accent',
          fillAlpha: 0.9,
          stroke: 'body',
          strokeWidth: 0.04,
        },
        { kind: 'ellipse', x: 0.08, y: 0.2, rx: 0.06, ry: 0.05, fill: 'core', glow: true },
      ],
      motion: { breath: 0.03 },
    },
    {
      id: 'head',
      parent: 'torso',
      x: 0,
      y: -0.66,
      z: 3,
      shapes: [
        {
          kind: 'ellipse',
          x: 0.04,
          y: -0.18,
          rx: 0.22,
          ry: 0.2,
          fill: 'body',
          fillAlpha: 0.4,
          stroke: 'body',
          strokeWidth: 0.07,
        },
        // Heavy beard.
        {
          kind: 'poly',
          points: [-0.14, -0.08, 0.24, -0.08, 0.16, 0.16, -0.06, 0.16],
          fill: 'core',
          fillAlpha: 0.7,
        },
        { kind: 'ellipse', x: 0.14, y: -0.22, rx: 0.045, ry: 0.03, fill: 'core', glow: true },
      ],
      motion: { breath: 0.01 },
    },
    {
      id: 'hammer',
      parent: 'torso',
      x: 0.36,
      y: -0.5,
      z: 4,
      rotationDeg: -30,
      shapes: [
        { kind: 'line', points: [0, 0.3, 0, -0.55], stroke: 'accent', strokeWidth: 0.08 },
        {
          kind: 'poly',
          points: [-0.18, -0.55, 0.18, -0.55, 0.18, -0.8, -0.18, -0.8],
          fill: 'body',
          fillAlpha: 0.6,
          stroke: 'body',
          strokeWidth: 0.06,
          glow: true,
        },
      ],
      motion: { breath: 0.05 },
    },
  ],
});
