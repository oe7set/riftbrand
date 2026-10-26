import { defineRig } from '../../schema';

/** Glimmerling (ROADMAP M6.1): a faceted glass beetle on four thin legs; crouches, then hops. */
export const GLASS_MITE_RIG = defineRig({
  id: 'glass_mite',
  colors: { body: 0xbfe9f2, accent: 0x5f8fa8, core: 0xffffff },
  strideUnits: 1.1,
  bobUnits: 0.05,
  leanDeg: 4,
  heightUnits: 0.8,
  centerUnits: 0.25,
  shadowUnits: 0.9,
  visualScale: 1.4,
  glowAlpha: 0.2,
  parts: [
    {
      id: 'body',
      x: 0,
      y: 0.12,
      z: 2,
      shapes: [
        {
          kind: 'poly',
          points: [-0.7, -0.3, -0.25, -0.72, 0.3, -0.62, 0.5, -0.3, 0.1, -0.08, -0.45, -0.1],
          fill: 'body',
          fillAlpha: 0.75,
          stroke: 'accent',
          strokeWidth: 0.07,
        },
        // Facet lines catch the light.
        {
          kind: 'line',
          points: [-0.25, -0.72, -0.1, -0.3, 0.3, -0.62],
          stroke: 'core',
          strokeWidth: 0.04,
          glow: true,
        },
        {
          kind: 'line',
          points: [-0.7, -0.3, -0.1, -0.3, 0.5, -0.3],
          stroke: 'accent',
          strokeWidth: 0.03,
        },
      ],
      motion: { windupY: 0.1, windupDeg: -8, strikeX: 0.2, strikeDeg: 6, breath: 0.03 },
    },
    {
      id: 'head',
      parent: 'body',
      x: 0.5,
      y: -0.32,
      z: 3,
      shapes: [
        {
          kind: 'ellipse',
          x: 0.12,
          y: 0,
          rx: 0.2,
          ry: 0.17,
          fill: 'body',
          stroke: 'accent',
          strokeWidth: 0.05,
        },
        { kind: 'ellipse', x: 0.2, y: -0.04, rx: 0.06, ry: 0.06, fill: 'core', glow: true },
      ],
      motion: { windupDeg: -10, strikeDeg: 8 },
    },
    ...[-0.4, -0.1, 0.15, 0.35].map((x, i) => ({
      id: `leg_${i}`,
      parent: 'body',
      x,
      y: -0.12,
      z: i % 2 === 0 ? 1 : 4,
      shapes: [
        {
          kind: 'line' as const,
          points: [0, 0, x * 0.4, -0.06, x * 0.5, 0.26],
          stroke: i % 2 === 0 ? ('accent' as const) : ('body' as const),
          strokeWidth: 0.07,
        },
      ],
      motion: { walkSwingDeg: 32, walkPhase: i % 2 === 0 ? 0 : 0.5, walkLift: 0.06 },
    })),
  ],
});
