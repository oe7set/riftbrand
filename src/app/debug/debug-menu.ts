import {
  exportTuningDiff,
  resetTuning,
  TUNING,
  TUNING_RANGES,
  type TuningKey,
} from '../../content/tuning';

/**
 * Developer-only panel (not player-facing, so its labels are not localized).
 * Toggle: ` or F2, three-finger tap, or gamepad Select.
 */
export interface DebugHooks {
  restart(seed: number): void;
  spawnDrifters(count: number): void;
  clearDrifters(): void;
  setTimeScale(scale: number): void;
  setHitboxes(enabled: boolean): void;
}

export interface DebugStats {
  fps: number;
  frameMsAvg: number;
  frameMsMax: number;
  simMsAvg: number;
  renderMsAvg: number;
  tick: number;
  entities: number;
  seed: number;
  device: string;
  gamepad: string;
  resolution: string;
}

const STATS_REFRESH_MS = 250;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  children: Array<Node | string> = [],
): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  for (const child of children) node.append(child);
  return node;
}

export class DebugMenu {
  private readonly panel: HTMLElement;
  private readonly statsBox: HTMLElement;
  private readonly fpsChip: HTMLElement;
  private readonly seedInput: HTMLInputElement;
  private readonly tuningInputs = new Map<TuningKey, [HTMLInputElement, HTMLElement]>();
  private lastStatsUpdate = 0;
  private showFpsChip = false;
  open = false;

  constructor(
    root: HTMLElement,
    private readonly hooks: DebugHooks,
    private readonly version: string,
  ) {
    this.fpsChip = el('div', { className: 'rb-fps' });
    this.fpsChip.hidden = true;
    this.statsBox = el('pre', { className: 'rb-debug-stats' });
    this.seedInput = el('input', { type: 'number', className: 'rb-debug-seed' });

    this.panel = el('div', { className: 'rb-debug' }, [
      el('div', { className: 'rb-debug-head' }, [
        el('strong', { textContent: 'Debug' }),
        this.button('✕', () => this.toggle(false)),
      ]),
      this.statsBox,
      this.section('View', [
        this.checkbox('Hitboxes', (on) => this.hooks.setHitboxes(on)),
        this.checkbox('FPS overlay', (on) => {
          this.showFpsChip = on;
          this.fpsChip.hidden = !on;
        }),
        this.slider('Time scale', 0.05, 1, 0.05, 1, (v) => this.hooks.setTimeScale(v)),
      ]),
      this.section('Stress test', [
        el('div', { className: 'rb-debug-row' }, [
          this.button('+100 drifters', () => this.hooks.spawnDrifters(100)),
          this.button('+500', () => this.hooks.spawnDrifters(500)),
          this.button('Clear', () => this.hooks.clearDrifters()),
        ]),
      ]),
      this.section('Run', [
        el('div', { className: 'rb-debug-row' }, [
          this.seedInput,
          this.button('Restart', () => this.hooks.restart(Number(this.seedInput.value) >>> 0)),
        ]),
      ]),
      ...this.tuningSections(),
      this.section('Tuning export', [
        el('div', { className: 'rb-debug-row' }, [
          this.button('Copy changes', () => void this.copyTuning()),
          this.button('Reset all', () => {
            resetTuning();
            this.refreshTuning();
          }),
        ]),
      ]),
      el('div', { className: 'rb-debug-version', textContent: this.version }),
    ]);
    this.panel.hidden = true;
    root.append(this.fpsChip, this.panel);
    // Keep debug interaction from reaching the game's pointer handlers.
    for (const type of ['pointerdown', 'pointerup', 'pointermove', 'contextmenu']) {
      this.panel.addEventListener(type, (e) => e.stopPropagation());
    }
  }

  private section(title: string, children: Node[]): HTMLElement {
    const details = el('details', { className: 'rb-debug-section' }, [
      el('summary', { textContent: title }),
      ...children,
    ]);
    details.open = title === 'View' || title === 'Stress test';
    return details;
  }

  private button(label: string, onClick: () => void): HTMLButtonElement {
    const b = el('button', { type: 'button', textContent: label });
    b.addEventListener('click', onClick);
    return b;
  }

  private checkbox(label: string, onChange: (on: boolean) => void): HTMLElement {
    const input = el('input', { type: 'checkbox' });
    input.addEventListener('change', () => onChange(input.checked));
    return el('label', { className: 'rb-debug-row' }, [input, label]);
  }

  private slider(
    label: string,
    min: number,
    max: number,
    step: number,
    value: number,
    onInput: (v: number) => void,
  ): HTMLElement {
    const out = el('span', { className: 'rb-debug-value', textContent: String(value) });
    const input = el('input', {
      type: 'range',
      min: String(min),
      max: String(max),
      step: String(step),
      value: String(value),
    });
    input.addEventListener('input', () => {
      out.textContent = input.value;
      onInput(Number(input.value));
    });
    return el('label', { className: 'rb-debug-slider' }, [
      el('span', { textContent: label }),
      input,
      out,
    ]);
  }

  private tuningSections(): HTMLElement[] {
    const groups = new Map<string, HTMLElement[]>();
    for (const key of Object.keys(TUNING) as TuningKey[]) {
      const range = TUNING_RANGES[key];
      const row = this.slider(key, range.min, range.max, range.step, TUNING[key], (v) => {
        TUNING[key] = v;
      });
      const input = row.querySelector('input');
      const out = row.querySelector('.rb-debug-value');
      if (input && out instanceof HTMLElement) this.tuningInputs.set(key, [input, out]);
      const list = groups.get(range.group) ?? [];
      list.push(row);
      groups.set(range.group, list);
    }
    return [...groups].map(([group, rows]) => this.section(`Tuning: ${group}`, rows));
  }

  private refreshTuning(): void {
    for (const [key, [input, out]] of this.tuningInputs) {
      input.value = String(TUNING[key]);
      out.textContent = String(TUNING[key]);
    }
  }

  private async copyTuning(): Promise<void> {
    const text = exportTuningDiff();
    try {
      await navigator.clipboard.writeText(text);
      window.alert(`Copied to clipboard:\n\n${text}`);
    } catch {
      // Clipboard can be unavailable (permissions, insecure context); show it for manual copy.
      window.prompt('Copy tuning changes:', text);
    }
  }

  toggle(force?: boolean): void {
    this.open = force ?? !this.open;
    this.panel.hidden = !this.open;
  }

  setSeed(seed: number): void {
    this.seedInput.value = String(seed);
  }

  update(nowMs: number, stats: DebugStats): void {
    if (nowMs - this.lastStatsUpdate < STATS_REFRESH_MS) return;
    this.lastStatsUpdate = nowMs;
    const fpsLine = `${stats.fps.toFixed(0)} fps  frame ${stats.frameMsAvg.toFixed(1)}/${stats.frameMsMax.toFixed(1)} ms`;
    if (this.showFpsChip) this.fpsChip.textContent = fpsLine;
    if (!this.open) return;
    this.statsBox.textContent = [
      fpsLine,
      `sim ${stats.simMsAvg.toFixed(2)} ms  render ${stats.renderMsAvg.toFixed(2)} ms`,
      `tick ${stats.tick}  entities ${stats.entities}`,
      `seed ${stats.seed}`,
      `input ${stats.device}  pad ${stats.gamepad}`,
      `res ${stats.resolution}`,
    ].join('\n');
  }
}
