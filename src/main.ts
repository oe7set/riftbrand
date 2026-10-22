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
