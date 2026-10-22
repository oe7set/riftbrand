import { describe, expect, it } from 'vitest';
import { LOCALES, resolveLocale, setLocale, t } from './i18n';

describe('i18n', () => {
  it('has the same keys in every locale', () => {
    const base = Object.keys(LOCALES.en).sort();
    for (const [locale, table] of Object.entries(LOCALES)) {
      expect(Object.keys(table).sort(), locale).toEqual(base);
    }
  });

  it('has no empty translations', () => {
    for (const table of Object.values(LOCALES)) {
      for (const value of Object.values(table)) expect(value.trim()).not.toBe('');
    }
  });

  it('resolves browser languages', () => {
    expect(resolveLocale(['de-AT', 'en'])).toBe('de');
    expect(resolveLocale(['fr-FR', 'en-US'])).toBe('en');
    expect(resolveLocale(['ja'])).toBe('en');
  });

  it('translates with the active locale', () => {
    setLocale('de');
    expect(t('pause.title')).toBe('Pausiert');
    setLocale('en');
    expect(t('pause.title')).toBe('Paused');
  });
});
