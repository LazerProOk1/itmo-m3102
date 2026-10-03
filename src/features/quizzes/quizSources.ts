import { noteQuizKey, quizBlocks, quizTitle } from '../../components/quiz/parseQuiz';
import type { LectureNote } from '../../types/models';
import { useLectureNotesStore } from '../materials/lectureNotesStore';
import { siteQuizByKey, siteQuizFor, siteQuizKey } from '../materials/siteQuizzes';

/** Один тест «Проверь себя»: ключ результатов, конспект и загрузка текста теста */
export interface QuizSource {
  key: string;
  noteId: string;
  title: string;
  load: () => Promise<string>;
}

const isGroupNote = (note: LectureNote) =>
  note.source === 'github' && (note.collection ?? 'group') === 'group' && !note.archived && note.contentType === 'markdown';

/** Тесты конспекта: тесты группы внутри него, а если их нет — наш (как и показывает читалка) */
export function quizzesOfNote(note: LectureNote): QuizSource[] {
  if (!isGroupNote(note) || !note.sourceRef) return [];
  const blocks = quizBlocks(note.content);
  if (blocks.length)
    return blocks.map((block) => ({ key: noteQuizKey(note.sourceRef!, block), noteId: note.id, title: quizTitle(block), load: async () => block }));
  const load = siteQuizFor(note.sourceRef);
  return load ? [{ key: `site:${siteQuizKey(note.sourceRef)}`, noteId: note.id, title: note.title, load }] : [];
}

export function quizzesOfSubject(notes: LectureNote[], subjectId: string): QuizSource[] {
  return notes.filter((note) => note.subjectId === subjectId).flatMap(quizzesOfNote);
}

/** Текст теста по ключу (для повторения) или null, если конспект с тестом пропал */
export async function loadQuizByKey(key: string): Promise<string | null> {
  if (key.startsWith('site:')) return (await siteQuizByKey(key.slice(5))?.()) ?? null;
  const [path, title] = key.slice(5).split('#') as [string, string];
  const note = useLectureNotesStore.getState().lectureNotes.find((item) => item.sourceRef === path);
  return (note && quizBlocks(note.content).find((block) => quizTitle(block) === title)) ?? null;
}
