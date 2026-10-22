import { execSync } from 'node:child_process';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

// Deploy workflow sets these; local dev uses the defaults.
const base = process.env.BASE_PATH ?? '/';
const enablePwa = process.env.ENABLE_PWA === 'true';

function gitHash(): string {
  if (process.env.GIT_SHA) return process.env.GIT_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
}

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
    __GIT_HASH__: JSON.stringify(gitHash()),
  },
  build: {
    target: 'es2022',
  },
  plugins: enablePwa
    ? [
        VitePWA({
          registerType: 'autoUpdate',
          injectRegister: 'auto',
          includeAssets: ['icons/icon.svg'],
          manifest: {
            name: 'Riftbrand',
            short_name: 'Riftbrand',
            description: 'A neon action roguelike.',
            display: 'fullscreen',
            orientation: 'any',
            background_color: '#07060d',
            theme_color: '#07060d',
            icons: [
              { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
              { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
              {
                src: 'icons/icon-maskable-512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable',
              },
            ],
          },
          workbox: {
            globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
            // Branch previews live under /dev/ on the same origin; never serve them from this cache.
            navigateFallbackDenylist: [/\/dev\//],
          },
        }),
      ]
    : [],
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
  },
});
