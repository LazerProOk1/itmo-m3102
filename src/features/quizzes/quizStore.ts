import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { addDays } from '../../lib/dates';
import { storageKey } from '../../lib/storage';
import type { ISODate } from '../../types/models';

/**
 * Личные результаты тестов «Проверь себя» и вопросы на повторение (только в браузере).
 * Ключ теста — `site:<путь>` (наш тест, siteQuizzes.ts) или `note:<путь>#<название>` (тест группы в конспекте).
 */
export interface QuizResult {
  best: number;
  last: number;
  total: number;
  attempts: number;
  at: string;
}

/** Вопрос, на котором ошибся: возвращается через 1, 3, 7, 14 дней, пока не ответишь верно на последнем шаге */
export interface ReviewCard {
  quiz: string;
  index: number;
  step: number;
  due: ISODate;
}

export const REVIEW_STEPS = [1, 3, 7, 14];

/** Следующее состояние карточки: ошибка — с начала (завтра), верно — шаг дальше; после последнего шага выучено (null) */
export function nextReview(card: ReviewCard | undefined, quiz: string, index: number, ok: boolean, today: ISODate): ReviewCard | null {
  if (!ok) return { quiz, index, step: 0, due: addDays(today, REVIEW_STEPS[0]!) };
  if (!card) return null;
  const step = card.step + 1;
  return step >= REVIEW_STEPS.length ? null : { ...card, step, due: addDays(today, REVIEW_STEPS[step]!) };
}

const cardId = (quiz: string, index: number) => `${quiz}|${index}`;

interface QuizStore {
  results: Record<string, QuizResult>;
  review: Record<string, ReviewCard>;
  recordAnswer: (quiz: string, index: number, ok: boolean, today: ISODate) => void;
  recordResult: (quiz: string, correct: number, total: number) => void;
}

export const useQuizStore = create<QuizStore>()(
  persist(
    (set) => ({
      results: {},
      review: {},
      recordAnswer: (quiz, index, ok, today) =>
        set((state) => {
          const id = cardId(quiz, index);
          const card = nextReview(state.review[id], quiz, index, ok, today);
          // Верный ответ на вопрос, которого нет в повторении, ничего не меняет
          if (!card && !state.review[id]) return state;
          const review = { ...state.review };
          if (card) review[id] = card;
          else delete review[id];
          return { review };
        }),
      recordResult: (quiz, correct, total) =>
        set((state) => {
          const share = total ? correct / total : 0;
          const prev = state.results[quiz];
          return {
            results: {
              ...state.results,
              [quiz]: {
                best: Math.max(prev?.best ?? 0, share),
                last: share,
                total,
                attempts: (prev?.attempts ?? 0) + 1,
                at: new Date().toISOString(),
              },
            },
          };
        }),
    }),
    { name: storageKey('quizzes') },
  ),
);

/** Карточки, которые пора повторить сегодня */
export const dueCards = (review: Record<string, ReviewCard>, today: ISODate) => Object.values(review).filter((card) => card.due <= today);
