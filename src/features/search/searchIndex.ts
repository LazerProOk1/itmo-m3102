import { NotebookText } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SECTIONS } from '../../app/navigation';
import { MATERIAL_TYPES } from '../materials/labels';
import { useLectureNotesStore } from '../materials/lectureNotesStore';
import { useMaterialsStore } from '../materials/materialsStore';
import { useNotesStore } from '../notes/notesStore';
import { useSubjectsStore } from '../subjects/subjectsStore';
import { formatTaskMeta } from '../tasks/labels';
import { useTasksStore } from '../tasks/tasksStore';

export interface SearchResult {
  id: string;
  title: string;
  meta?: string;
  icon: LucideIcon;
  /** Куда перейти при выборе */
  path: string;
}

export interface SearchGroup {
  label: string;
  results: SearchResult[];
}

const RESULTS_PER_GROUP = 4;

/** Собирает группы заново при каждом поиске — видит и предметы, и задачи, добавленные пользователем. */
function buildGroups(): SearchGroup[] {
  const subjects = useSubjectsStore.getState().subjects;
  const tasks = useTasksStore.getState().tasks;
  const materials = useMaterialsStore.getState().materials;
  const lectureNotes = useLectureNotesStore.getState().lectureNotes;
  const notes = useNotesStore.getState().notes;
  const subjectName = (id: string | undefined) => subjects.find((subject) => subject.id === id)?.name;

  return [
    {
      label: 'Предметы',
      results: subjects.map((subject) => ({
        id: subject.id,
        title: subject.name,
        meta: subject.teacherPrimary,
        icon: SECTIONS.subjects.icon,
        path: `${SECTIONS.subjects.path}/${subject.id}`,
      })),
    },
    {
      label: 'Задачи',
      results: tasks.map((task) => ({
        id: task.id,
        title: task.title,
        meta: formatTaskMeta(subjectName(task.subjectId), task.type),
        icon: SECTIONS.tasks.icon,
        path: SECTIONS.tasks.path,
      })),
    },
    {
      label: 'Дедлайны',
      // Те же задачи, что и на странице Deadlines: не выполнены и есть срок
      results: tasks
        .filter((task) => task.status !== 'done' && task.deadline !== undefined)
        .map((task) => ({
          id: `deadline:${task.id}`,
          title: task.title,
          meta: formatTaskMeta(subjectName(task.subjectId), task.type),
          icon: SECTIONS.deadlines.icon,
          path: SECTIONS.deadlines.path,
        })),
    },
    {
      label: 'Материалы',
      results: materials
        .filter((material) => material.type !== 'link')
        .map((material) => ({
          id: material.id,
          title: material.name,
          meta: subjectName(material.subjectId),
          icon: MATERIAL_TYPES[material.type].icon,
          path: SECTIONS.materials.path,
        })),
    },
    {
      label: 'Конспекты',
      results: lectureNotes
        .filter((note) => !note.archived)
        .map((note) => ({
          id: note.id,
          title: note.lectureNumber ? `${note.lectureNumber}. ${note.title}` : note.title,
          meta: subjectName(note.subjectId),
          icon: NotebookText,
          // Своя страница чтения, а не общая /materials — конспекты там теперь спрятаны
          // за выбором предмета (см. LectureNotesTab), сразу к тексту так быстрее
          path: `/materials/notes/${note.id}`,
        })),
    },
    {
      label: 'Заметки',
      results: notes.map((note) => ({
        id: note.id,
        title: note.title,
        meta: subjectName(note.subjectId),
        icon: SECTIONS.notes.icon,
        path: SECTIONS.notes.path,
      })),
    },
    {
      label: 'Ссылки',
      // type: 'link' — быстрые ссылки предмета, та же сущность Material, что и в разделе Materials
      results: materials
        .filter((material) => material.type === 'link')
        .map((material) => ({
          id: material.id,
          title: material.name,
          meta: subjectName(material.subjectId),
          icon: MATERIAL_TYPES[material.type].icon,
          path: SECTIONS.materials.path,
        })),
    },
  ];
}

/**
 * Ищет по названию и подписи (предмет, тип), без учёта регистра.
 * Поиск по подписи — не только «Lab #2» находится по своему названию,
 * но и по названию предмета, к которому он привязан («Programming» находит и его задачи).
 */
export function search(query: string): SearchGroup[] {
  const normalized = query.trim().toLowerCase();

  return buildGroups()
    .map((group) => ({
      ...group,
      results: group.results
        .filter(
          (result) =>
            result.title.toLowerCase().includes(normalized) || result.meta?.toLowerCase().includes(normalized),
        )
        .slice(0, RESULTS_PER_GROUP),
    }))
    .filter((group) => group.results.length > 0);
}
