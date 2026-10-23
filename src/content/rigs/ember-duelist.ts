import { defineRig } from '../schema';

/**
 * Glut-Duellant (ROADMAP M4.2): a fencer with plumed helm, cape, buckler and a long blade. The
 * lunge pulls the blade back, then thrusts; the parry stance raises buckler and blade.
 */
export const EMBER_DUELIST_RIG = defineRig({
  id: 'ember_duelist',
  colors: { body: 0xff8f4d, accent: 0xa0502a, core: 0xffe2c4 },
  strideUnits: 2.2,
  bobUnits: 0.05,
  leanDeg: 10,
  heightUnits: 1.45,
  centerUnits: 0.45,
  shadowUnits: 0.6,
  visualScale: 1.25,
  glowAlpha: 0.25,
  parts: [
    {
      id: 'torso',
      x: 0,
      y: 0.05,
      z: 3,
      shapes: [
        {
          kind: 'poly',
          points: [-0.22, 0, 0.22, 0, 0.28, -0.62, 0.12, -0.82, -0.2, -0.82, -0.28, -0.58],
          fill: 'body',
          fillAlpha: 0.4,
          stroke: 'body',
          strokeWidth: 0.08,
        },
        {
          kind: 'line',
          points: [-0.24, -0.4, 0.26, -0.5],
          stroke: 'core',
          strokeWidth: 0.05,
          glow: true,
        },
      ],
      motion: { breath: 0.03, windupDeg: -10, strikeDeg: 16, castDeg: -4 },
    },
    {
      id: 'cape',
      parent: 'torso',
      x: -0.15,
      y: -0.8,
      z: 0,
      shapes: [
        {
          kind: 'poly',
          points: [0, 0, 0.1, 0.1, -0.15, 1.0, -0.6, 0.9],
          fill: 'accent',
          fillAlpha: 0.5,
          stroke: 'body',
          strokeWidth: 0.04,
        },
      ],
      motion: { lagDeg: 30, flutterDeg: 7, windupDeg: 8, strikeDeg: -20 },
    },
    {
      id: 'leg_back',
      parent: 'torso',
      x: -0.08,
      y: 0,
      z: 1,
      shapes: [
        { kind: 'line', points: [0, 0, 0.03, 0.35, 0, 0.68], stroke: 'accent', strokeWidth: 0.13 },
      ],
      motion: { walkSwingDeg: 30, walkPhase: 0.5, walkLift: 0.08, windupDeg: 18, strikeDeg: 30 },
    },
    {
      id: 'leg_front',
      parent: 'torso',
      x: 0.06,
      y: 0,
      z: 4,
      shapes: [
        { kind: 'line', points: [0, 0, 0.03, 0.35, 0, 0.68], stroke: 'body', strokeWidth: 0.13 },
      ],
      motion: { walkSwingDeg: 30, walkPhase: 0, walkLift: 0.08, windupDeg: -10, strikeDeg: -35 },
    },
    {
      id: 'arm_back',
      parent: 'torso',
      x: -0.06,
      y: -0.72,
      z: 2,
      shapes: [
        { kind: 'line', points: [0, 0, 0, 0.45], stroke: 'accent', strokeWidth: 0.11 },
        // Buckler.
        {
          kind: 'ellipse',
          x: 0,
          y: 0.5,
          rx: 0.2,
          ry: 0.2,
          fill: 'accent',
          fillAlpha: 0.6,
          stroke: 'body',
          strokeWidth: 0.05,
        },
      ],
      motion: { walkSwingDeg: 18, walkPhase: 0, windupDeg: 30, castDeg: -100, castX: 0.15 },
    },
    {
      id: 'head',
      parent: 'torso',
      x: 0.02,
      y: -0.82,
      z: 5,
      shapes: [
        {
          kind: 'poly',
          points: [-0.2, 0, 0.24, 0, 0.26, -0.3, 0.05, -0.48, -0.22, -0.32],
          fill: 'body',
          fillAlpha: 0.45,
          stroke: 'body',
          strokeWidth: 0.07,
        },
        {
          kind: 'line',
          points: [0.08, -0.22, 0.26, -0.22],
          stroke: 'core',
          strokeWidth: 0.05,
          glow: true,
        },
        // Plume.
        {
          kind: 'poly',
          points: [0.0, -0.45, -0.2, -0.75, -0.55, -0.62, -0.18, -0.4],
          fill: 'core',
          fillAlpha: 0.55,
          glow: true,
        },
      ],
      motion: { windupDeg: -6, strikeDeg: 8, flutterDeg: 3 },
    },
    {
      id: 'arm_front',
      parent: 'torso',
      x: 0.06,
      y: -0.72,
      z: 6,
      rotationDeg: -55,
      shapes: [
        { kind: 'line', points: [0, 0, 0, 0.45], stroke: 'body', strokeWidth: 0.12 },
        { kind: 'ellipse', x: 0, y: 0.47, rx: 0.08, ry: 0.08, fill: 'body' },
      ],
      // Pulls back for the lunge, thrusts forward; raises the blade for the parry.
      motion: {
        walkSwingDeg: 10,
        windupDeg: 75,
        windupX: -0.15,
        strikeDeg: -40,
        strikeX: 0.3,
        castDeg: -85,
      },
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
          points: [-0.04, 0.02, 0.04, 0.02, 0.025, 1.25, 0, 1.4, -0.025, 1.25],
          fill: 'core',
          fillAlpha: 0.9,
          stroke: 'body',
          strokeWidth: 0.04,
          glow: true,
        },
        { kind: 'line', points: [-0.14, 0.04, 0.14, 0.04], stroke: 'accent', strokeWidth: 0.06 },
      ],
    },
  ],
});
