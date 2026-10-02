import { motion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Section } from '../../components/ui/Section';
import { SegmentedControl, type SegmentedOption } from '../../components/ui/SegmentedControl';
import { Swap, useDirection } from '../../components/ui/Swap';
import { SPRING_PLAYFUL, SPRING_SMOOTH, SPRING_SNAPPY } from '../../lib/motion';
import { Demo } from './Demo';
import styles from './DesignSystemPage.module.css';

const SPRINGS = [
  { name: 'SPRING_SNAPPY', spring: SPRING_SNAPPY, usage: 'кнопки, подсветки меню и вкладок, поповеры' },
  { name: 'SPRING_SMOOTH', spring: SPRING_SMOOTH, usage: 'появление страниц, панелей, перелистывание' },
  { name: 'SPRING_PLAYFUL', spring: SPRING_PLAYFUL, usage: 'игривые акценты — ёжик, отметки' },
];

type Week = 'prev' | 'now' | 'next';
const WEEKS: SegmentedOption<Week>[] = [
  { value: 'prev', label: '21–27 сен' },
  { value: 'now', label: '28 сен – 4 окт' },
  { value: 'next', label: '5–11 окт' },
];

/** Движение: пружины, перелистывание содержимого, каскад карточек. Всё уважает «уменьшить движение». */
export function MotionDemo() {
  const [moved, setMoved] = useState(false);
  const [week, setWeek] = useState<Week>('now');
  const direction = useDirection(WEEKS.findIndex((item) => item.value === week));
  const [replay, setReplay] = useState(0);

  return (
    <Section title="Движение">
      {SPRINGS.map(({ name, spring, usage }) => (
        <Demo key={name} label={usage}>
          <div className={styles.track} onClick={() => setMoved((value) => !value)}>
            <motion.span className={styles.dot} animate={{ x: moved ? 160 : 0 }} transition={spring} />
          </div>
          <span className={styles.caption}>{name}</span>
        </Demo>
      ))}
      <Demo label="Перелистывание · &lt;Swap&gt; — неделя расписания, вкладки, шаги конспектов">
        <div className={styles.stack}>
          <SegmentedControl label="Неделя" options={WEEKS} value={week} onChange={setWeek} />
          <Swap id={week} direction={direction} className={styles.swapCard}>
            {WEEKS.find((item) => item.value === week)!.label}
          </Swap>
        </div>
      </Demo>
      <Demo label='Каскад · className="stagger" на сетке карточек'>
        <div className={styles.stack}>
          <div key={replay} className={`${styles.staggerGrid} stagger`}>
            {Array.from({ length: 6 }, (_, index) => (
              <span key={index} className={styles.staggerCell}>
                {String(index + 1).padStart(2, '0')}
              </span>
            ))}
          </div>
          <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => setReplay((value) => value + 1)}>
            Повторить
          </Button>
        </div>
      </Demo>
    </Section>
  );
}
