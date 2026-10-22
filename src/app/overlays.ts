import { boonById, boonDescParams } from '../content/boons';
import { BEINGS } from '../content/boons/beings';
import { relicById, relicDescParams } from '../content/relics';
import type { InputDevice } from '../platform/input/input-manager';
import type { Settings } from '../platform/storage/settings';
import { type TranslationKey, t } from '../shared/i18n';
import type { OwnedBoon, OwnedRelic } from '../sim/effects/build';

export interface BuildSummary {
  boons: readonly OwnedBoon[];
  relics: readonly OwnedRelic[];
  shards: number;
}

function div(className: string, text = ''): HTMLDivElement {
  const el = document.createElement('div');
  el.className = className;
  el.textContent = text;
  return el;
}

/** Keeps overlay interactions from reaching the game's pointer handlers. */
function isolate(el: HTMLElement): void {
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'contextmenu']) {
    el.addEventListener(type, (e) => e.stopPropagation());
  }
}

/** Pause screen with resume and the settings panel (GDD §13). */
export class PauseOverlay {
  private readonly root = div('rb-overlay rb-pause');
  private readonly title = div('rb-overlay-title');
  private readonly hint = div('rb-overlay-hint');
  private readonly settingsBox = div('rb-settings');
  private readonly buildBox = div('rb-settings rb-build');
  private readonly resume = document.createElement('button');
  private readonly toTitle = document.createElement('button');
  private readonly debug = document.createElement('button');

  constructor(
    parent: HTMLElement,
    actions: { resume(): void; toTitle(): void; toggleDebug(): void },
    private readonly settings: Settings,
    private readonly onSettingsChange: (s: Settings) => void,
  ) {
    this.resume.type = 'button';
    this.resume.className = 'rb-button rb-primary';
    this.resume.addEventListener('click', actions.resume);
    this.toTitle.type = 'button';
    this.toTitle.className = 'rb-button';
    this.toTitle.addEventListener('click', actions.toTitle);
    // A visible way into the debug menu; the three-finger tap is easy to miss on phones.
    this.debug.type = 'button';
    this.debug.className = 'rb-button rb-small';
    this.debug.addEventListener('click', actions.toggleDebug);
    const row = div('rb-row');
    row.append(this.toTitle, this.debug);
    this.root.append(this.title, this.resume, this.hint, this.buildBox, this.settingsBox, row);
    this.root.hidden = true;
    isolate(this.root);
    parent.append(this.root);
  }

  private buildSettings(): void {
    const s = this.settings;
    const box = this.settingsBox;
    box.replaceChildren(div('rb-settings-title', t('settings.title')));
    const slider = (
      label: string,
      key: 'masterVolume' | 'sfxVolume' | 'shake' | 'flashes' | 'vibration',
    ) => {
      const input = document.createElement('input');
      input.type = 'range';
      input.min = '0';
      input.max = '1';
      input.step = '0.05';
      input.value = String(s[key]);
      input.addEventListener('input', () => {
        s[key] = Number(input.value);
        this.onSettingsChange(s);
      });
      const row = document.createElement('label');
      row.className = 'rb-setting';
      row.append(div('rb-setting-label', label), input);
      box.append(row);
    };
    slider(t('settings.master_volume'), 'masterVolume');
    slider(t('settings.sfx_volume'), 'sfxVolume');
    slider(t('settings.shake'), 'shake');
    slider(t('settings.flashes'), 'flashes');
    slider(t('settings.vibration'), 'vibration');

    const numbers = document.createElement('input');
    numbers.type = 'checkbox';
    numbers.checked = s.damageNumbers;
    numbers.addEventListener('change', () => {
      s.damageNumbers = numbers.checked;
      this.onSettingsChange(s);
    });
    const numbersRow = document.createElement('label');
    numbersRow.className = 'rb-setting rb-setting-inline';
    numbersRow.append(numbers, div('rb-setting-label', t('settings.damage_numbers')));
    box.append(numbersRow);

    const quality = document.createElement('select');
    for (const value of ['high', 'low'] as const) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = t(value === 'high' ? 'settings.quality_high' : 'settings.quality_low');
      quality.append(option);
    }
    quality.value = s.quality;
    quality.addEventListener('change', () => {
      s.quality = quality.value === 'low' ? 'low' : 'high';
      this.onSettingsChange(s);
    });
    const qualityRow = document.createElement('label');
    qualityRow.className = 'rb-setting';
    qualityRow.append(div('rb-setting-label', t('settings.quality')), quality);
    box.append(qualityRow);
  }

  /** Build overview (ROADMAP M2.3): every boon and relic with its current effect. */
  private buildOverview(build: BuildSummary): void {
    const box = this.buildBox;
    box.replaceChildren(
      div('rb-settings-title', t('build.title')),
      div('rb-build-shards', t('build.shards', { n: build.shards })),
    );
    const section = (title: string, rows: HTMLElement[]) => {
      box.append(div('rb-build-heading', title));
      if (rows.length === 0) box.append(div('rb-build-empty', t('build.empty')));
      for (const row of rows) box.append(row);
    };
    const row = (name: string, meta: string, desc: string, color: string) => {
      const el = div('rb-build-row');
      const head = div('rb-build-name', name);
      head.style.color = color;
      el.append(head, div('rb-build-meta', meta), div('rb-build-desc', desc));
      return el;
    };
    section(
      t('build.boons'),
      build.boons.flatMap((b) => {
        const def = boonById(b.id);
        if (!def) return [];
        return [
          row(
            t(`boon.${b.id}.name` as TranslationKey),
            `${t(`rarity.${b.rarity}` as TranslationKey)} · ${t(`slot.${def.slot}` as TranslationKey)}`,
            t(`boon.${b.id}.desc` as TranslationKey, boonDescParams(def, b.rarity)),
            BEINGS[def.being].css,
          ),
        ];
      }),
    );
    section(
      t('build.relics'),
      build.relics.flatMap((r) => {
        const def = relicById(r.id);
        if (!def) return [];
        return [
          row(
            `${t(`relic.${r.id}.name` as TranslationKey)}${r.stacks > 1 ? ` ×${r.stacks}` : ''}`,
            t(`relic_rarity.${def.rarity}` as TranslationKey),
            t(`relic.${r.id}.desc` as TranslationKey, relicDescParams(def, r.stacks)),
            def.rarity === 'curse' ? '#ff6b81' : '#ffe6b0',
          ),
        ];
      }),
    );
  }

  show(device: InputDevice, build: BuildSummary): void {
    this.buildOverview(build);
    this.title.textContent = t('pause.title');
    this.resume.textContent = t('pause.resume');
    this.toTitle.textContent = t('pause.to_title');
    this.debug.textContent = t('pause.debug');
    this.hint.textContent =
      device === 'touch'
        ? ''
        : device === 'gamepad'
          ? t('pause.resume_gamepad')
          : t('pause.resume_keyboard');
    this.buildSettings();
    this.root.hidden = false;
    this.resume.focus({ preventScroll: true });
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  get element(): HTMLElement {
    return this.root;
  }

  hide(): void {
    this.root.hidden = true;
  }
}

/** "You fell" screen with run stats and a restart prompt. */
export class DeathOverlay {
  private readonly root = div('rb-overlay rb-death');
  private readonly title = div('rb-overlay-title');
  private readonly stats = div('rb-overlay-stats');
  private readonly hint = div('rb-overlay-hint');
  /** Ignore input briefly so a mashed attack doesn't skip the screen instantly. */
  private armedAtMs = 0;

  constructor(
    parent: HTMLElement,
    private readonly onRestart: () => void,
  ) {
    this.root.append(this.title, this.stats, this.hint);
    this.root.hidden = true;
    isolate(this.root);
    this.root.addEventListener('pointerup', () => this.tryRestart());
    parent.append(this.root);
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  show(stats: string, device: InputDevice, nowMs: number): void {
    this.title.textContent = t('death.title');
    this.stats.textContent = stats;
    this.hint.textContent =
      device === 'touch'
        ? t('death.restart_touch')
        : device === 'gamepad'
          ? t('death.restart_gamepad')
          : t('death.restart_keyboard');
    this.armedAtMs = nowMs + 900;
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }

  tryRestart(): void {
    if (this.root.hidden || performance.now() < this.armedAtMs) return;
    this.onRestart();
  }
}
