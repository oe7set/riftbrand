import { defineRig } from '../schema';

/**
 * Splitterkoloss (ROADMAP M4.2): heavy golem with crystal splinters on its shoulders. It
 * raises both arms for the ground slam and brings them down with the impact.
 */
export const BRUTE_RIG = defineRig({
  id: 'brute',
  colors: { body: 0xff3d6e, accent: 0x9a2443, core: 0xffb3c6 },
  strideUnits: 1.5,
  bobUnits: 0.05,
  leanDeg: 5,
  heightUnits: 1.25,
  centerUnits: 0.4,
  shadowUnits: 0.85,
  visualScale: 1.15,
  glowAlpha: 0.22,
  parts: [
    {
      id: 'torso',
      x: 0,
      y: 0.15,
      z: 3,
      shapes: [
        {
          kind: 'poly',
          points: [-0.45, 0, 0.42, 0, 0.55, -0.7, 0.3, -0.95, -0.35, -0.95, -0.58, -0.68],
          fill: 'body',
          fillAlpha: 0.38,
          stroke: 'body',
          strokeWidth: 0.08,
        },
        {
          kind: 'line',
          points: [-0.2, -0.8, 0.0, -0.55, -0.12, -0.3, 0.08, -0.1],
          stroke: 'core',
          strokeWidth: 0.06,
          glow: true,
        },
        {
          kind: 'line',
          points: [0.3, -0.7, 0.15, -0.45],
          stroke: 'core',
          strokeWidth: 0.05,
          glow: true,
        },
      ],
      motion: { breath: 0.03, windupDeg: -10, windupY: -0.05, strikeDeg: 14, strikeY: 0.08 },
    },
    {
      id: 'leg_back',
      parent: 'torso',
      x: -0.22,
      y: -0.02,
      z: 1,
      shapes: [{ kind: 'line', points: [0, 0, 0, 0.52], stroke: 'accent', strokeWidth: 0.24 }],
      motion: { walkSwingDeg: 20, walkPhase: 0.5, walkLift: 0.05, windupDeg: 6 },
    },
    {
      id: 'leg_front',
      parent: 'torso',
      x: 0.2,
      y: -0.02,
      z: 4,
      shapes: [{ kind: 'line', points: [0, 0, 0, 0.52], stroke: 'body', strokeWidth: 0.24 }],
      motion: { walkSwingDeg: 20, walkPhase: 0, walkLift: 0.05, windupDeg: -6 },
    },
    {
      id: 'arm_back',
      parent: 'torso',
      x: -0.3,
      y: -0.82,
      z: 2,
      shapes: [
        { kind: 'line', points: [0, 0, 0.02, 0.62], stroke: 'accent', strokeWidth: 0.2 },
        { kind: 'ellipse', x: 0.02, y: 0.7, rx: 0.17, ry: 0.15, fill: 'accent' },
        {
          kind: 'poly',
          points: [-0.2, 0.05, -0.12, -0.32, 0.0, -0.05, 0.12, -0.28, 0.15, 0.08],
          fill: 'core',
          fillAlpha: 0.6,
          glow: true,
        },
      ],
      motion: { walkSwingDeg: 14, walkPhase: 0, windupDeg: -165, strikeDeg: -35 },
    },
    {
      id: 'head',
      parent: 'torso',
      x: 0.12,
      y: -0.95,
      z: 5,
      shapes: [
        {
          kind: 'poly',
          points: [-0.18, 0, 0.22, 0, 0.26, -0.24, 0.0, -0.32, -0.2, -0.22],
          fill: 'body',
          fillAlpha: 0.45,
          stroke: 'body',
          strokeWidth: 0.07,
        },
        {
          kind: 'line',
          points: [0.06, -0.14, 0.2, -0.14],
          stroke: 'core',
          strokeWidth: 0.06,
          glow: true,
        },
      ],
      motion: { windupDeg: -10, strikeDeg: 12 },
    },
    {
      id: 'arm_front',
      parent: 'torso',
      x: 0.32,
      y: -0.82,
      z: 6,
      shapes: [
        { kind: 'line', points: [0, 0, 0.02, 0.62], stroke: 'body', strokeWidth: 0.22 },
        { kind: 'ellipse', x: 0.02, y: 0.72, rx: 0.19, ry: 0.17, fill: 'body', fillAlpha: 0.7 },
        {
          kind: 'poly',
          points: [-0.18, 0.06, -0.08, -0.36, 0.04, -0.06, 0.16, -0.3, 0.2, 0.08],
          fill: 'core',
          fillAlpha: 0.7,
          stroke: 'body',
          strokeWidth: 0.03,
          glow: true,
        },
      ],
      motion: { walkSwingDeg: 14, walkPhase: 0.5, windupDeg: -170, strikeDeg: -30 },
    },
  ],
});
