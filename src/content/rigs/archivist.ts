import { defineRig } from '../schema';

/** Der Archivar (ROADMAP M5.3): a tall, faceless hooded figure that floats above an open book. */
export const ARCHIVIST_RIG = defineRig({
  id: 'archivist',
  colors: { body: 0x9fa8ff, accent: 0x262850, core: 0xf2f0ff },
  strideUnits: 2,
  bobUnits: 0,
  hoverUnits: 0.12,
  leanDeg: 0,
  heightUnits: 1.6,
  centerUnits: 0.55,
  shadowUnits: 0.5,
  visualScale: 1.3,
  glowAlpha: 0.28,
  parts: [
    {
      id: 'robe',
      x: 0,
      y: 0.05,
      z: 2,
      shapes: [
        {
          kind: 'poly',
          points: [-0.36, 0.6, -0.12, 0.45, 0.12, 0.62, 0.36, 0.48, 0.22, -0.8, -0.22, -0.8],
          fill: 'accent',
          fillAlpha: 0.75,
          stroke: 'body',
          strokeWidth: 0.07,
        },
      ],
      motion: { breath: 0.03 },
    },
    {
      id: 'hood',
      parent: 'robe',
      x: 0,
      y: -0.82,
      z: 3,
      shapes: [
        {
          kind: 'poly',
          points: [-0.26, 0.05, 0, -0.5, 0.26, 0.05, 0.16, 0.12, -0.16, 0.12],
          fill: 'accent',
          fillAlpha: 0.95,
          stroke: 'body',
          strokeWidth: 0.07,
        },
        // No face, only darkness and a faint glimmer.
        { kind: 'ellipse', x: 0.02, y: -0.08, rx: 0.1, ry: 0.12, fill: 'accent', fillAlpha: 1 },
        { kind: 'ellipse', x: 0.04, y: -0.1, rx: 0.03, ry: 0.03, fill: 'core', glow: true },
      ],
      motion: { breath: 0.01 },
    },
    {
      id: 'book',
      parent: 'robe',
      x: 0.28,
      y: -0.25,
      z: 4,
      shapes: [
        {
          kind: 'poly',
          points: [-0.2, 0, 0, -0.06, 0.2, 0, 0.2, 0.08, 0, 0.02, -0.2, 0.08],
          fill: 'core',
          fillAlpha: 0.8,
          stroke: 'body',
          strokeWidth: 0.04,
          glow: true,
        },
      ],
      motion: { breath: 0.06 },
    },
  ],
});
