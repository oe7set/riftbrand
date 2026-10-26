import { defineRig } from '../../schema';

/** Gezeitenpriesterin (ROADMAP M6.1): a hooded singer in a robe of frozen foam, with a staff. */
export const TIDE_PRIEST_RIG = defineRig({
  id: 'tide_priest',
  colors: { body: 0x7fe0d0, accent: 0x2f7a78, core: 0xeafff9 },
  strideUnits: 1.6,
  hoverUnits: 0.06,
  heightUnits: 1.5,
  centerUnits: 0.55,
  shadowUnits: 0.6,
  visualScale: 1.25,
  glowAlpha: 0.25,
  parts: [
    {
      id: 'robe',
      x: 0,
      y: 0.05,
      z: 2,
      shapes: [
        {
          kind: 'poly',
          points: [-0.4, 0, 0.4, 0, 0.2, -0.85, -0.2, -0.85],
          fill: 'body',
          fillAlpha: 0.8,
          stroke: 'accent',
          strokeWidth: 0.07,
        },
        {
          kind: 'line',
          points: [-0.35, -0.12, -0.1, -0.05, 0.12, -0.14, 0.35, -0.06],
          stroke: 'core',
          strokeWidth: 0.05,
        },
      ],
      motion: { breath: 0.03, flutterDeg: 2, castY: -0.05 },
    },
    {
      id: 'head',
      parent: 'robe',
      x: 0.02,
      y: -0.85,
      z: 3,
      shapes: [
        {
          kind: 'poly',
          points: [-0.24, 0, 0.24, 0, 0.2, -0.32, 0, -0.45, -0.22, -0.3],
          fill: 'accent',
          stroke: 'accent',
          strokeWidth: 0.05,
        },
        { kind: 'ellipse', x: 0.06, y: -0.15, rx: 0.15, ry: 0.13, fill: 'core', fillAlpha: 0.9 },
        { kind: 'ellipse', x: 0.1, y: -0.17, rx: 0.06, ry: 0.06, fill: 'core', glow: true },
      ],
      motion: { castDeg: -12, flutterDeg: 2 },
    },
    {
      id: 'staff',
      parent: 'robe',
      x: 0.28,
      y: -0.6,
      z: 4,
      shapes: [
        { kind: 'line', points: [0, -0.5, 0, 0.6], stroke: 'accent', strokeWidth: 0.07 },
        { kind: 'ellipse', x: 0, y: -0.6, rx: 0.13, ry: 0.13, fill: 'core', glow: true },
      ],
      motion: { walkSwingDeg: 6, castDeg: -25, castY: -0.2 },
    },
  ],
});
