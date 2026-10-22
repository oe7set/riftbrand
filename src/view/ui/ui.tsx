import { render } from 'preact';
import { type Screen, UiRoot } from './screens';
import { type NavDirection, navigate } from './spatial-nav';

const ARROW_KEYS: Record<string, NavDirection> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
};

/** Hosts the Preact menu screens in a DOM layer above the canvas. */
export class Ui {
  private readonly host: HTMLDivElement;
  private current: Screen = { kind: 'none' };

  constructor(parent: HTMLElement) {
    this.host = document.createElement('div');
    this.host.className = 'rb-ui';
    parent.append(this.host);
    this.host.addEventListener('keydown', (e) => {
      const dir = ARROW_KEYS[e.code];
      if (!dir) return;
      e.preventDefault();
      navigate(this.host, dir);
    });
    // Menus must not leak pointer input into the game canvas below.
    for (const type of ['pointerdown', 'pointerup', 'pointermove', 'contextmenu']) {
      this.host.addEventListener(type, (e) => e.stopPropagation());
    }
  }

  get active(): boolean {
    return this.current.kind !== 'none';
  }

  show(screen: Screen): void {
    this.current = screen;
    this.host.hidden = screen.kind === 'none';
    render(<UiRoot screen={screen} />, this.host);
  }

  /** Gamepad/keyboard navigation from the game loop. */
  navigate(dir: NavDirection): void {
    if (this.active) navigate(this.host, dir);
  }

  confirm(): void {
    const el = document.activeElement;
    if (this.active && el instanceof HTMLElement && this.host.contains(el)) el.click();
    else if (this.active) navigate(this.host, 'down');
  }
}
