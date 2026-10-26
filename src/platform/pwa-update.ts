import { registerSW } from 'virtual:pwa-register';

/** How often an open game asks the server for a new version (installed PWAs stay open for days). */
const CHECK_INTERVAL_MS = 30 * 60 * 1000;

/**
 * Update checks for the installed app (PWA). The browser only looks for a new service worker
 * on navigation, so a game that stays open would never notice an update. This checks on start,
 * every half hour and whenever the app comes back to the foreground. A found update waits until
 * the player agrees: `onReady` gets a function that activates it and reloads.
 */
export function watchForUpdates(onReady: (apply: () => void) => void): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      onReady(() => {
        void updateSW(true);
      });
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => {
        if (!navigator.onLine || registration.installing) return;
        registration.update().catch(() => {
          // Offline or the server hiccuped; the next check tries again.
        });
      };
      window.setInterval(check, CHECK_INTERVAL_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
      window.addEventListener('online', check);
    },
  });
}
