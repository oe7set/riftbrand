import { defineRig } from '../schema';

/**
 * Vesper (ROADMAP M4.1): slim figure with hood, cape and the glowing brand on the chest. The
 * blade arm follows the aim and the combo; the off hand rises for spells.
 */
export const VESPER_RIG = defineRig({
  id: 'vesper',
  colors: { body: 0x7ff6ff, accent: 0x3aa8c8, core: 0xffffff },
  strideUnits: 2.4,
  bobUnits: 0.06,
  leanDeg: 9,
  heightUnits: 1.4,
  centerUnits: 0.4,
  shadowUnits: 0.6,
  visualScale: 1.4,
  glowAlpha: 0.32,
  weapon: {
    part: 'arm_front',
    restDeg: -20,
    // Arc down, arc up, thrust (BRAND_BLADE combo).
    swings: [
      { windupDeg: -115, strikeDeg: 65 },
      { windupDeg: 75, strikeDeg: -85 },
      { windupDeg: -15, strikeDeg: 0, reach: 0.35 },
    ],
    specialTurns: 1,
  },
  parts: [
    {
      id: 'torso',
      x: 0,
      y: 0.05,
      z: 3,
      shapes: [
        {
          kind: 'poly',
          points: [-0.22, 0, 0.2, 0, 0.26, -0.6, 0.12, -0.8, -0.18, -0.8, -0.28, -0.55],
          fill: 'body',
          fillAlpha: 0.45,
          stroke: 'body',
          strokeWidth: 0.09,
        },
        { kind: 'line', points: [-0.22, -0.05, 0.2, -0.05], stroke: 'accent', strokeWidth: 0.07 },
        {
          kind: 'line',
          points: [0.03, -0.64, 0.12, -0.46, 0.0, -0.3],
          stroke: 'core',
          strokeWidth: 0.08,
          glow: true,
        },
      ],
      motion: { breath: 0.03, windupDeg: -8, strikeDeg: 10, castDeg: -5 },
    },
    {
      id: 'cape',
      parent: 'torso',
      x: -0.12,
      y: -0.78,
      z: 0,
      shapes: [
        {
          kind: 'poly',
          points: [0, 0, 0.1, 0.12, -0.12, 0.95, -0.52, 0.86],
          fill: 'accent',
          fillAlpha: 0.35,
          stroke: 'accent',
          strokeWidth: 0.06,
        },
      ],
      motion: { lagDeg: 35, flutterDeg: 6, windupDeg: 10, strikeDeg: -12 },
    },
    {
      id: 'leg_back',
      parent: 'torso',
      x: -0.08,
      y: 0,
      z: 1,
      shapes: [
        { kind: 'line', points: [0, 0, 0.03, 0.35, 0, 0.68], stroke: 'accent', strokeWidth: 0.13 },
        { kind: 'ellipse', x: 0.07, y: 0.69, rx: 0.11, ry: 0.05, fill: 'accent' },
      ],
      motion: { walkSwingDeg: 32, walkPhase: 0.5, walkLift: 0.08 },
    },
    {
      id: 'leg_front',
      parent: 'torso',
      x: 0.06,
      y: 0,
      z: 4,
      shapes: [
        { kind: 'line', points: [0, 0, 0.03, 0.35, 0, 0.68], stroke: 'body', strokeWidth: 0.13 },
        { kind: 'ellipse', x: 0.07, y: 0.69, rx: 0.11, ry: 0.05, fill: 'body' },
      ],
      motion: { walkSwingDeg: 32, walkPhase: 0, walkLift: 0.08 },
    },
    {
      id: 'arm_back',
      parent: 'torso',
      x: -0.06,
      y: -0.72,
      z: 2,
      shapes: [
        { kind: 'line', points: [0, 0, 0, 0.48], stroke: 'accent', strokeWidth: 0.11 },
        { kind: 'ellipse', x: 0, y: 0.5, rx: 0.08, ry: 0.08, fill: 'core', glow: true },
      ],
      motion: { walkSwingDeg: 24, walkPhase: 0, castDeg: -130, windupDeg: 20, strikeDeg: -25 },
    },
    {
      id: 'head',
      parent: 'torso',
      x: 0.02,
      y: -0.82,
      z: 5,
      shapes: [
        {
          kind: 'ellipse',
          x: 0.04,
          y: -0.27,
          rx: 0.25,
          ry: 0.28,
          fill: 'body',
          fillAlpha: 0.45,
          stroke: 'body',
          strokeWidth: 0.08,
        },
        // Hood falling back over the neck.
        {
          kind: 'poly',
          points: [-0.2, -0.45, 0.06, -0.58, -0.08, -0.38, -0.3, -0.05],
          fill: 'accent',
          fillAlpha: 0.6,
        },
        { kind: 'ellipse', x: 0.15, y: -0.28, rx: 0.1, ry: 0.06, fill: 'core', glow: true },
      ],
      motion: { windupDeg: -6, strikeDeg: 6, castDeg: -8 },
    },
    {
      id: 'arm_front',
      parent: 'torso',
      x: 0.06,
      y: -0.72,
      z: 6,
      shapes: [
        { kind: 'line', points: [0, 0, 0, 0.46], stroke: 'body', strokeWidth: 0.12 },
        { kind: 'ellipse', x: 0, y: 0.47, rx: 0.08, ry: 0.08, fill: 'body' },
      ],
    },
    {
      id: 'blade',
      parent: 'arm_front',
      x: 0,
      y: 0.47,
      z: 7,
      shapes: [
        {
          kind: 'poly',
          points: [-0.05, 0.02, 0.05, 0.02, 0.035, 0.95, 0, 1.12, -0.035, 0.95],
          fill: 'core',
          fillAlpha: 0.9,
          stroke: 'body',
          strokeWidth: 0.05,
          glow: true,
        },
        { kind: 'line', points: [-0.15, 0.03, 0.15, 0.03], stroke: 'accent', strokeWidth: 0.07 },
      ],
    },
  ],
});
