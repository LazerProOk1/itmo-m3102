import { ArrowRight, Ban, Check } from 'lucide-react';
import { useState } from 'react';
import classicPalettes from 'virtual:classic-palettes';
import { Link } from 'react-router';
import { SECTIONS } from '../../app/navigation';
import { buttonClass } from '../../components/ui/Button';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { AccentPicker } from './AccentPicker';
import { Button } from '../../components/ui/Button';
import { slotsAlbum } from '../../lib/slotsAlbum';
import { ACCENTS, SHUFFLE_EVENT } from './appearance';
import { classicPreset, classicToSettings, readClassicAppearance, type AppearanceChange } from './classicAppearance';
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
];

/** Оформление: тема, акцент, эффекты. Хранится в браузере (settingsStore). */
export function AppearanceSettings() {
  const theme = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const [classicNote, setClassicNote] = useState('');
  const { accent, accent2, dynamicTheme, aurora, glow, liveBg, radius, setAppearance } = useSettingsStore();
  const album = slotsAlbum();
  // Палитры классической версии: пять — всегда, остальные открывают капсулы «Колючего куша»
  const groupPalettes = classicPalettes.palettes.filter((item) => item.base || album[`pal:${item.id}`]);
  const classicChoice = readClassicAppearance();
  const applyChange = (change: AppearanceChange) => {
    if (change.theme) setTheme(change.theme);
    setAppearance(change.patch);
    setClassicNote(change.summary.length ? `Готово: ${change.summary.join(', ')}.` : 'Там ничего не выбрано — нечего переносить.');
  };
  const lockedNote = dynamicTheme === 'off' ? undefined : 'Сейчас цвета ведёт «Динамическая тема» — выключите её ниже, чтобы выбрать свои.';

  return (
    <>
      <SettingsRow
        label="Классическая версия"
        description={classicNote || 'Оформление можно взять оттуда или сделать таким же: её палитра, без сияния и свечения.'}
      >
        <div className={styles.swatches}>
          {classicChoice && (
            <Button variant="secondary" onClick={() => applyChange(classicToSettings(classicChoice, classicPalettes.palettes))}>
              Взять мои настройки
            </Button>
          )}
          <Button variant="secondary" onClick={() => applyChange(classicPreset(classicPalettes.palettes, classicPalettes.defaultId))}>
            Оформить как там
          </Button>
        </div>
      </SettingsRow>

      <SettingsRow label="Тема" description="«Системная» повторяет оформление вашего устройства.">
        <SegmentedControl label="Тема" options={THEME_OPTIONS} value={theme} onChange={setTheme} />
      </SettingsRow>

      <SettingsRow label="Акцент" description="Цвет кнопок, выделений и свечения. Можно выбрать свой." lockedNote={lockedNote}>
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

      <SettingsRow
        label="Второй акцент"
        description="Вместе с первым даёт градиент на кнопках, выделениях и в сиянии. «Авто» — соседний по кругу оттенок, «Нет» — один сплошной цвет."
        lockedNote={lockedNote}
      >
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
          <button
            type="button"
            role="radio"
            aria-checked={accent2 === 'none'}
            aria-label="Без второго акцента"
            title="Без второго акцента"
            className={styles.swatch}
            style={{ '--swatch': 'var(--color-bg-hover)' } as React.CSSProperties}
            onClick={() => setAppearance({ accent2: 'none' })}
          >
            {accent2 === 'none' ? (
              <Check size={14} strokeWidth={3} aria-hidden />
            ) : (
              <Ban size={14} strokeWidth={2} aria-hidden className={styles.pipette} />
            )}
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

      {groupPalettes.length > 0 && (
        <SettingsRow
          label="Палитры сайта группы"
          description="Те же пары цветов, что в классической версии: акцент и второй акцент сразу. Золото, неон и аврору открывают капсулы «Колючего куша»."
          lockedNote={lockedNote}
        >
          <div className={styles.swatches} role="radiogroup" aria-label="Палитры сайта группы">
            {groupPalettes.map((item) => {
              const on = accent === item.a && accent2 === item.b;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={item.name}
                  title={item.name}
                  className={styles.swatch}
                  style={{ '--swatch': `linear-gradient(135deg, ${item.a}, ${item.b})` } as React.CSSProperties}
                  onClick={() => setAppearance({ accent: item.a, accent2: item.b })}
                >
                  {on && <Check size={14} strokeWidth={3} aria-hidden />}
                </button>
              );
            })}
          </div>
        </SettingsRow>
      )}

      <SettingsRow
        label="Динамическая тема"
        description="Сама подбирает новую пару акцентов и плавно переходит к ней: при каждом открытии, раз в 15 минут или раз в час. Пока она включена, свои акценты выше не действуют."
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
