import { Monitor, Moon, Sun } from 'lucide-react';
import type { SegmentedOption } from '../../components/ui/SegmentedControl';
import type { ThemePreference } from '../../types/models';

/** Варианты темы — одни и те же в меню пользователя и в настройках */
export const THEME_OPTIONS: SegmentedOption<ThemePreference>[] = [
  { value: 'light', label: 'Светлая', icon: Sun },
  { value: 'dark', label: 'Тёмная', icon: Moon },
  { value: 'system', label: 'Системная', icon: Monitor },
];
