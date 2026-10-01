import { Hedgehog, HedgehogSvg } from '../../components/hedgehog/Hedgehog';
import { Section } from '../../components/ui/Section';
import { GREETINGS, splitAccentPeriod } from '../../data/greetings';
import logoUrl from '../../../img/logo-t.png';
import { Demo } from './Demo';
import styles from './DesignSystemPage.module.css';

/** Бренд М3102: логотип, ёжик-маскот, приветствия главной. */
export function BrandDemo() {
  const [text, period] = splitAccentPeriod(GREETINGS[0]!);
  return (
    <Section title="Бренд">
      <Demo label="Логотип · маска, красится в цвет текста">
        <span className={styles.logo} style={{ maskImage: `url(${logoUrl})` }} aria-label="ITMO | M3102" />
        <span className={`${styles.logo} ${styles.logoAccent}`} style={{ maskImage: `url(${logoUrl})` }} aria-hidden />
      </Demo>
      <Demo label="Ёжик · клик — сальто">
        <Hedgehog size={96} />
        <HedgehogSvg size={64} running />
        <span className={styles.caption}>&lt;Hedgehog /&gt; · &lt;HedgehogSvg running /&gt;</span>
      </Demo>
      <Demo label="Приветствие главной · одиночная точка — акцентом">
        <p className={styles.greeting}>
          {text}
          <span className={styles.greetingPeriod}>{period}</span>
        </p>
        <span className={styles.caption}>src/data/greetings.ts · {GREETINGS.length} строк</span>
      </Demo>
    </Section>
  );
}
