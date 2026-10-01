import { Moon, Sun } from 'lucide-react';
import { useSettingsStore } from '../../features/settings/settingsStore';
import { useResolvedTheme } from '../../features/settings/theme';
import { IconButton } from '../ui/IconButton';

/** Кнопка переключения светлой / тёмной темы. */
export function ThemeToggle() {
  const resolvedTheme = useResolvedTheme();
  const setTheme = useSettingsStore((state) => state.setTheme);
  const isDark = resolvedTheme === 'dark';

  return (
    <IconButton
      icon={isDark ? Sun : Moon}
      label={isDark ? 'Включить светлую тему' : 'Включить тёмную тему'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    />
  );
}
