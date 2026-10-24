import { armorById } from '../../../content/armor';
import type { RigDef } from '../../../content/schema';

/**
 * Vesper wearing armour (ROADMAP M5.4): each piece adds its shapes on top of one rig part. Pure;
 * the result is baked once per loadout, never per frame.
 */
export function armoredRig(base: RigDef, armorIds: readonly string[]): RigDef {
  const extra = new Map<string, RigDef['parts'][number]['shapes']>();
  for (const id of armorIds) {
    const look = armorById(id)?.look;
    if (!look) continue;
    extra.set(look.part, [...(extra.get(look.part) ?? []), ...look.shapes]);
  }
  return {
    ...base,
    parts: base.parts.map((part) => {
      const shapes = extra.get(part.id);
      return shapes ? { ...part, shapes: [...part.shapes, ...shapes] } : part;
    }),
  };
}

/** Stable key of a loadout, to bake only when it changes. */
export function armorLookKey(armorIds: readonly string[]): string {
  return [...armorIds].sort().join(',');
}
