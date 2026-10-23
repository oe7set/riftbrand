import { defineRig } from '../schema';

/** Funke (ROADMAP M4.2): a hovering flame spirit with a crown of fire and wispy hands. */
export const TWIN_SPARK_RIG = defineRig({
  id: 'twin_spark',
  colors: { body: 0xffb347, accent: 0xc0601a, core: 0xfff3c0 },
  strideUnits: 2.5,
  bobUnits: 0,
  hoverUnits: 0.18,
  leanDeg: 10,
  heightUnits: 1.5,
  centerUnits: 0.6,
  shadowUnits: 0.6,
  visualScale: 1.2,
  glowAlpha: 0.38,
  parts: [
    {
      id: 'core',
      x: 0,
      y: -0.5,
      z: 2,
      shapes: [
        {
          kind: 'ellipse',
          x: 0,
          y: 0,
          rx: 0.42,
          ry: 0.45,
          fill: 'body',
          fillAlpha: 0.45,
          stroke: 'body',
          strokeWidth: 0.08,
          glow: true,
        },
        { kind: 'ellipse', x: 0.05, y: 0.02, rx: 0.2, ry: 0.22, fill: 'core', glow: true },
        { kind: 'ellipse', x: 0.22, y: -0.12, rx: 0.07, ry: 0.05, fill: 'core' },
      ],
      motion: { breath: 0.06, windupScale: 0.25, strikeScale: -0.1 },
    },
    {
      id: 'tail',
      parent: 'core',
      x: -0.05,
      y: 0.38,
      z: 1,
      shapes: [
        {
          kind: 'poly',
          points: [-0.3, 0, 0.3, 0, 0.05, 0.55, -0.05, 0.3, -0.18, 0.7],
          fill: 'accent',
          fillAlpha: 0.6,
          glow: true,
        },
      ],
      motion: { lagDeg: 30, flutterDeg: 14 },
    },
    {
      id: 'crown',
      parent: 'core',
      x: 0,
      y: -0.4,
      z: 3,
      shapes: [
        {
          kind: 'poly',
          points: [
            -0.3, 0.05, -0.25, -0.3, -0.1, -0.1, 0.0, -0.5, 0.12, -0.12, 0.28, -0.35, 0.3, 0.05,
          ],
          fill: 'core',
          fillAlpha: 0.65,
          stroke: 'body',
          strokeWidth: 0.04,
          glow: true,
        },
      ],
      motion: { flutterDeg: 10, lagDeg: -10, windupScale: 0.3, windupDeg: -6 },
    },
    {
      id: 'hand_back',
      parent: 'core',
      x: -0.3,
      y: 0,
      z: 0,
      shapes: [
        {
          kind: 'line',
          points: [0, 0, -0.1, 0.35],
          stroke: 'accent',
          strokeWidth: 0.1,
          glow: true,
        },
      ],
      motion: { flutterDeg: 12, windupDeg: -110, strikeDeg: -80 },
    },
    {
      id: 'hand_front',
      parent: 'core',
      x: 0.3,
      y: 0,
      z: 4,
      shapes: [
        { kind: 'line', points: [0, 0, 0.1, 0.35], stroke: 'body', strokeWidth: 0.1, glow: true },
      ],
      motion: { flutterDeg: 12, windupDeg: -120, strikeDeg: -95 },
    },
  ],
});
