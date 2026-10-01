import { useState } from 'react';
import { cn } from '../../lib/cn';
import { formatFullDate, getWeekdayName } from '../../lib/dates';
import { WEEK_PARITY_LABELS, type StudyWeek } from '../../lib/studyWeek';
import type { ISODate } from '../../types/models';
import { isVacation } from '../schedule/occurrences';
import styles from './TodayHeader.module.css';

interface TodayHeaderProps {
  date: ISODate;
  week: StudyWeek;
}

// Модульная переменная, а не состояние: должна пережить уход с главной и возврат на неё,
// чтобы reveal-анимация сыграла один раз за сессию.
let hasRevealed = false;

/** Шапка главной, как на сайте группы: «Ваш учебный день.», дата и чётность недели. */
export function TodayHeader({ date, week }: TodayHeaderProps) {
  const [shouldReveal] = useState(() => !hasRevealed);
  if (!hasRevealed) hasRevealed = true;

  return (
    <header className={styles.header}>
      <div>
        <h1 className={cn(styles.title, shouldReveal && styles.reveal)}>
          Ваш учебный день<span className={styles.period}>.</span>
        </h1>
        <p className={styles.sub}>Всё важное для группы М3102 — в одном месте.</p>
      </div>
      <div className={styles.date}>
        <strong>
          {getWeekdayName(date)}, {formatFullDate(date)}
        </strong>
        <span>{isVacation(date) ? 'Каникулы' : WEEK_PARITY_LABELS[week.weekInCycle]}</span>
      </div>
    </header>
  );
}
