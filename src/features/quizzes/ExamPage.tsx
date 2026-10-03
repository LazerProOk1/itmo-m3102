import { ListChecks } from 'lucide-react';
import { useMemo } from 'react';
import { Navigate, useParams } from 'react-router';
import { SECTIONS } from '../../app/navigation';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { pluralize } from '../../lib/pluralize';
import { useLectureNotesStore } from '../materials/lectureNotesStore';
import { useSubjectsStore } from '../subjects/subjectsStore';
import { CombinedQuiz } from './CombinedQuiz';
import { quizzesOfSubject } from './quizSources';

const EXAM_QUESTIONS = 15;

/** Тест перед контрольной: случайные вопросы из всех тестов предмета вперемешку */
export function ExamPage() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const subject = useSubjectsStore((state) => state.subjects.find((item) => item.id === subjectId));
  const notes = useLectureNotesStore((state) => state.lectureNotes);
  const sources = useMemo(() => (subjectId ? quizzesOfSubject(notes, subjectId) : []), [notes, subjectId]);

  if (!subject) return <Navigate to={SECTIONS.subjects.path} replace />;
  return (
    <>
      <PageHeader title="Перед контрольной" subtitle={`${subject.name} · ${pluralize(sources.length, ['тест', 'теста', 'тестов'])} вперемешку`} />
      {sources.length ? (
        <CombinedQuiz
          picks={sources.map((source) => ({ key: source.key }))}
          title={`Перед контрольной: ${subject.name}`}
          description={`${EXAM_QUESTIONS} случайных вопросов из всех тестов предмета. Ошибки попадут в «Повторение».`}
          limit={EXAM_QUESTIONS}
        />
      ) : (
        <EmptyState icon={ListChecks} title="У предмета пока нет тестов" description="Тесты появляются под конспектами — «Проверь себя»." />
      )}
    </>
  );
}
