import { defineRig } from '../schema';

/** Nix, die Händlerin (ROADMAP M5.1): hooded and sly, swinging a lantern full of rift light. */
export const NIX_RIG = defineRig({
  id: 'nix',
  colors: { body: 0xc46bff, accent: 0x5a2e80, core: 0xf0d6ff },
  strideUnits: 2.2,
  bobUnits: 0.05,
  leanDeg: 6,
  heightUnits: 1.4,
  centerUnits: 0.45,
  shadowUnits: 0.6,
  visualScale: 1.3,
  glowAlpha: 0.24,
  parts: [
    {
      id: 'coat',
      x: 0,
      y: 0.1,
      z: 2,
      shapes: [
        {
          kind: 'poly',
          points: [-0.38, 0.6, 0.34, 0.6, 0.26, -0.7, -0.22, -0.7, -0.46, 0.1],
          fill: 'accent',
          fillAlpha: 0.6,
          stroke: 'body',
          strokeWidth: 0.07,
        },
        { kind: 'line', points: [0.05, -0.6, 0.0, 0.55], stroke: 'body', strokeWidth: 0.04 },
      ],
      motion: { breath: 0.03 },
    },
    {
      id: 'hood',
      parent: 'coat',
      x: 0.02,
      y: -0.72,
      z: 3,
      shapes: [
        {
          kind: 'poly',
          points: [-0.28, 0.05, 0.26, 0.05, 0.22, -0.32, -0.02, -0.52, -0.3, -0.3],
          fill: 'accent',
          fillAlpha: 0.85,
          stroke: 'body',
          strokeWidth: 0.07,
        },
        // Two glinting eyes in the shadow of the hood.
        { kind: 'ellipse', x: 0.08, y: -0.18, rx: 0.04, ry: 0.03, fill: 'core', glow: true },
        { kind: 'ellipse', x: 0.18, y: -0.18, rx: 0.04, ry: 0.03, fill: 'core', glow: true },
      ],
      motion: { breath: 0.01 },
    },
    {
      id: 'arm',
      parent: 'coat',
      x: 0.15,
      y: -0.5,
      z: 4,
      rotationDeg: -35,
      shapes: [{ kind: 'line', points: [0, 0, 0, 0.42], stroke: 'body', strokeWidth: 0.09 }],
      motion: { breath: 0.03 },
    },
    {
      id: 'lantern',
      parent: 'arm',
      x: 0,
      y: 0.42,
      z: 5,
      shapes: [
        { kind: 'line', points: [0, 0, 0, 0.12], stroke: 'accent', strokeWidth: 0.03 },
        {
          kind: 'poly',
          points: [-0.1, 0.12, 0.1, 0.12, 0.12, 0.34, -0.12, 0.34],
          fill: 'core',
          fillAlpha: 0.75,
          stroke: 'body',
          strokeWidth: 0.04,
          glow: true,
        },
      ],
      motion: { breath: 0.08, flutterDeg: 4 },
    },
  ],
});
