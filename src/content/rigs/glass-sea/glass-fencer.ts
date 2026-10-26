import { defineRig } from '../../schema';

/**
 * Spiegelfechterin (ROADMAP M6.1): a slender fencer in a glass gown with a mirror buckler and a
 * long rapier; the parry raises the mirror.
 */
export const GLASS_FENCER_RIG = defineRig({
  id: 'glass_fencer',
  colors: { body: 0xd8c4ff, accent: 0x6a5a9a, core: 0xfaf4ff },
  strideUnits: 2.3,
  bobUnits: 0.04,
  leanDeg: 10,
  heightUnits: 1.55,
  centerUnits: 0.5,
  shadowUnits: 0.6,
  visualScale: 1.3,
  glowAlpha: 0.3,
  parts: [
    {
      id: 'torso',
      x: 0,
      y: 0.05,
      z: 3,
      shapes: [
        // Bell of the gown, then the bodice.
        {
          kind: 'poly',
          points: [-0.42, 0, 0.42, 0, 0.16, -0.5, -0.16, -0.5],
          fill: 'body',
          fillAlpha: 0.75,
          stroke: 'accent',
          strokeWidth: 0.07,
        },
        {
          kind: 'poly',
          points: [-0.17, -0.5, 0.17, -0.5, 0.15, -0.85, -0.15, -0.85],
          fill: 'body',
          stroke: 'accent',
          strokeWidth: 0.06,
        },
        {
          kind: 'line',
          points: [-0.35, -0.12, 0.35, -0.12],
          stroke: 'core',
          strokeWidth: 0.04,
          glow: true,
        },
      ],
      motion: { breath: 0.03, windupDeg: -10, strikeDeg: 16, castDeg: -4, flutterDeg: 2 },
    },
    {
      id: 'arm_back',
      parent: 'torso',
      x: -0.08,
      y: -0.75,
      z: 2,
      shapes: [
        { kind: 'line', points: [0, 0, 0, 0.4], stroke: 'accent', strokeWidth: 0.09 },
        // Mirror buckler.
        {
          kind: 'ellipse',
          x: 0,
          y: 0.48,
          rx: 0.22,
          ry: 0.22,
          fill: 'core',
          fillAlpha: 0.85,
          stroke: 'accent',
          strokeWidth: 0.05,
          glow: true,
        },
      ],
      motion: { walkSwingDeg: 16, windupDeg: 30, castDeg: -100, castX: 0.15 },
    },
    {
      id: 'head',
      parent: 'torso',
      x: 0.02,
      y: -0.85,
      z: 5,
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
        // Glass hair sweeping back.
        {
          kind: 'poly',
          points: [-0.18, -0.35, 0.15, -0.42, -0.1, -0.5, -0.5, -0.2, -0.35, -0.1],
          fill: 'body',
          fillAlpha: 0.85,
          stroke: 'accent',
          strokeWidth: 0.04,
        },
        { kind: 'ellipse', x: 0.1, y: -0.2, rx: 0.06, ry: 0.06, fill: 'accent', glow: true },
      ],
      motion: { windupDeg: -6, strikeDeg: 8, flutterDeg: 3 },
    },
    {
      id: 'arm_front',
      parent: 'torso',
      x: 0.06,
      y: -0.75,
      z: 6,
      rotationDeg: -60,
      shapes: [
        { kind: 'line', points: [0, 0, 0, 0.42], stroke: 'body', strokeWidth: 0.1 },
        { kind: 'line', points: [0, 0.42, 0, 1.45], stroke: 'core', strokeWidth: 0.05, glow: true },
        { kind: 'line', points: [-0.1, 0.45, 0.1, 0.45], stroke: 'accent', strokeWidth: 0.06 },
      ],
      motion: {
        walkSwingDeg: 10,
        windupDeg: -45,
        windupX: -0.15,
        strikeDeg: 25,
        strikeX: 0.4,
        castDeg: -40,
      },
    },
  ],
});
