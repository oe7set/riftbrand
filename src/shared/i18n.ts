import de from '../locales/de.json';
import en from '../locales/en.json';

/** English is the source of truth for keys; other locales must match it (see i18n.test.ts). */
export type TranslationKey = keyof typeof en;
export type Locale = 'en' | 'de';

export const LOCALES: Record<Locale, Record<TranslationKey, string>> = { en, de };

let current: Locale = 'en';

export function setLocale(locale: Locale): void {
  current = locale;
}

export function getLocale(): Locale {
  return current;
}

/** Picks the first supported locale from a browser preference list (e.g. ["de-AT", "en"]). */
export function resolveLocale(preferred: readonly string[]): Locale {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split('-')[0];
    if (base === 'de' || base === 'en') return base;
  }
  return 'en';
}

/** Replaces `{name}` placeholders with params. Falls back to English, then to the key. */
export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  let text = LOCALES[current][key] ?? LOCALES.en[key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}
