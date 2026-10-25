import { describe, expect, it } from 'vitest';
import { LOCALES } from '../../shared/i18n';
import { ENEMIES } from '../enemies';
import { SCENES, sceneById, VOICE_PITCH } from './scenes';

describe('story scenes', () => {
  it('has text for every line and a name for every speaker in every locale', () => {
    for (const table of Object.values(LOCALES)) {
      const strings = table as Record<string, string>;
      for (const scene of SCENES) {
        scene.lines.forEach((line, i) => {
          expect(strings[`scene.${scene.id}.${i + 1}`], `${scene.id}.${i + 1}`).toBeTruthy();
          const name = strings[`speaker.${line.speaker}`];
          expect(name, line.speaker).toBeTruthy();
        });
      }
      for (const key of ['scene.skip', 'scene.next', 'scene.close'])
        expect(strings[key]).toBeTruthy();
    }
  });

  it('gives every speaker a voice', () => {
    for (const scene of SCENES) {
      for (const line of scene.lines)
        expect(VOICE_PITCH[line.speaker], line.speaker).toBeGreaterThan(0);
    }
  });

  it('only stars enemies that exist and finds scenes by id', () => {
    const enemyIds = new Set(ENEMIES.map((e) => e.id));
    for (const scene of SCENES) {
      for (const { speaker } of scene.lines) {
        if (speaker !== 'vesper' && speaker !== 'wanderer')
          expect(enemyIds.has(speaker), speaker).toBe(true);
      }
    }
    expect(sceneById('ember_warden_intro')?.lines.length).toBeGreaterThan(0);
    expect(sceneById('nope')).toBeUndefined();
  });
});
