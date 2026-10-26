import { defineRig } from '../../schema';

/**
 * Die Spiegelkönigin (ROADMAP M6.1, docs/STORY.md Akt 2): tall, crowned with glass, a long
 * frozen train behind her and a hand mirror that holds the moment before the fire.
 */
export const MIRROR_QUEEN_RIG = defineRig({
  id: 'mirror_queen',
  colors: { body: 0xc8b4ff, accent: 0x4a3a7a, core: 0xfbf8ff },
  strideUnits: 2.0,
  hoverUnits: 0.05,
  leanDeg: 4,
  heightUnits: 1.75,
  centerUnits: 0.6,
  shadowUnits: 0.85,
  visualScale: 1.35,
  glowAlpha: 0.35,
  parts: [
    {
      id: 'train',
      x: -0.1,
      y: 0,
      z: 0,
      shapes: [
        {
          kind: 'poly',
          points: [0, -0.7, 0.2, 0, -0.9, 0.1, -1.05, -0.15],
          fill: 'body',
          fillAlpha: 0.55,
          stroke: 'accent',
          strokeWidth: 0.05,
        },
        {
          kind: 'line',
          points: [-0.2, -0.4, -0.85, -0.02],
          stroke: 'core',
          strokeWidth: 0.03,
          glow: true,
        },
      ],
      motion: { lagDeg: 15, flutterDeg: 4 },
    },
    {
      id: 'gown',
      x: 0,
      y: 0.05,
      z: 2,
      shapes: [
        {
          kind: 'poly',
          points: [-0.5, 0, 0.5, 0, 0.2, -0.65, -0.2, -0.65],
          fill: 'body',
          fillAlpha: 0.85,
          stroke: 'accent',
          strokeWidth: 0.07,
        },
        {
          kind: 'poly',
          points: [-0.2, -0.65, 0.2, -0.65, 0.17, -1.05, -0.17, -1.05],
          fill: 'body',
          stroke: 'accent',
          strokeWidth: 0.06,
        },
        {
          kind: 'line',
          points: [-0.45, -0.1, 0.45, -0.1],
          stroke: 'core',
          strokeWidth: 0.05,
          glow: true,
        },
        {
          kind: 'line',
          points: [0, -0.65, 0, -0.05],
          stroke: 'core',
          strokeWidth: 0.04,
          glow: true,
        },
      ],
      motion: { breath: 0.03, windupDeg: -6, strikeDeg: 8, castY: -0.06, flutterDeg: 2 },
    },
    {
      id: 'head',
      parent: 'gown',
      x: 0.02,
      y: -1.05,
      z: 4,
      shapes: [
        {
          kind: 'ellipse',
          x: 0.02,
          y: -0.2,
          rx: 0.2,
          ry: 0.22,
          fill: 'core',
          stroke: 'accent',
          strokeWidth: 0.05,
        },
        // Glass crown.
        {
          kind: 'poly',
          points: [
            -0.2, -0.36, -0.22, -0.62, -0.1, -0.46, 0, -0.72, 0.1, -0.46, 0.22, -0.62, 0.2, -0.36,
          ],
          fill: 'core',
          fillAlpha: 0.9,
          stroke: 'accent',
          strokeWidth: 0.04,
          glow: true,
        },
        { kind: 'ellipse', x: 0.1, y: -0.2, rx: 0.06, ry: 0.06, fill: 'accent', glow: true },
      ],
      motion: { windupDeg: -6, strikeDeg: 6, castDeg: -10 },
    },
    {
      id: 'arm_mirror',
      parent: 'gown',
      x: 0.08,
      y: -0.95,
      z: 5,
      rotationDeg: -35,
      shapes: [
        { kind: 'line', points: [0, 0, 0, 0.45], stroke: 'body', strokeWidth: 0.09 },
        { kind: 'line', points: [0, 0.45, 0, 0.62], stroke: 'accent', strokeWidth: 0.05 },
        {
          kind: 'ellipse',
          x: 0,
          y: 0.82,
          rx: 0.2,
          ry: 0.24,
          fill: 'core',
          fillAlpha: 0.9,
          stroke: 'accent',
          strokeWidth: 0.05,
          glow: true,
        },
      ],
      motion: { walkSwingDeg: 8, windupDeg: -50, strikeDeg: 30, castDeg: -110, castY: -0.1 },
    },
  ],
});
