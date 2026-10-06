import { useEffect, useState } from 'react';
import { QuizRunner } from '../../components/quiz/Quiz';
import { parseQuiz, type QuizData } from '../../components/quiz/parseQuiz';
import { toISODate } from '../../lib/dates';
import { loadQuizByKey } from './quizSources';
import { useQuizStore } from './quizStore';

/** Какие вопросы взять: все вопросы теста или только указанные номера */
export interface QuizPick {
  key: string;
  indices?: number[];
}

interface Origin {
  key: string;
  index: number;
}

function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}

interface CombinedQuizProps {
  picks: QuizPick[];
  title: string;
  description?: string;
  /** Не больше стольких вопросов (случайные) */
  limit?: number;
}

/**
 * Вопросы из нескольких тестов одним прохождением — повторение ошибок и тест перед контрольной.
 * Каждый ответ записывается в повторение исходного вопроса: ошибся здесь — вопрос вернётся завтра.
 */
export function CombinedQuiz({ picks, title, description = '', limit }: CombinedQuizProps) {
  const recordAnswer = useQuizStore((state) => state.recordAnswer);
  const [built, setBuilt] = useState<{ data: QuizData; origins: Origin[] } | null>(null);
  const picksKey = JSON.stringify(picks);

  useEffect(() => {
    let alive = true;
    void Promise.all(
      picks.map(async (pick) => {
        const source = await loadQuizByKey(pick.key);
        if (!source) return [];
        try {
          const questions = parseQuiz(source).questions;
          const indices = pick.indices ?? questions.map((_, index) => index);
          return indices.filter((index) => questions[index]).map((index) => ({ question: questions[index]!, origin: { key: pick.key, index } }));
        } catch {
          return [];
        }
      }),
    ).then((groups) => {
      if (!alive) return;
      const items = shuffle(groups.flat()).slice(0, limit);
      setBuilt({ data: { title, description, questions: items.map((item) => item.question) }, origins: items.map((item) => item.origin) });
    });
    return () => {
      alive = false;
    };
    // picksKey — содержимое picks: сам массив новый при каждой отрисовке родителя
  }, [picksKey, title, description, limit]);

  if (!built) return null;
  if (!built.data.questions.length) return null;
  return (
    <QuizRunner
      data={built.data}
      full
      onAnswer={(index, ok) => {
        const origin = built.origins[index];
        if (origin) recordAnswer(origin.key, origin.index, ok, toISODate(new Date()));
      }}
    />
  );
}
