import { ArrowRight, Check } from 'lucide-react';
import { Link } from 'react-router';
import { SECTIONS } from '../../app/navigation';
import { buttonClass } from '../../components/ui/Button';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { AccentPicker } from './AccentPicker';
import { ACCENTS } from './appearance';
import { useSettingsStore, type RadiusPreference } from './settingsStore';
import styles from './settings.module.css';
import { SettingsRow } from './SettingsRow';
import { THEME_OPTIONS } from './themeOptions';

const ON_OFF: { value: 'on' | 'off'; label: string }[] = [
  { value: 'on', label: 'Вкл' },
  { value: 'off', label: 'Выкл' },
];

const RADIUS_OPTIONS: { value: RadiusPreference; label: string }[] = [
  { value: 'sharp', label: 'Строгие' },
  { value: 'normal', label: 'Обычные' },
  { value: 'round', label: 'Мягкие' },
];

/** Оформление: тема, акцент, эффекты. Хранится в браузере (settingsStore). */
export function AppearanceSettings() {
  const theme = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const { accent, aurora, glow, liveBg, radius, setAppearance } = useSettingsStore();

  return (
    <>
      <SettingsRow label="Тема" description="«Системная» повторяет оформление вашего устройства.">
        <SegmentedControl label="Тема" options={THEME_OPTIONS} value={theme} onChange={setTheme} />
      </SettingsRow>

      <SettingsRow label="Акцент" description="Цвет кнопок, выделений и свечения. Можно выбрать свой.">
        <div className={styles.swatches} role="radiogroup" aria-label="Цвет акцента">
          {ACCENTS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={accent === item.id}
              aria-label={item.name}
              title={item.name}
              className={styles.swatch}
              style={{ '--swatch': item.color } as React.CSSProperties}
              onClick={() => setAppearance({ accent: item.id })}
            >
              {accent === item.id && <Check size={14} strokeWidth={3} aria-hidden />}
            </button>
          ))}
          <AccentPicker accent={accent} onChange={(value) => setAppearance({ accent: value })} />
        </div>
      </SettingsRow>

      <SettingsRow label="Фон-сияние" description="Мягкие пятна света в цвете акцента за страницей.">
        <SegmentedControl
          label="Фон-сияние"
          options={ON_OFF}
          value={aurora ? 'on' : 'off'}
          onChange={(value) => setAppearance({ aurora: value === 'on' })}
        />
      </SettingsRow>

      <SettingsRow label="Живой фон" description="Пятна сияния плавно смещаются за курсором и при прокрутке. Работает вместе с фоном-сиянием.">
        <SegmentedControl
          label="Живой фон"
          options={ON_OFF}
          value={liveBg ? 'on' : 'off'}
          onChange={(value) => setAppearance({ liveBg: value === 'on' })}
        />
      </SettingsRow>

      <SettingsRow label="Свечение" description="Подсветка и светящаяся рамка под курсором, светящиеся кнопки.">
        <SegmentedControl
          label="Свечение"
          options={ON_OFF}
          value={glow ? 'on' : 'off'}
          onChange={(value) => setAppearance({ glow: value === 'on' })}
        />
      </SettingsRow>

      <SettingsRow label="Скругления" description="Углы карточек, кнопок и полей.">
        <SegmentedControl label="Скругления" options={RADIUS_OPTIONS} value={radius} onChange={(value) => setAppearance({ radius: value })} />
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
