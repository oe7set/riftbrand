import { defineRig } from '../schema';

/**
 * Schlacke (ROADMAP M4.1): squat lava creature on four legs with glowing cracks. In the lunge
 * windup it crouches and ducks its head, then stretches forward.
 */
export const SLAG_RIG = defineRig({
  id: 'slag',
  colors: { body: 0xff6a3d, accent: 0xa8402a, core: 0xffd36b },
  strideUnits: 1.6,
  bobUnits: 0.05,
  leanDeg: 4,
  heightUnits: 0.9,
  centerUnits: 0.25,
  shadowUnits: 1.05,
  visualScale: 1.2,
  glowAlpha: 0.2,
  parts: [
    {
      id: 'body',
      x: 0,
      y: 0.2,
      z: 2,
      shapes: [
        {
          kind: 'ellipse',
          x: 0,
          y: -0.45,
          rx: 1,
          ry: 0.55,
          fill: 'body',
          fillAlpha: 0.4,
          stroke: 'body',
          strokeWidth: 0.1,
        },
        // Cooled crust plates on the back.
        {
          kind: 'poly',
          points: [-0.7, -0.75, -0.35, -0.98, 0.05, -1.0, 0.45, -0.88, 0.1, -0.8, -0.3, -0.78],
          fill: 'accent',
          fillAlpha: 0.7,
        },
        {
          kind: 'line',
          points: [-0.55, -0.68, -0.25, -0.42, -0.35, -0.15],
          stroke: 'core',
          strokeWidth: 0.07,
          glow: true,
        },
        {
          kind: 'line',
          points: [0.1, -0.8, 0.25, -0.5, 0.55, -0.42],
          stroke: 'core',
          strokeWidth: 0.07,
          glow: true,
        },
        {
          kind: 'line',
          points: [-0.05, -0.25, 0.3, -0.12],
          stroke: 'core',
          strokeWidth: 0.06,
          glow: true,
        },
      ],
      motion: {
        breath: 0.04,
        windupDeg: -5,
        windupY: 0.15,
        windupX: -0.1,
        strikeDeg: 5,
        strikeX: 0.3,
      },
    },
    {
      id: 'leg_back_far',
      parent: 'body',
      x: -0.5,
      y: -0.15,
      z: 0,
      shapes: [
        { kind: 'line', points: [0, 0, 0.06, 0.3, 0, 0.6], stroke: 'accent', strokeWidth: 0.17 },
      ],
      motion: { walkSwingDeg: 26, walkPhase: 0, walkLift: 0.06, windupDeg: 12 },
    },
    {
      id: 'leg_front_far',
      parent: 'body',
      x: 0.5,
      y: -0.15,
      z: 0,
      shapes: [
        { kind: 'line', points: [0, 0, 0.06, 0.3, 0, 0.6], stroke: 'accent', strokeWidth: 0.17 },
      ],
      motion: { walkSwingDeg: 26, walkPhase: 0.5, walkLift: 0.06, windupDeg: -14 },
    },
    {
      id: 'tail',
      parent: 'body',
      x: -0.95,
      y: -0.45,
      z: 1,
      shapes: [
        {
          kind: 'poly',
          points: [0, -0.1, 0, 0.1, -0.35, 0.12, -0.6, -0.05, -0.35, -0.08],
          fill: 'core',
          fillAlpha: 0.55,
          stroke: 'body',
          strokeWidth: 0.05,
          glow: true,
        },
      ],
      motion: { lagDeg: -22, flutterDeg: 12, windupDeg: -20, strikeDeg: 15 },
    },
    {
      id: 'leg_back_near',
      parent: 'body',
      x: -0.55,
      y: -0.1,
      z: 3,
      shapes: [
        { kind: 'line', points: [0, 0, 0.06, 0.3, 0, 0.6], stroke: 'body', strokeWidth: 0.18 },
      ],
      motion: { walkSwingDeg: 26, walkPhase: 0.5, walkLift: 0.06, windupDeg: 12 },
    },
    {
      id: 'leg_front_near',
      parent: 'body',
      x: 0.55,
      y: -0.1,
      z: 3,
      shapes: [
        { kind: 'line', points: [0, 0, 0.06, 0.3, 0, 0.6], stroke: 'body', strokeWidth: 0.18 },
      ],
      motion: { walkSwingDeg: 26, walkPhase: 0, walkLift: 0.06, windupDeg: -14 },
    },
    {
      id: 'head',
      parent: 'body',
      x: 0.85,
      y: -0.5,
      z: 4,
      shapes: [
        {
          kind: 'ellipse',
          x: 0.25,
          y: 0,
          rx: 0.38,
          ry: 0.3,
          fill: 'body',
          fillAlpha: 0.45,
          stroke: 'body',
          strokeWidth: 0.09,
        },
        { kind: 'line', points: [0.05, 0.16, 0.58, 0.12], stroke: 'core', strokeWidth: 0.06 },
        { kind: 'ellipse', x: 0.36, y: -0.09, rx: 0.08, ry: 0.06, fill: 'core', glow: true },
      ],
      // Ducks the head in the windup, snaps it up in the lunge.
      motion: { windupDeg: 30, windupY: 0.1, strikeDeg: -20, strikeX: 0.1 },
    },
  ],
});
