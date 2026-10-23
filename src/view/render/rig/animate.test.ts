import { describe, expect, it } from 'vitest';
import { RIGS } from '../../../content/rigs';
import { SLAG_RIG } from '../../../content/rigs/slag';
import { VESPER_RIG } from '../../../content/rigs/vesper';
import {
  createPose,
  createRigInput,
  layoutRig,
  POSE_STRIDE,
  poseRig,
  type RigInput,
  resetRigInput,
} from './animate';

function pose(rig = VESPER_RIG, setup: (i: RigInput) => void = () => {}): Float32Array {
  const input = resetRigInput(createRigInput());
  setup(input);
  const out = createPose(rig);
  poseRig(layoutRig(rig), input, out);
  return out;
}

function partAt(rig: typeof VESPER_RIG, out: Float32Array, id: string) {
  const i = rig.parts.findIndex((p) => p.id === id);
  const o = i * POSE_STRIDE;
  return { x: out[o] as number, y: out[o + 1] as number, rot: out[o + 2] as number };
}

describe('rig posing (ROADMAP M4.1)', () => {
  it('rest pose puts children at their joints in the parent space', () => {
    const out = pose();
    const torso = partAt(VESPER_RIG, out, 'torso');
    const head = partAt(VESPER_RIG, out, 'head');
    expect(torso.x).toBeCloseTo(0);
    expect(torso.y).toBeCloseTo(0.05);
    expect(head.x).toBeCloseTo(0.02);
    expect(head.y).toBeCloseTo(0.05 - 0.82);
  });

  it('children follow a rotating parent', () => {
    const out = pose(VESPER_RIG, (i) => {
      i.windup = 1;
    });
    const torso = partAt(VESPER_RIG, out, 'torso');
    const head = partAt(VESPER_RIG, out, 'head');
    // The torso leans back in the windup, so the head moves back too (negative x).
    expect(torso.rot).toBeLessThan(0);
    expect(head.x).toBeLessThan(0.02);
  });

  it('legs swing in opposite phases while walking', () => {
    const out = pose(VESPER_RIG, (i) => {
      i.move = 1;
      i.walkCycles = 0.25;
    });
    const front = partAt(VESPER_RIG, out, 'leg_front');
    const back = partAt(VESPER_RIG, out, 'leg_back');
    const torso = partAt(VESPER_RIG, out, 'torso');
    expect(Math.sign(front.rot - torso.rot)).toBe(-Math.sign(back.rot - torso.rot));
  });

  it('the blade arm points along the aim at the end of a thrust windup', () => {
    const out = pose(VESPER_RIG, (i) => {
      i.swingStep = 2;
      i.swingPhase = 1.999;
      i.aimDeg = 0;
    });
    const arm = partAt(VESPER_RIG, out, 'arm_front');
    // Arm local +y along the weapon direction: 0° (forward) means a rotation of -90°.
    expect((arm.rot * 180) / Math.PI).toBeCloseTo(-90, 0);
  });

  it('slag ducks its head in the windup', () => {
    const rest = partAt(SLAG_RIG, pose(SLAG_RIG), 'head');
    const duck = partAt(
      SLAG_RIG,
      pose(SLAG_RIG, (i) => {
        i.windup = 1;
      }),
      'head',
    );
    expect(duck.rot).toBeGreaterThan(rest.rot);
    expect(duck.y).toBeGreaterThan(rest.y);
  });

  it('every rig orders parents before children and keeps a valid draw order', () => {
    for (const rig of RIGS) {
      const layout = layoutRig(rig);
      expect(layout.drawOrder).toHaveLength(rig.parts.length);
      layout.parent.forEach((p, i) => {
        expect(p).toBeLessThan(i);
      });
    }
  });
});
