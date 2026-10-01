import { useEffect, useSyncExternalStore } from 'react';
import { useSettingsStore } from './settingsStore';

export type ResolvedTheme = 'light' | 'dark';

const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');

function subscribeToSystemTheme(onChange: () => void) {
  darkModeQuery.addEventListener('change', onChange);
  return () => darkModeQuery.removeEventListener('change', onChange);
}

/**
 * Тема, которая реально показывается на экране:
 * выбор пользователя или тема системы, если выбрано 'system'.
 */
export function useResolvedTheme(): ResolvedTheme {
  const theme = useSettingsStore((state) => state.theme);
  const systemIsDark = useSyncExternalStore(subscribeToSystemTheme, () => darkModeQuery.matches);

  if (theme === 'system') {
    return systemIsDark ? 'dark' : 'light';
  }
  return theme;
}

/**
 * Держит атрибут <html data-theme="light|dark"> в актуальном состоянии.
 * От него зависят все цвета в styles/tokens.css. Вызывается один раз в AppShell.
 */
export function useApplyTheme() {
  const resolvedTheme = useResolvedTheme();

  useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.theme === resolvedTheme) return;
    const apply = () => {
      root.dataset.theme = resolvedTheme;
    };
    // Смена темы — плавным перетеканием (View Transitions), где браузер умеет и движение не выключено
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (root.dataset.theme && !reduceMotion && 'startViewTransition' in document) document.startViewTransition(apply);
    else apply();
  }, [resolvedTheme]);
}
