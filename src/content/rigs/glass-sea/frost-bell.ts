import { defineRig } from '../../schema';

/** Raureifglocke (ROADMAP M6.1): a floating bell of rime; it swings back, then tolls. */
export const FROST_BELL_RIG = defineRig({
  id: 'frost_bell',
  colors: { body: 0x9fd8ee, accent: 0x3f6f88, core: 0xf2fbff },
  strideUnits: 1.4,
  hoverUnits: 0.1,
  heightUnits: 1.35,
  centerUnits: 0.6,
  shadowUnits: 0.7,
  visualScale: 1.2,
  glowAlpha: 0.25,
  parts: [
    {
      id: 'head',
      x: 0,
      y: -0.35,
      z: 2,
      shapes: [
        {
          kind: 'poly',
          points: [-0.55, 0, 0.55, 0, 0.4, -0.25, 0.3, -0.8, 0, -0.95, -0.3, -0.8, -0.4, -0.25],
          fill: 'body',
          fillAlpha: 0.8,
          stroke: 'accent',
          strokeWidth: 0.07,
        },
        {
          kind: 'line',
          points: [-0.5, -0.1, 0.5, -0.1],
          stroke: 'core',
          strokeWidth: 0.05,
          glow: true,
        },
        // Icicles along the rim.
        { kind: 'poly', points: [-0.4, 0, -0.32, 0.18, -0.25, 0], fill: 'core', fillAlpha: 0.8 },
        { kind: 'poly', points: [0.25, 0, 0.32, 0.22, 0.4, 0], fill: 'core', fillAlpha: 0.8 },
        { kind: 'ellipse', x: 0.12, y: -0.5, rx: 0.06, ry: 0.06, fill: 'core', glow: true },
      ],
      motion: { breath: 0.03, windupDeg: -18, strikeDeg: 14, flutterDeg: 3 },
    },
    {
      id: 'clapper',
      parent: 'head',
      x: 0,
      y: -0.15,
      z: 1,
      shapes: [
        { kind: 'line', points: [0, 0, 0, 0.3], stroke: 'accent', strokeWidth: 0.05 },
        { kind: 'ellipse', x: 0, y: 0.36, rx: 0.1, ry: 0.1, fill: 'core', glow: true },
      ],
      motion: { lagDeg: 20, windupDeg: 25, strikeDeg: -30 },
    },
  ],
});
