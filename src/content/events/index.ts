import { defineEvent, type EventDef } from '../schema';

/** Text events with risk/reward choices (GDD §6.2). Texts live in the locale files. */
export const EVENTS: readonly EventDef[] = [
  defineEvent({
    id: 'whispering_rift',
    options: [
      {
        id: 'reach_in',
        outcomes: [
          { type: 'relic', pool: 'curse' },
          { type: 'shards', amount: 60 },
        ],
      },
      { id: 'walk_on', outcomes: [] },
    ],
  }),
  defineEvent({
    id: 'ember_spring',
    options: [
      { id: 'drink', outcomes: [{ type: 'heal', fraction: 0.35 }] },
      {
        id: 'dive',
        requiresHpAbove: 20,
        outcomes: [
          { type: 'damage', amount: 18 },
          { type: 'relic', pool: 'rare' },
        ],
      },
      { id: 'leave', outcomes: [] },
    ],
  }),
  defineEvent({
    id: 'stranded_merchant',
    options: [
      {
        id: 'trade',
        requiresShards: 40,
        outcomes: [
          { type: 'shards', amount: -40 },
          { type: 'relic', pool: 'rare' },
        ],
      },
      {
        id: 'share_fire',
        outcomes: [
          { type: 'maxHp', amount: 8 },
          { type: 'heal', fraction: 0.1 },
        ],
      },
      { id: 'leave', outcomes: [] },
    ],
  }),
];

export function eventById(id: string): EventDef | undefined {
  return EVENTS.find((e) => e.id === id);
}
