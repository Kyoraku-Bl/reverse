import { useCallback, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { translate, type Lang, type TKey } from '../i18n';

export function useI18n() {
  const lang = useAppStore((state) => state.settings.lang);
  const theme = useAppStore((state) => state.settings.theme);
  const setSettings = useAppStore((state) => state.setSettings);

  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const t = useCallback((key: TKey) => translate(key, lang), [lang]);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = dir;
  }, [lang, dir]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#06060b' : '#ffffff');
  }, [theme]);

  const setLang = useCallback((next: Lang) => setSettings({ lang: next }), [setSettings]);
  const toggleTheme = useCallback(
    () => setSettings({ theme: theme === 'dark' ? 'light' : 'dark' }),
    [setSettings, theme],
  );

  return { t, lang, dir, setLang, theme, toggleTheme };
}
