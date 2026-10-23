import { defineStatus, type StatusDef, type StatusId, statusIdSchema } from './schema';
import { registerTunables } from './tunables';

/**
 * Status effects on enemies (GDD §2.4, ROADMAP M3.1). Every status works the same way: stacks
 * up to a cap, each application refreshes the duration, and all stacks drop when it runs out.
 * What a stack does (damage over time, slow, freeze, slower windups, worse aim) is data.
 */
export const STATUSES: readonly StatusDef[] = [
  defineStatus({
    id: 'burn',
    maxStacks: 10,
    durationSec: 3,
    damagePerStackPerSec: 3,
    tickSec: 0.5,
    slowPerStack: 0,
    freezeAtStacks: 0,
    windupMultiplier: 1,
    aimErrorDeg: 0,
    visual: { color: 0xffa64d, glyph: 'flame', priority: 3 },
  }),
  defineStatus({
    id: 'chill',
    maxStacks: 5,
    durationSec: 4,
    damagePerStackPerSec: 0,
    tickSec: 1,
    slowPerStack: 0.1,
    freezeAtStacks: 5,
    windupMultiplier: 1,
    aimErrorDeg: 0,
    visual: { color: 0x8fe3ff, glyph: 'snowflake', priority: 4 },
  }),
  defineStatus({
    // Slower than burn but it lasts: stacks never fall off one by one, only all at once
    // after durationSec without a new stack.
    id: 'poison',
    maxStacks: 10,
    durationSec: 6,
    damagePerStackPerSec: 1.6,
    tickSec: 1,
    slowPerStack: 0,
    freezeAtStacks: 0,
    windupMultiplier: 1,
    aimErrorDeg: 0,
    visual: { color: 0x7dff6b, glyph: 'drop', priority: 2 },
  }),
  defineStatus({
    // Lowest icon priority: the halo over the head already shows it.
    id: 'blind',
    maxStacks: 1,
    durationSec: 3,
    damagePerStackPerSec: 0,
    tickSec: 1,
    slowPerStack: 0,
    freezeAtStacks: 0,
    windupMultiplier: 1.3,
    aimErrorDeg: 25,
    visual: { color: 0xfff6c8, glyph: 'eye', priority: 1 },
  }),
];

export const STATUS_COUNT = STATUSES.length;

/** Index of each status in the sim's per-entity status arrays (same order as statusIdSchema). */
export const Status = {
  Burn: 0,
  Chill: 1,
  Poison: 2,
  Blind: 3,
} as const;

export type StatusIndex = (typeof Status)[keyof typeof Status];

export function statusIndex(id: StatusId): StatusIndex {
  return statusIdSchema.options.indexOf(id) as StatusIndex;
}

export function statusDef(index: number): StatusDef {
  return STATUSES[index] as StatusDef;
}

for (const def of STATUSES) {
  registerTunables(`status: ${def.id}`, 'src/content/statuses.ts', def);
}
