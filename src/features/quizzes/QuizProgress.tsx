import { useMemo } from 'react';
import { cn } from '../../lib/cn';
import { useLectureNotesStore } from '../materials/lectureNotesStore';
import { quizzesOfSubject, type QuizSource } from './quizSources';
import { useQuizStore } from './quizStore';
import styles from './QuizProgress.module.css';

/** Тест засчитан, если лучший результат — от 80% */
export const PASS_SHARE = 0.8;

export interface SubjectQuizProgress {
  sources: QuizSource[];
  total: number;
  passed: number;
  /** Средний лучший результат по пройденным хотя бы раз, 0…1 */
  average: number;
}

export function useSubjectQuizProgress(subjectId: string): SubjectQuizProgress {
  const notes = useLectureNotesStore((state) => state.lectureNotes);
  const results = useQuizStore((state) => state.results);
  return useMemo(() => {
    const sources = quizzesOfSubject(notes, subjectId);
    const best = sources.flatMap((source) => (results[source.key] ? [results[source.key]!.best] : []));
    return {
      sources,
      total: sources.length,
      passed: best.filter((share) => share >= PASS_SHARE).length,
      average: best.length ? best.reduce((sum, share) => sum + share, 0) / best.length : 0,
    };
  }, [notes, results, subjectId]);
}

/** Полоска «пройдено тестов»: засчитанные — сплошные, начатые, но не засчитанные — не учитываются */
export function QuizProgressBar({ passed, total, className }: { passed: number; total: number; className?: string }) {
  return (
    <span
      className={cn(styles.bar, className)}
      role="progressbar"
      aria-label="Пройдено тестов"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={passed}
    >
      <span style={{ width: total ? `${(passed / total) * 100}%` : 0 }} />
    </span>
  );
}
