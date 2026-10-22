import type { EnemyDef } from '../schema';
import { registerTunables } from '../tunables';
import { BRUTE } from './brute';
import { SLAG } from './slag';
import { SPITTER } from './spitter';

/** Index in this list is the enemy type id stored in the sim (Uint8). Append only. */
export const ENEMIES: readonly EnemyDef[] = [SLAG, SPITTER, BRUTE];

export const ENEMY_TYPE = {
  slag: 0,
  spitter: 1,
  brute: 2,
} as const;

for (const def of ENEMIES) {
  const source = `src/content/enemies/${def.id}.ts`;
  registerTunables(`enemy: ${def.id}`, source, def);
  registerTunables(`enemy: ${def.id} attack`, source, def.attack);
}
