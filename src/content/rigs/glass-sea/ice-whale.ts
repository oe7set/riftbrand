import { defineRig } from '../../schema';

/**
 * Eiswal-Wächter (ROADMAP M6.1): a whale that swims through the ice, back ridged with frost; it
 * rears up before a breach and lunges forward for the ram.
 */
export const ICE_WHALE_RIG = defineRig({
  id: 'ice_whale',
  colors: { body: 0x7fb8e8, accent: 0x2f4f7a, core: 0xeaf8ff },
  strideUnits: 2.4,
  bobUnits: 0.04,
  hoverUnits: 0.04,
  leanDeg: 3,
  heightUnits: 1.1,
  centerUnits: 0.4,
  shadowUnits: 1.2,
  visualScale: 1.15,
  glowAlpha: 0.2,
  parts: [
    {
      id: 'body',
      x: 0,
      y: 0.1,
      z: 2,
      shapes: [
        {
          kind: 'ellipse',
          x: 0,
          y: -0.45,
          rx: 1.05,
          ry: 0.5,
          fill: 'body',
          fillAlpha: 0.85,
          stroke: 'accent',
          strokeWidth: 0.08,
        },
        // Pale belly with grooves.
        { kind: 'ellipse', x: 0.2, y: -0.22, rx: 0.7, ry: 0.2, fill: 'core', fillAlpha: 0.75 },
        { kind: 'line', points: [-0.25, -0.2, 0.6, -0.16], stroke: 'accent', strokeWidth: 0.03 },
        // Frost ridge.
        {
          kind: 'poly',
          points: [
            -0.55, -0.86, -0.4, -1.08, -0.25, -0.9, -0.1, -1.12, 0.05, -0.92, 0.2, -1.05, 0.3,
            -0.88,
          ],
          fill: 'core',
          fillAlpha: 0.85,
          stroke: 'accent',
          strokeWidth: 0.04,
        },
      ],
      motion: { breath: 0.04, windupDeg: -10, windupY: -0.12, strikeDeg: 8, strikeX: 0.35 },
    },
    {
      id: 'head',
      parent: 'body',
      x: 0.85,
      y: -0.45,
      z: 3,
      shapes: [
        {
          kind: 'ellipse',
          x: 0.05,
          y: 0,
          rx: 0.3,
          ry: 0.32,
          fill: 'body',
          stroke: 'accent',
          strokeWidth: 0.06,
        },
        { kind: 'ellipse', x: 0.12, y: -0.08, rx: 0.08, ry: 0.08, fill: 'core', glow: true },
      ],
      motion: { windupDeg: -12, strikeDeg: 10 },
    },
    {
      id: 'tail',
      parent: 'body',
      x: -1.0,
      y: -0.45,
      z: 1,
      shapes: [
        {
          kind: 'poly',
          points: [0, -0.08, -0.4, -0.45, -0.25, 0, -0.4, 0.4, 0, 0.08],
          fill: 'body',
          stroke: 'accent',
          strokeWidth: 0.06,
        },
      ],
      motion: { walkSwingDeg: 18, lagDeg: 18, flutterDeg: 6, windupDeg: 20, strikeDeg: -25 },
    },
    {
      id: 'fin',
      parent: 'body',
      x: 0.25,
      y: -0.25,
      z: 4,
      shapes: [
        {
          kind: 'poly',
          points: [0, 0, -0.35, 0.35, 0.1, 0.25],
          fill: 'accent',
          stroke: 'accent',
          strokeWidth: 0.04,
        },
      ],
      motion: { walkSwingDeg: 25, walkPhase: 0.25, windupDeg: -30 },
    },
  ],
});
