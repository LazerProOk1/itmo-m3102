import type { CSSProperties } from 'react';
import { Button } from '../../components/ui/Button';
import { Section } from '../../components/ui/Section';
import { ACCENTS, SHUFFLE_EVENT } from '../settings/appearance';
import { useSettingsStore } from '../settings/settingsStore';
import { Demo } from './Demo';
import styles from './DesignSystemPage.module.css';

/** «Сияние»: акценты, свечение карточек и кнопок, фон. Всё переключается в «Настройки → Оформление». */
export function AppearanceDemo() {
  const { accent, accent2, dynamicTheme, setAppearance } = useSettingsStore();

  return (
    <Section title="Оформление и свет">
      <Demo label="Акцент · --accent-base, оттенки считаются в tokens.css через color-mix">
        <div className={styles.accentRow}>
          {ACCENTS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={styles.accentChip}
              data-active={accent === item.id}
              style={{ '--chip': item.color } as CSSProperties}
              onClick={() => setAppearance({ accent: item.id })}
            >
              <span />
              {item.name}
            </button>
          ))}
        </div>
      </Demo>
      <Demo label="Второй акцент · --accent-base-2: вместе с первым даёт градиент (--accent-gradient — кнопки primary, полосы прогресса, отметки; --accent-soft-gradient — выбранный пункт меню). «Авто» — первый цвет, повёрнутый по оттенку">
        <div className={styles.accentRow}>
          <button
            type="button"
            className={styles.accentChip}
            data-active={accent2 === 'auto'}
            style={{ '--chip': 'var(--accent-gradient)' } as CSSProperties}
            onClick={() => setAppearance({ accent2: 'auto' })}
          >
            <span />
            Авто
          </button>
          {ACCENTS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={styles.accentChip}
              data-active={accent2 === item.id}
              style={{ '--chip': item.color } as CSSProperties}
              onClick={() => setAppearance({ accent2: item.id })}
            >
              <span />
              {item.name}
            </button>
          ))}
        </div>
        <div className={styles.gradientStrip} />
        <div className={styles.gradientSoft} />
        <div className={styles.glowRow}>
          <Button variant="primary">Кнопка с градиентом</Button>
        </div>
      </Demo>
      <Demo label="Динамическая тема · settings/appearance.ts: новая пара акцентов (OKLCH, оттенки на 35–90° друг от друга) при запуске, раз в 15 минут, раз в час или через случайное время; переход плавный (@property)">
        <div className={styles.glowRow}>
          <Button
            variant="secondary"
            onClick={() => {
              if (dynamicTheme === 'off') setAppearance({ dynamicTheme: 'launch' });
              else dispatchEvent(new Event(SHUFFLE_EVENT));
            }}
          >
            {dynamicTheme === 'off' ? 'Включить (при запуске)' : 'Сменить пару сейчас'}
          </Button>
          {dynamicTheme !== 'off' && (
            <Button variant="ghost" onClick={() => setAppearance({ dynamicTheme: 'off' })}>
              Выключить
            </Button>
          )}
        </div>
      </Demo>
      <Demo label="Свечение · data-spot: подсветка под курсором и граница в цвет акцента (наведите)">
        <div className={styles.glowRow}>
          {['Конспекты', 'Записи лекций', 'Лабораторные'].map((name, index) => (
            <div key={name} className={styles.glowCard} data-spot>
              <span className={styles.glowIndex}>{String(index + 1).padStart(2, '0')}</span>
              <strong>{name}</strong>
              <small>Карточка с подсветкой</small>
            </div>
          ))}
        </div>
      </Demo>
      <Demo label="Кнопки · главная — объёмный градиент с бликом и свечением">
        <Button variant="primary">Главное действие</Button>
        <Button variant="secondary">Обычное</Button>
        <Button variant="ghost">Тихое</Button>
      </Demo>
      <Demo label="Фон-сияние · пятна света, сетка и зерно за страницей (styles/aurora.css), заголовок главной — .hero-title">
        <p className={`${styles.heroDemo} hero-title`}>
          Архимедовость достигнута<span>.</span>
        </p>
      </Demo>
    </Section>
  );
}
