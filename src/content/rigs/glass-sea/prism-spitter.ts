import { defineRig } from '../../schema';

/**
 * Prismenspucker (ROADMAP M6.1): a snail with a prism for a shell. Before it fires, the prism
 * swells and its light lines glow.
 */
export const PRISM_SPITTER_RIG = defineRig({
  id: 'prism_spitter',
  colors: { body: 0xd8a8ff, accent: 0x7a5aa8, core: 0xfff6c8 },
  strideUnits: 1.2,
  bobUnits: 0.02,
  leanDeg: 2,
  heightUnits: 1.3,
  centerUnits: 0.45,
  shadowUnits: 0.95,
  visualScale: 1.25,
  glowAlpha: 0.25,
  parts: [
    {
      id: 'foot',
      x: 0,
      y: 0.1,
      z: 1,
      shapes: [
        {
          kind: 'ellipse',
          x: 0,
          y: -0.15,
          rx: 0.85,
          ry: 0.22,
          fill: 'accent',
          stroke: 'accent',
          strokeWidth: 0.05,
        },
      ],
      motion: { breath: 0.03 },
    },
    {
      id: 'shell',
      parent: 'foot',
      x: -0.2,
      y: -0.3,
      z: 2,
      shapes: [
        {
          kind: 'poly',
          points: [-0.55, 0, 0.45, 0, 0, -0.95],
          fill: 'body',
          fillAlpha: 0.7,
          stroke: 'accent',
          strokeWidth: 0.07,
        },
        {
          kind: 'line',
          points: [0, -0.95, -0.1, 0],
          stroke: 'core',
          strokeWidth: 0.04,
          glow: true,
        },
        {
          kind: 'line',
          points: [-0.28, -0.48, 0.24, -0.48],
          stroke: 'core',
          strokeWidth: 0.04,
          glow: true,
        },
      ],
      motion: { windupScale: 0.18, windupDeg: -6, strikeDeg: 4 },
    },
    {
      id: 'head',
      parent: 'foot',
      x: 0.6,
      y: -0.3,
      z: 3,
      shapes: [
        { kind: 'line', points: [0, 0, 0.12, -0.35], stroke: 'accent', strokeWidth: 0.09 },
        {
          kind: 'ellipse',
          x: 0.14,
          y: -0.42,
          rx: 0.17,
          ry: 0.15,
          fill: 'accent',
          stroke: 'accent',
          strokeWidth: 0.04,
        },
        { kind: 'ellipse', x: 0.18, y: -0.44, rx: 0.06, ry: 0.06, fill: 'core', glow: true },
      ],
      motion: { windupDeg: -12, strikeDeg: 10, flutterDeg: 2 },
    },
  ],
});
