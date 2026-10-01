import { Section } from '../../components/ui/Section';
import { Demo } from './Demo';
import styles from './DesignSystemPage.module.css';

const TYPE_SCALE = [
  { token: '--text-lg', weight: 600, usage: 'Заголовок страницы · 22px' },
  { token: '--text-md', weight: 600, usage: 'Заголовок блока и окна · 16px' },
  { token: '--text-base', weight: 400, usage: 'Основной текст · 14px' },
  { token: '--text-sm', weight: 400, usage: 'Вторичный текст, меню · 13px' },
  { token: '--text-xs', weight: 400, usage: 'Строка мета-данных · 12px' },
  { token: '--text-2xs', weight: 600, usage: 'Подпись раздела · 11px' },
];

const COLOR_GROUPS = [
  { label: 'Поверхности', tokens: ['--color-bg', '--color-bg-subtle', '--color-bg-hover', '--color-bg-elevated'] },
  { label: 'Границы', tokens: ['--color-border', '--color-border-strong', '--color-border-hover'] },
  { label: 'Текст', tokens: ['--color-text', '--color-text-secondary', '--color-text-muted'] },
  { label: 'Акцент и статусы', tokens: ['--color-accent', '--color-accent-soft', '--color-success', '--color-warning', '--color-danger'] },
  {
    label: 'Типы занятий',
    tokens: ['--color-lecture', '--color-practice', '--color-lab', '--color-consultation'],
  },
];

const SPACING_STEPS = [1, 2, 3, 4, 6, 8, 10, 12, 16];
const RADII = ['--radius-sm', '--radius-md', '--radius-lg'];

/** Основы: типографика, цвета, отступы, скругления. */
export function FoundationsDemo() {
  return (
    <>
      <Section title="Типографика">
        {TYPE_SCALE.map(({ token, weight, usage }) => (
          <Demo key={token} label={usage}>
            <p className={styles.typeSample} style={{ fontSize: `var(${token})`, fontWeight: weight }}>
              Отчёт по лабораторной работе
            </p>
            <span className={styles.caption}>{token}</span>
          </Demo>
        ))}
      </Section>

      <Section title="Цвета">
        {COLOR_GROUPS.map((group) => (
          <Demo key={group.label} label={group.label}>
            <div className={styles.swatches}>
              {group.tokens.map((token) => (
                <div key={token} className={styles.swatch}>
                  <span className={styles.swatchColor} style={{ background: `var(${token})` }} />
                  <span className={styles.caption}>{token}</span>
                </div>
              ))}
            </div>
          </Demo>
        ))}
      </Section>

      <Section title="Отступы и скругления">
        <Demo label="Отступы · сетка 4px">
          <div className={styles.spacingList}>
            {SPACING_STEPS.map((step) => (
              <div key={step} className={styles.spacingRow}>
                <span className={styles.caption}>--space-{step}</span>
                <span className={styles.spacingBar} style={{ width: `var(--space-${step})` }} />
              </div>
            ))}
          </div>
        </Demo>
        <Demo label="Скругление">
          {RADII.map((token) => (
            <span key={token} className={styles.radiusBox} style={{ borderRadius: `var(${token})` }}>
              {token.replace('--radius-', '')}
            </span>
          ))}
        </Demo>
      </Section>
    </>
  );
}
