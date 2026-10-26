import { t } from '../shared/i18n';

/**
 * "A new version is ready" (installed app, PWA). A small note at the bottom: the player picks
 * the moment, since reloading restarts the current room from its entry. The pause menu offers
 * the same button for gamepad players.
 */
export class UpdateToast {
  private readonly root = document.createElement('div');
  private readonly text = document.createElement('div');
  private readonly reload = document.createElement('button');
  private readonly later = document.createElement('button');
  private apply: (() => void) | null = null;

  constructor(parent: HTMLElement) {
    this.root.className = 'rb-update';
    this.root.setAttribute('role', 'status');
    this.text.className = 'rb-update-text';
    this.reload.type = 'button';
    this.reload.className = 'rb-button rb-primary rb-small';
    this.reload.addEventListener('click', () => this.apply?.());
    this.later.type = 'button';
    this.later.className = 'rb-button rb-small';
    this.later.addEventListener('click', () => this.hide());
    const row = document.createElement('div');
    row.className = 'rb-row';
    row.append(this.reload, this.later);
    this.root.append(this.text, row);
    this.root.hidden = true;
    for (const type of ['pointerdown', 'pointermove', 'pointerup']) {
      this.root.addEventListener(type, (e) => e.stopPropagation());
    }
    parent.append(this.root);
  }

  /** The update that is waiting, if any (the pause menu offers it too). */
  get pending(): (() => void) | null {
    return this.apply;
  }

  show(apply: () => void): void {
    this.apply = apply;
    this.text.textContent = t('update.ready');
    this.reload.textContent = t('update.reload');
    this.later.textContent = t('update.later');
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }
}
