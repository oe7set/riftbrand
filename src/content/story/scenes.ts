import { defineScene, type SceneDef } from '../schema';
import { registerTunables } from '../tunables';

/**
 * Short story scenes (ROADMAP M5.7, docs/STORY.md): boss and champion intros on the first
 * meeting, the first boss victory. Text in `scene.<id>.<n>`.
 */
export const SCENES: readonly SceneDef[] = [
  defineScene({
    id: 'ember_warden_intro',
    lines: [{ speaker: 'ember_warden' }, { speaker: 'ember_warden' }, { speaker: 'vesper' }],
  }),
  defineScene({
    id: 'ember_warden_outro',
    lines: [{ speaker: 'ember_warden' }, { speaker: 'ember_warden' }, { speaker: 'vesper' }],
  }),
  defineScene({
    id: 'ember_duelist_intro',
    lines: [{ speaker: 'ember_duelist' }, { speaker: 'vesper' }],
  }),
  defineScene({
    id: 'twin_spark_intro',
    lines: [{ speaker: 'twin_spark' }, { speaker: 'twin_ash' }],
  }),
  // ── Gläserne See (ROADMAP M6.1, docs/STORY.md Akt 2: grief, holding on) ──
  defineScene({
    id: 'glass_fencer_intro',
    lines: [{ speaker: 'glass_fencer' }, { speaker: 'vesper' }],
  }),
  defineScene({
    id: 'ice_whale_intro',
    lines: [{ speaker: 'ice_whale' }, { speaker: 'vesper' }],
  }),
  defineScene({
    id: 'mirror_queen_intro',
    lines: [{ speaker: 'mirror_queen' }, { speaker: 'mirror_queen' }, { speaker: 'vesper' }],
  }),
  defineScene({
    id: 'mirror_queen_outro',
    lines: [{ speaker: 'mirror_queen' }, { speaker: 'mirror_queen' }, { speaker: 'vesper' }],
  }),
];

export function sceneById(id: string): SceneDef | undefined {
  return SCENES.find((s) => s.id === id);
}

/** Gibberish voices: base pitch per speaker (1 = the talk sound as recorded). */
export const VOICE_PITCH: Readonly<Record<string, number>> = {
  vesper: 1.15,
  maren: 0.85,
  nix: 1.35,
  sel: 1.05,
  toll: 0.7,
  iskra: 1.5,
  archivist: 0.6,
  wanderer: 0.75,
  ember_warden: 0.45,
  ember_duelist: 0.9,
  twin_spark: 1.4,
  twin_ash: 0.8,
  glass_fencer: 1.2,
  ice_whale: 0.35,
  mirror_queen: 0.95,
};

/** Typewriter speed and how often a syllable sounds while a line is written out. */
export const SCENE_TUNING = {
  charsPerSec: 45,
  charsPerSyllable: 3,
};

registerTunables('story scenes', 'src/content/story/scenes.ts', SCENE_TUNING);
