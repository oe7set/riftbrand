import type { InputDevice } from '../platform/input/input-manager';
import { t } from '../shared/i18n';

export class PauseOverlay {
  private readonly root: HTMLElement;
  private readonly title: HTMLElement;
  private readonly hint: HTMLElement;

  constructor(parent: HTMLElement, onResume: () => void) {
    this.root = document.createElement('div');
    this.root.className = 'rb-pause';
    this.title = document.createElement('div');
    this.title.className = 'rb-pause-title';
    this.hint = document.createElement('div');
    this.hint.className = 'rb-pause-hint';
    this.root.append(this.title, this.hint);
    this.root.hidden = true;
    this.root.addEventListener('pointerup', (e) => {
      e.stopPropagation();
      onResume();
    });
    parent.append(this.root);
  }

  show(device: InputDevice): void {
    this.title.textContent = t('pause.title');
    this.hint.textContent =
      device === 'touch'
        ? t('pause.resume_touch')
        : device === 'gamepad'
          ? t('pause.resume_gamepad')
          : t('pause.resume_keyboard');
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }
}
