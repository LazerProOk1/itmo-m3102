import type { CSSProperties } from 'react';
import { Button } from '../../components/ui/Button';
import { Section } from '../../components/ui/Section';
import { ACCENTS } from '../settings/appearance';
import { useSettingsStore } from '../settings/settingsStore';
import { Demo } from './Demo';
import styles from './DesignSystemPage.module.css';

/** «Сияние»: акценты, свечение карточек и кнопок, фон. Всё переключается в «Настройки → Оформление». */
export function AppearanceDemo() {
  const { accent, setAppearance } = useSettingsStore();

  return (
    <Section title="Оформление и свет">
      <Demo label="Акцент · один цвет --accent-base, оттенки считаются в tokens.css через color-mix">
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
