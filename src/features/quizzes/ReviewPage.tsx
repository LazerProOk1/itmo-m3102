import { Repeat2 } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { formatShortDate } from '../../lib/dates';
import { pluralize } from '../../lib/pluralize';
import { useClock } from '../../lib/useClock';
import { CombinedQuiz, type QuizPick } from './CombinedQuiz';
import { dueCards, useQuizStore } from './quizStore';

/**
 * Повторение: вопросы, на которых ошибся в тестах «Проверь себя», возвращаются через 1, 3, 7 и 14 дней
 * (интервальное повторение). Верный ответ отодвигает вопрос дальше, ошибка — снова на завтра.
 */
export function ReviewPage() {
  const { today } = useClock();
  const review = useQuizStore((state) => state.review);
  const due = dueCards(review, today);
  // Набор вопросов фиксируется на открытие страницы: ответы двигают сроки, но не перестраивают тест на ходу
  const [picks] = useState(() => {
    const byQuiz = new Map<string, number[]>();
    for (const card of due) byQuiz.set(card.quiz, [...(byQuiz.get(card.quiz) ?? []), card.index]);
    return [...byQuiz].map(([key, indices]): QuizPick => ({ key, indices }));
  });
  const upcoming = Object.values(review)
    .filter((card) => card.due > today)
    .sort((a, b) => a.due.localeCompare(b.due));

  return (
    <>
      <PageHeader
        title="Повторение"
        subtitle={due.length ? `${pluralize(due.length, ['вопрос', 'вопроса', 'вопросов'])} на сегодня` : 'Вопросы, на которых вы ошиблись в тестах'}
      />
      {picks.length ? (
        <CombinedQuiz
          picks={picks}
          title="Повторение ошибок"
          description="Вопросы, на которых вы ошиблись раньше. Верный ответ отложит вопрос на несколько дней."
        />
      ) : (
        <EmptyState
          icon={Repeat2}
          title="На сегодня повторять нечего"
          description={
            upcoming.length
              ? `Следующие вопросы — ${formatShortDate(upcoming[0]!.due, 'long')}, всего ${upcoming.length}.`
              : 'Ошибки в тестах «Проверь себя» попадут сюда и вернутся через день, три, неделю и две.'
          }
        />
      )}
    </>
  );
}
