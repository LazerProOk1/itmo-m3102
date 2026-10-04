import { motion } from 'framer-motion';
import { useState } from 'react';
import { HedgehogLane } from '../../components/hedgehog/HedgehogLane';
import { RunawayHedgehog } from '../../components/hedgehog/RunawayHedgehog';
import { pickGreeting, RUNAWAY_GREETING, splitAccentPeriod } from '../../data/greetings';
import { formatFullDate, getWeekdayName } from '../../lib/dates';
import { SPRING_SMOOTH, usePrefersReducedMotion } from '../../lib/motion';
import { WEEK_PARITY_LABELS, type StudyWeek } from '../../lib/studyWeek';
import type { ISODate } from '../../types/models';
import { isVacation } from '../schedule/occurrences';
import styles from './TodayHeader.module.css';

interface TodayHeaderProps {
  date: ISODate;
  week: StudyWeek;
}

/** Шапка главной, как на сайте группы: случайное приветствие, дата, чётность недели — и ёжик. */
export function TodayHeader({ date, week }: TodayHeaderProps) {
  const [greeting] = useState(pickGreeting);
  const [text, period] = splitAccentPeriod(greeting);
  const reduceMotion = usePrefersReducedMotion();
  const runaway = greeting === RUNAWAY_GREETING;

  return (
    <header className={`${styles.header} hero`}>
      <div className={styles.copy}>
        <motion.h1
          key={greeting}
          className={`${styles.title} hero-title`}
          initial={reduceMotion ? false : { opacity: 0, y: 12, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transition: SPRING_SMOOTH }}
        >
          {text}
          {period && <span className={styles.period}>{period}</span>}
        </motion.h1>
        <p className={styles.sub}>Всё важное для группы М3102 — в одном месте.</p>
        <div className={styles.date}>
          <strong>
            {getWeekdayName(date)}, {formatFullDate(date)}
          </strong>
          <span className={styles.chip}>{isVacation(date) ? 'Каникулы' : WEEK_PARITY_LABELS[week.weekInCycle]}</span>
        </div>
      </div>
      {/* Ёжик бегает по низу шапки, как на сайте группы; «вырвался на свободу» — бежит по низу экрана */}
      {!runaway && <HedgehogLane />}
      {runaway && <RunawayHedgehog />}
    </header>
  );
}
