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
    document.documentElement.dataset.theme = resolvedTheme;
  }, [resolvedTheme]);
}
