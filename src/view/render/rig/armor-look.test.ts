import { describe, expect, it } from 'vitest';
import { ARMOR, armorById } from '../../../content/armor';
import { RIGS } from '../../../content/rigs';
import { armoredRig, armorLookKey } from './armor-look';

describe('armour on Vesper (ROADMAP M5.4)', () => {
  const vesper = RIGS.find((r) => r.id === 'vesper');
  if (!vesper) throw new Error('missing vesper');

  it('adds the piece shapes to their part and leaves the base rig alone', () => {
    const before = vesper.parts.find((p) => p.id === 'head')?.shapes.length ?? 0;
    const rig = armoredRig(vesper, ['ember_helm']);
    const added = armorById('ember_helm')?.look.shapes.length ?? 0;
    expect(rig.parts.find((p) => p.id === 'head')?.shapes.length).toBe(before + added);
    expect(vesper.parts.find((p) => p.id === 'head')?.shapes.length).toBe(before);
  });

  it('every armour look targets a real Vesper part', () => {
    const parts = new Set(vesper.parts.map((p) => p.id));
    for (const a of ARMOR) expect(parts.has(a.look.part), a.id).toBe(true);
  });

  it('the loadout key ignores order', () => {
    expect(armorLookKey(['b', 'a'])).toBe(armorLookKey(['a', 'b']));
  });
});
