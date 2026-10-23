import { useEffect, useRef, useState } from 'preact/hooks';
import {
  MAX_BUTTON_SCALE,
  MIN_BUTTON_SCALE,
  type TouchButtonId,
  type TouchButtonLayout,
} from '../../platform/input/touch-layout';
import { type TranslationKey, t } from '../../shared/i18n';

export interface LayoutEditorScreen {
  kind: 'layout';
  /** Current layout in CSS pixels (defaults with the player's changes applied). */
  buttons: TouchButtonLayout[];
  /** Size factor per button relative to the default (1 = default size). */
  scales: Partial<Record<TouchButtonId, number>>;
  opacity: number;
  onMove(id: TouchButtonId, x: number, y: number): void;
  onScale(id: TouchButtonId, scale: number): void;
  onOpacity(opacity: number): void;
  onReset(): void;
  onDone(): void;
}

const NUDGE_PX = 8;
const SCALE_STEP = 0.1;
const OPACITY_STEP = 0.1;

/**
 * Touch layout editor (GDD §10.1): drag buttons to move them, or select one and use the
 * toolbar (which also makes the editor usable with keyboard and gamepad).
 */
export function LayoutEditor(s: LayoutEditorScreen) {
  const [selected, setSelected] = useState<TouchButtonId>('attack');
  const drag = useRef<{ id: TouchButtonId; dx: number; dy: number } | null>(null);
  const toolbar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    toolbar.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true });
  }, []);
  const current = s.buttons.find((b) => b.id === selected);
  const scale = s.scales[selected] ?? 1;
  const nudge = (dx: number, dy: number) => {
    if (current) s.onMove(selected, current.x + dx, current.y + dy);
  };
  const cycle = () => {
    const i = s.buttons.findIndex((b) => b.id === selected);
    const next = s.buttons[(i + 1) % s.buttons.length];
    if (next) setSelected(next.id);
  };
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

  return (
    <div
      class="rb-layout-editor"
      onPointerMove={(e) => {
        const d = drag.current;
        if (d) s.onMove(d.id, e.clientX - d.dx, e.clientY - d.dy);
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
    >
      {s.buttons.map((b) => (
        <div
          key={b.id}
          class={`rb-layout-button ${b.id === selected ? 'is-selected' : ''}`}
          style={{
            left: `${b.x - b.radius}px`,
            top: `${b.y - b.radius}px`,
            width: `${b.radius * 2}px`,
            height: `${b.radius * 2}px`,
            opacity: b.id === selected ? 1 : Math.max(0.35, s.opacity),
          }}
          onPointerDown={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
            setSelected(b.id);
            drag.current = { id: b.id, dx: e.clientX - b.x, dy: e.clientY - b.y };
          }}
        >
          {t(`layout.button.${b.id}` as TranslationKey)}
        </div>
      ))}
      <div class="rb-layout-toolbar" ref={toolbar}>
        <div class="rb-layout-title">
          {t('layout.title')} · {t(`layout.button.${selected}` as TranslationKey)}
        </div>
        <div class="rb-layout-row">
          <button type="button" class="rb-button rb-small" onClick={cycle}>
            {t('layout.next')}
          </button>
          <button type="button" class="rb-button rb-small" onClick={() => nudge(-NUDGE_PX, 0)}>
            ◀
          </button>
          <button type="button" class="rb-button rb-small" onClick={() => nudge(0, -NUDGE_PX)}>
            ▲
          </button>
          <button type="button" class="rb-button rb-small" onClick={() => nudge(0, NUDGE_PX)}>
            ▼
          </button>
          <button type="button" class="rb-button rb-small" onClick={() => nudge(NUDGE_PX, 0)}>
            ▶
          </button>
        </div>
        <div class="rb-layout-row">
          <span>{t('layout.size', { n: Math.round(scale * 100) })}</span>
          <button
            type="button"
            class="rb-button rb-small"
            onClick={() =>
              s.onScale(selected, clamp(scale - SCALE_STEP, MIN_BUTTON_SCALE, MAX_BUTTON_SCALE))
            }
          >
            −
          </button>
          <button
            type="button"
            class="rb-button rb-small"
            onClick={() =>
              s.onScale(selected, clamp(scale + SCALE_STEP, MIN_BUTTON_SCALE, MAX_BUTTON_SCALE))
            }
          >
            +
          </button>
          <span>{t('layout.opacity', { n: Math.round(s.opacity * 100) })}</span>
          <button
            type="button"
            class="rb-button rb-small"
            onClick={() => s.onOpacity(clamp(s.opacity - OPACITY_STEP, 0.1, 1))}
          >
            −
          </button>
          <button
            type="button"
            class="rb-button rb-small"
            onClick={() => s.onOpacity(clamp(s.opacity + OPACITY_STEP, 0.1, 1))}
          >
            +
          </button>
        </div>
        <div class="rb-layout-row">
          <button type="button" class="rb-button rb-small" onClick={s.onReset}>
            {t('layout.reset')}
          </button>
          <button
            type="button"
            class="rb-button rb-small rb-primary"
            data-autofocus
            onClick={s.onDone}
          >
            {t('layout.done')}
          </button>
        </div>
      </div>
    </div>
  );
}
