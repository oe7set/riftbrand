import type { EnemyAttackDef, EnemyDef } from '../schema';
import { registerTunables } from '../tunables';
import { ASH_PRIEST } from './ash-priest';
import { BRUTE } from './brute';
import { CINDER_LAYER } from './cinder-layer';
import { EMBER_DUELIST } from './ember-duelist';
import { EMBER_MITE } from './ember-mite';
import { EMBER_WARDEN } from './ember-warden';
import { FROST_BELL } from './glass-sea/frost-bell';
import { GLASS_FENCER } from './glass-sea/glass-fencer';
import { GLASS_MITE } from './glass-sea/glass-mite';
import { ICE_WHALE } from './glass-sea/ice-whale';
import { MIRROR_KNIGHT } from './glass-sea/mirror-knight';
import { MIRROR_QUEEN } from './glass-sea/mirror-queen';
import { PRISM_SPITTER } from './glass-sea/prism-spitter';
import { SHARD_GOLEM } from './glass-sea/shard-golem';
import { TIDE_PRIEST } from './glass-sea/tide-priest';
import { SLAG } from './slag';
import { SPITTER } from './spitter';
import { TWIN_ASH } from './twin-ash';
import { TWIN_SPARK } from './twin-spark';

/** Index in this list is the enemy type id stored in the sim (Uint8). Append only. */
export const ENEMIES: readonly EnemyDef[] = [
  SLAG,
  SPITTER,
  BRUTE,
  EMBER_MITE,
  ASH_PRIEST,
  CINDER_LAYER,
  EMBER_WARDEN,
  EMBER_DUELIST,
  TWIN_SPARK,
  TWIN_ASH,
  // Gläserne See (ROADMAP M6.1)
  GLASS_MITE,
  PRISM_SPITTER,
  MIRROR_KNIGHT,
  SHARD_GOLEM,
  FROST_BELL,
  TIDE_PRIEST,
  GLASS_FENCER,
  ICE_WHALE,
  MIRROR_QUEEN,
];

export const ENEMY_TYPE = {
  slag: 0,
  spitter: 1,
  brute: 2,
  ember_mite: 3,
  ash_priest: 4,
  cinder_layer: 5,
  ember_warden: 6,
  ember_duelist: 7,
  twin_spark: 8,
  twin_ash: 9,
  glass_mite: 10,
  prism_spitter: 11,
  mirror_knight: 12,
  shard_golem: 13,
  frost_bell: 14,
  tide_priest: 15,
  glass_fencer: 16,
  ice_whale: 17,
  mirror_queen: 18,
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

const GLASS_SEA_IDS = new Set(ENEMIES.slice(10).map((e) => e.id));

for (const def of ENEMIES) {
  const file = def.id.replaceAll('_', '-');
  const source = GLASS_SEA_IDS.has(def.id)
    ? `src/content/enemies/glass-sea/${file}.ts`
    : `src/content/enemies/${file}.ts`;
  registerTunables(`enemy: ${def.id}`, source, def);
  if (!def.boss) registerTunables(`enemy: ${def.id} attack`, source, def.attack);
  def.boss?.phases.forEach((phase, i) => {
    registerTunables(`enemy: ${def.id} phase ${i + 1}`, source, phase);
  });
}
