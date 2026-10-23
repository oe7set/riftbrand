import { defineElite, type EliteDef } from './schema';
import { registerTunables } from './tunables';

/**
 * Elite modifiers (GDD §5.1), applied on top of any base enemy in elite rooms.
 * Index + 1 is the modifier id stored in the sim (0 = no modifier). Append only.
 */
export const ELITES: readonly EliteDef[] = [
  defineElite({
    id: 'hasty',
    hpMultiplier: 1.6,
    radiusMultiplier: 1.15,
    speedMultiplier: 1.4,
    cooldownMultiplier: 0.65,
    shieldArcDeg: 0,
    shieldDamageFactor: 1,
    deathBlastRadiusPx: 0,
    deathBlastDamage: 0,
    deathBlastFuseSec: 0,
    color: 0xffe14d,
  }),
  defineElite({
    id: 'shielded',
    hpMultiplier: 1.6,
    radiusMultiplier: 1.15,
    speedMultiplier: 1,
    cooldownMultiplier: 1,
    shieldArcDeg: 140,
    shieldDamageFactor: 0.2,
    deathBlastRadiusPx: 0,
    deathBlastDamage: 0,
    deathBlastFuseSec: 0,
    color: 0x8fb8ff,
  }),
  defineElite({
    id: 'volatile',
    hpMultiplier: 1.6,
    radiusMultiplier: 1.15,
    speedMultiplier: 1,
    cooldownMultiplier: 1,
    shieldArcDeg: 0,
    shieldDamageFactor: 1,
    deathBlastRadiusPx: 110,
    deathBlastDamage: 22,
    deathBlastFuseSec: 0.9,
    color: 0xff4d4d,
  }),
];

export const ELITE_ID = { none: 0, hasty: 1, shielded: 2, volatile: 3 } as const;

export function eliteOf(mod: number): EliteDef | undefined {
  return mod > 0 ? ELITES[mod - 1] : undefined;
}

for (const def of ELITES) registerTunables(`elite: ${def.id}`, 'src/content/elites.ts', def);
