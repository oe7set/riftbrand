import type { HubLayoutDef, RoomTemplateDef, StationDef } from '../../content/schema';
import { TUNING } from '../../content/tuning';
import { Button } from '../../shared/input-frame';
import type { RoomSetup } from '../run/run-state';

/**
 * The walkable refuge (ROADMAP M5.1, ADR 0006) reuses the room simulation: same movement, dash,
 * collision and camera as in a fight, with no encounter and no combat buttons.
 */
export function hubRoomSetup(hub: HubLayoutDef): RoomSetup {
  const template: RoomTemplateDef = {
    id: 'refuge',
    widthPx: hub.widthPx,
    heightPx: hub.heightPx,
    types: ['rest'],
    obstacles: hub.obstacles,
    playerStart: hub.playerStart,
    // The room exit opens at once (no encounter) and becomes the portal hall.
    exit: hub.portal,
    spawnPoints: [],
  };
  return {
    template,
    encounter: { kind: 'none' },
    playerHp: TUNING.playerMaxHp,
    playerMaxHp: TUNING.playerMaxHp,
    boons: [],
    relics: [],
    shards: 0,
    evolutions: [],
    ultCharge: 0,
    bonusAllDamage: 0,
    bonusStaminaRegen: 0,
    staminaBonus: 0,
    lastSparks: 0,
    lastSparkHeal: 0,
    spells: { active: null, aura: null },
    cast: { level: 1, branches: [] },
  };
}

/** Buttons that only make sense in a fight; the refuge strips them from the input. */
export const COMBAT_BUTTONS =
  Button.Attack | Button.Special | Button.Cast | Button.Ultimate | Button.Spell;

/**
 * In the refuge the attack button talks (touch has no separate interact button), so both
 * attack and interact count as "interact".
 */
export function hubInteractPressed(pressed: number): boolean {
  return (pressed & (Button.Attack | Button.Interact)) !== 0;
}

/**
 * Index of the station the player can interact with: the closest one whose radius contains the
 * player, or -1.
 */
export function nearestStation(stations: readonly StationDef[], x: number, y: number): number {
  let best = -1;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < stations.length; i++) {
    const s = stations[i] as StationDef;
    const dx = s.x - x;
    const dy = s.y - y;
    const d = dx * dx + dy * dy;
    if (d <= s.radiusPx * s.radiusPx && d < bestDist) {
      best = i;
      bestDist = d;
    }
  }
  return best;
}
