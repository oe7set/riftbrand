import type { EnemyAttackDef, EnemyDef } from '../schema';
import { registerTunables } from '../tunables';
import { ASH_PRIEST } from './ash-priest';
import { BRUTE } from './brute';
import { CINDER_LAYER } from './cinder-layer';
import { EMBER_MITE } from './ember-mite';
import { EMBER_WARDEN } from './ember-warden';
import { SLAG } from './slag';
import { SPITTER } from './spitter';

/** Index in this list is the enemy type id stored in the sim (Uint8). Append only. */
export const ENEMIES: readonly EnemyDef[] = [
  SLAG,
  SPITTER,
  BRUTE,
  EMBER_MITE,
  ASH_PRIEST,
  CINDER_LAYER,
  EMBER_WARDEN,
];

export const ENEMY_TYPE = {
  slag: 0,
  spitter: 1,
  brute: 2,
  ember_mite: 3,
  ash_priest: 4,
  cinder_layer: 5,
  ember_warden: 6,
} as const;

export function enemyTypeOf(id: string): number {
  return ENEMIES.findIndex((e) => e.id === id);
}

/** The attack an enemy uses: its single attack, or the current boss pattern. */
export function attackOf(def: EnemyDef, phase: number, pattern: number): EnemyAttackDef {
  const phases = def.boss?.phases;
  if (!phases) return def.attack;
  const p = phases[Math.min(phase, phases.length - 1)];
  return p?.attacks[pattern] ?? def.attack;
}

for (const def of ENEMIES) {
  const source = `src/content/enemies/${def.id.replaceAll('_', '-')}.ts`;
  registerTunables(`enemy: ${def.id}`, source, def);
  if (!def.boss) registerTunables(`enemy: ${def.id} attack`, source, def.attack);
  def.boss?.phases.forEach((phase, i) => {
    registerTunables(`enemy: ${def.id} phase ${i + 1}`, source, phase);
  });
}
