// Fonts of the style prototype (ROADMAP M4.5), bundled so they work offline.
import '@fontsource/baloo-2/latin-700.css';
import '@fontsource/nunito/latin-400.css';
import '@fontsource/nunito/latin-800.css';
import '@fontsource/quicksand/latin-400.css';
import '@fontsource/quicksand/latin-700.css';
import { Game } from './app/game';
import { preferredLanguages } from './platform/display';
import { resolveLocale, setLocale, t } from './shared/i18n';

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app root element');

Game.start(root).catch((error: unknown) => {
  console.error(error);
  setLocale(resolveLocale(preferredLanguages()));
  const message = document.createElement('div');
  message.className = 'rb-boot-error';
  message.textContent = t('boot.error');
  root.append(message);
});
