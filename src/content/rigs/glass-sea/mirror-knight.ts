import { defineRig } from '../../schema';

/** Spiegelritter (ROADMAP M6.1): hollow armour with a mirror for a face and a glass lance. */
export const MIRROR_KNIGHT_RIG = defineRig({
  id: 'mirror_knight',
  colors: { body: 0xc4d6ff, accent: 0x5a6a9a, core: 0xeef6ff },
  strideUnits: 2.0,
  bobUnits: 0.05,
  leanDeg: 8,
  heightUnits: 1.5,
  centerUnits: 0.5,
  shadowUnits: 0.6,
  visualScale: 1.3,
  glowAlpha: 0.2,
  parts: [
    {
      id: 'torso',
      x: 0,
      y: 0.05,
      z: 3,
      shapes: [
        {
          kind: 'poly',
          points: [-0.26, 0, 0.26, 0, 0.3, -0.6, 0.15, -0.82, -0.2, -0.82, -0.3, -0.58],
          fill: 'body',
          fillAlpha: 0.75,
          stroke: 'accent',
          strokeWidth: 0.07,
        },
        { kind: 'line', points: [0, -0.8, 0, -0.05], stroke: 'accent', strokeWidth: 0.04 },
      ],
      motion: { breath: 0.02, windupDeg: -10, strikeDeg: 14 },
    },
    {
      id: 'leg_back',
      parent: 'torso',
      x: -0.1,
      y: 0,
      z: 1,
      shapes: [
        { kind: 'line', points: [0, 0, 0.02, 0.35, 0, 0.68], stroke: 'accent', strokeWidth: 0.15 },
      ],
      motion: { walkSwingDeg: 28, walkPhase: 0.5, walkLift: 0.08, windupDeg: 15, strikeDeg: 28 },
    },
    {
      id: 'leg_front',
      parent: 'torso',
      x: 0.08,
      y: 0,
      z: 4,
      shapes: [
        { kind: 'line', points: [0, 0, 0.02, 0.35, 0, 0.68], stroke: 'body', strokeWidth: 0.15 },
      ],
      motion: { walkSwingDeg: 28, walkPhase: 0, walkLift: 0.08, windupDeg: -10, strikeDeg: -30 },
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
          points: [-0.22, 0, 0.24, 0, 0.26, -0.36, 0, -0.5, -0.24, -0.36],
          fill: 'body',
          stroke: 'accent',
          strokeWidth: 0.06,
        },
        // The mirror face.
        {
          kind: 'ellipse',
          x: 0.08,
          y: -0.22,
          rx: 0.15,
          ry: 0.18,
          fill: 'core',
          fillAlpha: 0.85,
          glow: true,
        },
        { kind: 'ellipse', x: 0.12, y: -0.24, rx: 0.06, ry: 0.06, fill: 'accent' },
      ],
      motion: { windupDeg: -6, strikeDeg: 8 },
    },
    {
      id: 'arm',
      parent: 'torso',
      x: 0.06,
      y: -0.7,
      z: 6,
      rotationDeg: -70,
      shapes: [
        { kind: 'line', points: [0, 0, 0, 0.4], stroke: 'body', strokeWidth: 0.12 },
        // Glass lance.
        {
          kind: 'poly',
          points: [-0.04, 0.4, 0.04, 0.4, 0, 1.35],
          fill: 'core',
          fillAlpha: 0.8,
          stroke: 'accent',
          strokeWidth: 0.04,
          glow: true,
        },
      ],
      motion: { walkSwingDeg: 10, windupDeg: -40, windupX: -0.15, strikeDeg: 20, strikeX: 0.35 },
    },
  ],
});
