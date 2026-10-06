import { motion } from 'framer-motion';
import { useState } from 'react';
import { GithubMark } from '../../components/ui/GithubMark';
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

// Сайт и данные группы лежат в одном репозитории: вторая плитка ведёт прямо к коду приложения
const GITHUB_LINKS = [
  { label: 'Репозиторий группы', href: 'https://github.com/RedstoneLord/itmo-m3102', name: 'RedstoneLord/itmo-m3102' },
  { label: 'Код приложения', href: 'https://github.com/RedstoneLord/itmo-m3102/tree/master/app', name: 'RedstoneLord/itmo-m3102 · app/' },
];

/** Шапка главной, как на сайте группы: случайное приветствие, дата, чётность недели — и ёжик. */
export function TodayHeader({ date, week }: TodayHeaderProps) {
  const [greeting] = useState(pickGreeting);
  const [text, period] = splitAccentPeriod(greeting);
  const reduceMotion = usePrefersReducedMotion();
  const runaway = greeting === RUNAWAY_GREETING;

  return (
    <header className={`${styles.header} ${runaway ? styles.free : ''} hero`}>
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
        <nav className={styles.links} aria-label="GitHub">
          {GITHUB_LINKS.map((link) => (
            <a key={link.href} className={styles.repo} href={link.href} target="_blank" rel="noreferrer" data-spot>
              <GithubMark size={18} />
              <span className={styles.repoText}>
                <span className={styles.repoLabel}>{link.label}</span>
                <span className={styles.repoName}>{link.name}</span>
              </span>
            </a>
          ))}
        </nav>
      </div>
      {/* Ёжик бегает по низу шапки, как на сайте группы; «вырвался на свободу» — бегает по всему экрану */}
      {!runaway && <HedgehogLane />}
      {runaway && <RunawayHedgehog />}
    </header>
  );
}
