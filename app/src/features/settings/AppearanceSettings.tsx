import { ArrowRight, Check } from 'lucide-react';
import { Link } from 'react-router';
import { SECTIONS } from '../../app/navigation';
import { buttonClass } from '../../components/ui/Button';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { AccentPicker } from './AccentPicker';
import { Button } from '../../components/ui/Button';
import { ACCENTS, SHUFFLE_EVENT } from './appearance';
import { useSettingsStore, type DynamicTheme, type RadiusPreference } from './settingsStore';
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

const DYNAMIC_OPTIONS: { value: DynamicTheme; label: string }[] = [
  { value: 'off', label: 'Выкл' },
  { value: 'launch', label: 'Запуск' },
  { value: '15', label: '15 мин' },
  { value: '60', label: 'Час' },
  { value: 'random', label: 'Случайно' },
];

/** Оформление: тема, акцент, эффекты. Хранится в браузере (settingsStore). */
export function AppearanceSettings() {
  const theme = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const { accent, accent2, dynamicTheme, aurora, glow, liveBg, radius, setAppearance } = useSettingsStore();

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

      <SettingsRow label="Второй акцент" description="Вместе с первым даёт градиент на кнопках и в сиянии. «Авто» — соседний по кругу оттенок.">
        <div className={styles.swatches} role="radiogroup" aria-label="Второй акцент">
          <button
            type="button"
            role="radio"
            aria-checked={accent2 === 'auto'}
            aria-label="Авто"
            title="Авто"
            className={styles.swatch}
            style={{ '--swatch': 'var(--accent-gradient)' } as React.CSSProperties}
            onClick={() => setAppearance({ accent2: 'auto' })}
          >
            {accent2 === 'auto' && <Check size={14} strokeWidth={3} aria-hidden />}
          </button>
          {ACCENTS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={accent2 === item.id}
              aria-label={item.name}
              title={item.name}
              className={styles.swatch}
              style={{ '--swatch': item.color } as React.CSSProperties}
              onClick={() => setAppearance({ accent2: item.id })}
            >
              {accent2 === item.id && <Check size={14} strokeWidth={3} aria-hidden />}
            </button>
          ))}
        </div>
      </SettingsRow>

      <SettingsRow
        label="Динамическая тема"
        description="Сама подбирает новую пару акцентов и плавно переходит к ней: при каждом открытии, раз в 15 минут, раз в час или через случайное время. Свои акценты выше на это время не действуют."
      >
        <SegmentedControl
          label="Динамическая тема"
          options={DYNAMIC_OPTIONS}
          value={dynamicTheme}
          onChange={(value) => setAppearance({ dynamicTheme: value })}
        />
        {dynamicTheme !== 'off' && (
          <Button variant="secondary" size="sm" onClick={() => dispatchEvent(new Event(SHUFFLE_EVENT))}>
            Сменить сейчас
          </Button>
        )}
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
