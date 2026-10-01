import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import { SECTIONS } from '../../app/navigation';
import { buttonClass } from '../../components/ui/Button';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { useSettingsStore } from './settingsStore';
import { SettingsRow } from './SettingsRow';
import { THEME_OPTIONS } from './themeOptions';

/** Оформление. Тема сохраняется в localStorage. */
export function AppearanceSettings() {
  const theme = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);

  return (
    <>
      <SettingsRow label="Тема" description="«Системная» повторяет оформление вашего устройства.">
        <SegmentedControl label="Тема" options={THEME_OPTIONS} value={theme} onChange={setTheme} />
      </SettingsRow>

      <SettingsRow label="Дизайн-система" description="Все компоненты интерфейса на одной странице.">
        <Link to={SECTIONS.design.path} className={buttonClass('secondary', 'sm')}>
          Открыть
          <ArrowRight size={14} strokeWidth={1.75} aria-hidden />
        </Link>
      </SettingsRow>
    </>
  );
}
