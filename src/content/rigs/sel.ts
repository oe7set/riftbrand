import { defineRig } from '../schema';

/** Sel, die Runenweberin (ROADMAP M5.1): calm, tall, with runes hovering above open hands. */
export const SEL_RIG = defineRig({
  id: 'sel',
  colors: { body: 0xb8a6ff, accent: 0x4a3c8a, core: 0xeee8ff },
  strideUnits: 2.3,
  bobUnits: 0.03,
  hoverUnits: 0.04,
  leanDeg: 3,
  heightUnits: 1.55,
  centerUnits: 0.55,
  shadowUnits: 0.55,
  visualScale: 1.3,
  glowAlpha: 0.26,
  parts: [
    {
      id: 'gown',
      x: 0,
      y: 0.1,
      z: 2,
      shapes: [
        {
          kind: 'poly',
          points: [-0.32, 0.62, 0.32, 0.62, 0.18, -0.8, -0.18, -0.8],
          fill: 'accent',
          fillAlpha: 0.55,
          stroke: 'body',
          strokeWidth: 0.06,
        },
        {
          kind: 'line',
          points: [-0.12, -0.3, 0.0, -0.1, 0.12, -0.3],
          stroke: 'core',
          strokeWidth: 0.04,
          glow: true,
        },
      ],
      motion: { breath: 0.02 },
    },
    {
      id: 'hair',
      parent: 'gown',
      x: -0.05,
      y: -0.8,
      z: 1,
      shapes: [
        {
          kind: 'poly',
          points: [0.05, -0.4, -0.3, -0.3, -0.42, 0.3, -0.2, 0.45, -0.1, -0.1],
          fill: 'body',
          fillAlpha: 0.45,
        },
      ],
      motion: { flutterDeg: 3, breath: 0.02 },
    },
    {
      id: 'head',
      parent: 'gown',
      x: 0.02,
      y: -0.82,
      z: 3,
      shapes: [
        {
          kind: 'ellipse',
          x: 0.03,
          y: -0.22,
          rx: 0.2,
          ry: 0.23,
          fill: 'body',
          fillAlpha: 0.45,
          stroke: 'body',
          strokeWidth: 0.06,
        },
        { kind: 'ellipse', x: 0.12, y: -0.24, rx: 0.05, ry: 0.035, fill: 'core', glow: true },
      ],
    },
    {
      id: 'arms',
      parent: 'gown',
      x: 0.05,
      y: -0.55,
      z: 4,
      shapes: [
        { kind: 'line', points: [0, 0, 0.3, 0.12], stroke: 'body', strokeWidth: 0.08 },
        { kind: 'line', points: [-0.05, 0.02, 0.2, 0.2], stroke: 'accent', strokeWidth: 0.08 },
      ],
    },
    {
      id: 'runes',
      parent: 'arms',
      x: 0.32,
      y: -0.15,
      z: 5,
      shapes: [
        {
          kind: 'poly',
          points: [0, -0.14, 0.1, 0, 0, 0.14, -0.1, 0],
          stroke: 'core',
          strokeWidth: 0.04,
          glow: true,
        },
        { kind: 'ellipse', x: 0.18, y: -0.2, rx: 0.04, ry: 0.04, fill: 'core', glow: true },
        { kind: 'ellipse', x: -0.12, y: -0.24, rx: 0.03, ry: 0.03, fill: 'core', glow: true },
      ],
      motion: { breath: 0.15, flutterDeg: 12 },
    },
  ],
});
