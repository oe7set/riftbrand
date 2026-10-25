import { useEffect, useRef, useState } from 'preact/hooks';
import { SCENE_TUNING, sceneById } from '../../content/story/scenes';
import { type TranslationKey, t } from '../../shared/i18n';

/** A short story scene (ROADMAP M5.7): one line at a time, written out with gibberish blips. */
export interface SceneScreenProps {
  kind: 'scene';
  sceneId: string;
  /** A syllable was written; the app plays the speaker's voice. */
  onBlip(speaker: string): void;
  onDone(): void;
}

const SPEAKER_COLORS: Readonly<Record<string, string>> = {
  vesper: '#fff1d6',
  maren: '#ffb347',
  nix: '#c46bff',
  sel: '#b8a6ff',
  toll: '#ff9a5a',
  iskra: '#7ff6c8',
  archivist: '#9fa8ff',
  wanderer: '#d8c4ff',
};

/** Every scene speaker has a `speaker.<id>` name, enemies included (they talk by title). */
function speakerName(speaker: string): string {
  return t(`speaker.${speaker}` as TranslationKey);
}

export function SceneScreen({ sceneId, onBlip, onDone }: SceneScreenProps) {
  const scene = sceneById(sceneId);
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(0);
  const button = useRef<HTMLButtonElement>(null);
  const line = scene?.lines[index];
  const text = line ? t(`scene.${sceneId}.${index + 1}` as TranslationKey) : '';
  const done = shown >= text.length;

  useEffect(() => {
    button.current?.focus({ preventScroll: true });
  }, []);

  // Typewriter: one step per tick, a syllable sound every few letters.
  useEffect(() => {
    if (!line || done) return;
    const id = window.setTimeout(() => {
      const next = shown + 1;
      setShown(next);
      if (next % SCENE_TUNING.charsPerSyllable === 1) onBlip(line.speaker);
    }, 1000 / SCENE_TUNING.charsPerSec);
    return () => window.clearTimeout(id);
  }, [line, shown, done, onBlip]);

  if (!scene || !line) return null;
  const advance = () => {
    if (!done) {
      setShown(text.length);
      return;
    }
    if (index + 1 >= scene.lines.length) {
      onDone();
      return;
    }
    setIndex(index + 1);
    setShown(0);
  };
  const color = SPEAKER_COLORS[line.speaker] ?? '#ff8a5c';
  return (
    <div class="rb-scene" style={{ '--speaker': color }}>
      <div class="rb-scene-box">
        <div class="rb-scene-name">{speakerName(line.speaker)}</div>
        <div class="rb-scene-text">{text.slice(0, shown)}</div>
        <div class="rb-scene-actions">
          <button type="button" class="rb-button rb-small-button" onClick={onDone}>
            {t('scene.skip')}
          </button>
          <button
            type="button"
            ref={button}
            class="rb-button rb-primary rb-small-button"
            data-autofocus
            onClick={advance}
          >
            {done ? (index + 1 >= scene.lines.length ? t('scene.close') : t('scene.next')) : '…'}
          </button>
        </div>
      </div>
    </div>
  );
}
