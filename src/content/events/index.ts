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
  // ── The Wanderer (docs/STORY.md §4): a hooded stranger who knows too much ──
  defineEvent({
    id: 'wanderer_fire',
    options: [
      { id: 'sit', outcomes: [{ type: 'heal', fraction: 0.25 }] },
      { id: 'ask', outcomes: [{ type: 'shards', amount: 35 }] },
      { id: 'leave', outcomes: [] },
    ],
  }),
  defineEvent({
    id: 'wanderer_gift',
    options: [
      { id: 'take', outcomes: [{ type: 'relic', pool: 'common' }] },
      { id: 'refuse', outcomes: [{ type: 'maxHp', amount: 5 }] },
    ],
  }),
  defineEvent({
    id: 'wanderer_warning',
    options: [
      { id: 'listen', outcomes: [{ type: 'heal', fraction: 0.15 }] },
      {
        id: 'follow',
        requiresHpAbove: 12,
        outcomes: [
          { type: 'damage', amount: 10 },
          { type: 'shards', amount: 70 },
        ],
      },
    ],
  }),
];

export function eventById(id: string): EventDef | undefined {
  return EVENTS.find((e) => e.id === id);
}
