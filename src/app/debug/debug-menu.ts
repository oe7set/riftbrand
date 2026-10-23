import {
  exportTunablesDiff,
  resetTunables,
  type TunableGroup,
  tunableGroups,
} from '../../content/tunables';

/**
 * Developer-only panel (not player-facing, so its labels are not localized).
 * Toggle: ` or F2, three-finger tap, or gamepad Select.
 */
export interface DebugHooks {
  restart(seed: number): void;
  spawnDrifters(count: number): void;
  clearDrifters(): void;
  /** Packed enemy code (type + elite modifier, see sim/enemy-code). */
  spawnEnemy(code: number): void;
  killAllEnemies(): void;
  clearRoom(): void;
  warpToExit(): void;
  nextWave(): void;
  setWaves(enabled: boolean): void;
  setGodMode(enabled: boolean): void;
  setTimeScale(scale: number): void;
  setHitboxes(enabled: boolean): void;
  giveBoon(id: string): void;
  clearBoons(): void;
  giveRelic(id: string): void;
  giveShards(amount: number): void;
  /** Meta currencies for testing the Ember Tree and Nix. */
  giveMeta(ember: number, dust: number): void;
  /** Downloads the local run log (last 50 runs) as JSON. */
  exportRunLog(): void;
  fillUltimate(): void;
  /** Also resets the spell cooldown. */
  refillCast(): void;
  /** Puts a spell into its slot (active or aura, from the spell's kind). */
  equipSpell(id: string): void;
  /** Raises the active spell, aura or rift shot by one level (branch 0/1 on levels 3 and 5). */
  upgrade(target: 'active' | 'aura' | 'cast', branch: number): void;
  giveEvolution(id: string): void;
  /** Adds stacks of a status to every enemy (status id from content/statuses). */
  applyStatus(id: string, stacks: number): void;
}

export interface DebugStats {
  fps: number;
  frameMsAvg: number;
  frameMsMax: number;
  simMsAvg: number;
  renderMsAvg: number;
  tick: number;
  entities: number;
  particles: number;
  seed: number;
  wave: number;
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
  private readonly tuningInputs: Array<{
    group: TunableGroup;
    key: string;
    input: HTMLInputElement;
    out: HTMLElement;
  }> = [];
  private lastStatsUpdate = 0;
  private showFpsChip = false;
  open = false;

  constructor(
    root: HTMLElement,
    private readonly hooks: DebugHooks,
    enemyNames: readonly string[],
    private readonly version: string,
    boonIds: readonly string[] = [],
    relicIds: readonly string[] = [],
    evolutionIds: readonly string[] = [],
    /** Elite spawn buttons: label plus packed enemy code. */
    eliteSpawns: ReadonlyArray<{ label: string; code: number }> = [],
    spellIds: readonly string[] = [],
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
      this.section('View', true, [
        this.checkbox('Hitboxes', false, (on) => this.hooks.setHitboxes(on)),
        this.checkbox('FPS overlay', false, (on) => {
          this.showFpsChip = on;
          this.fpsChip.hidden = !on;
        }),
        this.slider('Time scale', { min: 0.05, max: 1, step: 0.05 }, 1, (v) =>
          this.hooks.setTimeScale(v),
        ),
      ]),
      this.section('Combat', true, [
        this.checkbox('God mode', false, (on) => this.hooks.setGodMode(on)),
        this.checkbox('Waves', true, (on) => this.hooks.setWaves(on)),
        el(
          'div',
          { className: 'rb-debug-row' },
          enemyNames.map((name, type) =>
            this.button(`+ ${name}`, () => this.hooks.spawnEnemy(type)),
          ),
        ),
        el(
          'div',
          { className: 'rb-debug-row' },
          eliteSpawns.map(({ label, code }) =>
            this.button(`+ ${label}`, () => this.hooks.spawnEnemy(code)),
          ),
        ),
        el('div', { className: 'rb-debug-row' }, [
          this.button('Kill all', () => this.hooks.killAllEnemies()),
          this.button('Clear room', () => this.hooks.clearRoom()),
          this.button('Warp to exit', () => this.hooks.warpToExit()),
          this.button('Next wave', () => this.hooks.nextWave()),
        ]),
        el('div', { className: 'rb-debug-row' }, [
          this.button('Apply burn ×3', () => this.hooks.applyStatus('burn', 3)),
          this.button('Apply chill ×2', () => this.hooks.applyStatus('chill', 2)),
          this.button('Apply poison ×5', () => this.hooks.applyStatus('poison', 5)),
          this.button('Apply blind', () => this.hooks.applyStatus('blind', 1)),
        ]),
      ]),
      this.section('Boons (rare)', false, [
        el('div', { className: 'rb-debug-row' }, [
          ...boonIds.map((id) => this.button(id, () => this.hooks.giveBoon(id))),
          this.button('Clear boons', () => this.hooks.clearBoons()),
        ]),
      ]),
      this.section('Relics & shards', false, [
        el('div', { className: 'rb-debug-row' }, [
          ...relicIds.map((id) => this.button(id, () => this.hooks.giveRelic(id))),
          this.button('+100 shards', () => this.hooks.giveShards(100)),
          this.button('+200 Glut +5 dust', () => this.hooks.giveMeta(200, 5)),
        ]),
      ]),
      this.section('Spells', false, [
        el(
          'div',
          { className: 'rb-debug-row' },
          spellIds.map((id) => this.button(`Spell: ${id}`, () => this.hooks.equipSpell(id))),
        ),
        el('div', { className: 'rb-debug-row' }, [
          this.button('Spell +1 (A)', () => this.hooks.upgrade('active', 0)),
          this.button('Spell +1 (B)', () => this.hooks.upgrade('active', 1)),
          this.button('Aura +1 (A)', () => this.hooks.upgrade('aura', 0)),
          this.button('Aura +1 (B)', () => this.hooks.upgrade('aura', 1)),
          this.button('Cast +1 (A)', () => this.hooks.upgrade('cast', 0)),
          this.button('Cast +1 (B)', () => this.hooks.upgrade('cast', 1)),
        ]),
      ]),
      this.section('Cast, ultimate & evolutions', false, [
        el('div', { className: 'rb-debug-row' }, [
          this.button('Fill ultimate', () => this.hooks.fillUltimate()),
          this.button('Refill cast + spell', () => this.hooks.refillCast()),
          ...evolutionIds.map((id) =>
            this.button(`Evolve: ${id}`, () => this.hooks.giveEvolution(id)),
          ),
        ]),
      ]),
      this.section('Run log', false, [
        el('div', { className: 'rb-debug-row' }, [
          this.button('Export run log (JSON)', () => this.hooks.exportRunLog()),
        ]),
      ]),
      this.section('Stress test', false, [
        el('div', { className: 'rb-debug-row' }, [
          this.button('+100 drifters', () => this.hooks.spawnDrifters(100)),
          this.button('+500', () => this.hooks.spawnDrifters(500)),
          this.button('Clear', () => this.hooks.clearDrifters()),
        ]),
      ]),
      this.section('Run', false, [
        el('div', { className: 'rb-debug-row' }, [
          this.seedInput,
          this.button('Arena with seed', () =>
            this.hooks.restart(Number(this.seedInput.value) >>> 0),
          ),
        ]),
      ]),
      this.section('Tuning export', true, [
        el('div', { className: 'rb-debug-row' }, [
          this.button('Copy changes', () => void this.copyTuning()),
          this.button('Reset all', () => {
            resetTunables();
            this.refreshTuning();
          }),
        ]),
      ]),
      ...tunableGroups().map((g) => this.tuningSection(g)),
      el('div', { className: 'rb-debug-version', textContent: this.version }),
    ]);
    this.panel.hidden = true;
    root.append(this.fpsChip, this.panel);
    // Keep debug interaction from reaching the game's pointer handlers.
    for (const type of ['pointerdown', 'pointerup', 'pointermove', 'contextmenu']) {
      this.panel.addEventListener(type, (e) => e.stopPropagation());
    }
  }

  private section(title: string, open: boolean, children: Node[]): HTMLElement {
    const details = el('details', { className: 'rb-debug-section' }, [
      el('summary', { textContent: title }),
      ...children,
    ]);
    details.open = open;
    return details;
  }

  private button(label: string, onClick: () => void): HTMLButtonElement {
    const b = el('button', { type: 'button', textContent: label });
    b.addEventListener('click', onClick);
    return b;
  }

  private checkbox(label: string, initial: boolean, onChange: (on: boolean) => void): HTMLElement {
    const input = el('input', { type: 'checkbox', checked: initial });
    input.addEventListener('change', () => onChange(input.checked));
    return el('label', { className: 'rb-debug-row' }, [input, label]);
  }

  private slider(
    label: string,
    range: { min: number; max: number; step: number },
    value: number,
    onInput: (v: number) => void,
  ): HTMLElement {
    const out = el('span', { className: 'rb-debug-value', textContent: String(value) });
    const input = el('input', {
      type: 'range',
      min: String(range.min),
      max: String(range.max),
      step: String(range.step),
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

  private tuningSection(group: TunableGroup): HTMLElement {
    const rows = group.keys.map((key) => {
      const range = group.ranges[key] ?? { min: 0, max: 1, step: 0.01 };
      const row = this.slider(key, range, group.target[key] ?? 0, (v) => {
        group.target[key] = v;
      });
      const input = row.querySelector('input');
      const out = row.querySelector('.rb-debug-value');
      if (input && out instanceof HTMLElement) this.tuningInputs.push({ group, key, input, out });
      return row;
    });
    return this.section(`Tuning: ${group.label}`, false, rows);
  }

  private refreshTuning(): void {
    for (const { group, key, input, out } of this.tuningInputs) {
      input.value = String(group.target[key]);
      out.textContent = String(group.target[key]);
    }
  }

  private async copyTuning(): Promise<void> {
    const text = exportTunablesDiff();
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
      `tick ${stats.tick}  wave ${stats.wave}  entities ${stats.entities}  fx ${stats.particles}`,
      `seed ${stats.seed}`,
      `input ${stats.device}  pad ${stats.gamepad}`,
      `res ${stats.resolution}`,
    ].join('\n');
  }
}
