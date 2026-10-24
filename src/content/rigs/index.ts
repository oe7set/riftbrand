import type { RigDef } from '../schema';
import { registerTunables } from '../tunables';
import { ARCHIVIST_RIG } from './archivist';
import { ASH_PRIEST_RIG } from './ash-priest';
import { BRUTE_RIG } from './brute';
import { CINDER_LAYER_RIG } from './cinder-layer';
import { EMBER_DUELIST_RIG } from './ember-duelist';
import { EMBER_MITE_RIG } from './ember-mite';
import { EMBER_WARDEN_RIG } from './ember-warden';
import { ISKRA_RIG } from './iskra';
import { MAREN_RIG } from './maren';
import { NIX_RIG } from './nix';
import { SEL_RIG } from './sel';
import { SLAG_RIG } from './slag';
import { SPITTER_RIG } from './spitter';
import { TOLL_RIG } from './toll';
import { TWIN_ASH_RIG } from './twin-ash';
import { TWIN_SPARK_RIG } from './twin-spark';
import { VESPER_RIG } from './vesper';

/**
 * Rigs (ROADMAP M4): bodies made of parts for the new look. Entities without a rig keep the
 * classic shape. The index is the view's rig id.
 */
export const RIGS: readonly RigDef[] = [
  VESPER_RIG,
  SLAG_RIG,
  SPITTER_RIG,
  BRUTE_RIG,
  EMBER_MITE_RIG,
  ASH_PRIEST_RIG,
  CINDER_LAYER_RIG,
  EMBER_DUELIST_RIG,
  TWIN_SPARK_RIG,
  TWIN_ASH_RIG,
  EMBER_WARDEN_RIG,
  MAREN_RIG,
  NIX_RIG,
  SEL_RIG,
  TOLL_RIG,
  ISKRA_RIG,
  ARCHIVIST_RIG,
];

export const PLAYER_RIG_ID = 'vesper';

/** Enemy id → rig id. Every creature of the Ashfields has a body (ROADMAP M4.2). */
export const ENEMY_RIGS: Readonly<Record<string, string>> = {
  slag: 'slag',
  spitter: 'spitter',
  brute: 'brute',
  ember_mite: 'ember_mite',
  ash_priest: 'ash_priest',
  cinder_layer: 'cinder_layer',
  ember_duelist: 'ember_duelist',
  twin_spark: 'twin_spark',
  twin_ash: 'twin_ash',
  ember_warden: 'ember_warden',
};

export function rigIndex(id: string): number {
  return RIGS.findIndex((r) => r.id === id);
}

/** View-side animation feel shared by all rigs. */
export const RIG_TUNING = {
  /** How long a dash afterimage of a rigged body lingers. */
  afterimageLifeSec: 0.22,
  /** Recoil of the body away from a hit, decaying with the hit squash. */
  twitchDeg: 16,
  /** One breath in and out while idle. */
  breathSec: 2.4,
  /** How fast parts fly apart on death. */
  shatterSpeedPxPerSec: 240,
  shatterLifeSec: 0.65,
  /** How quickly the walk blend follows the speed (per second). */
  moveBlendPerSec: 10,
  /** Vesper's happy jump when a room is cleared (ROADMAP M4.5): two hops in this time… */
  celebrateSec: 0.7,
  /** …each this high, in body radii. */
  celebrateHopUnits: 0.9,
};

registerTunables('rigs (look)', 'src/content/rigs/index.ts', RIG_TUNING);
for (const rig of RIGS) {
  registerTunables(
    `rig: ${rig.id}`,
    `src/content/rigs/${rig.id.replaceAll('_', '-')}.ts`,
    rig,
    {},
    ['strideUnits', 'bobUnits', 'leanDeg'],
  );
}
