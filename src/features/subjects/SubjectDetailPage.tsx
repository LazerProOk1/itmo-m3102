import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { Tabs, type TabItem } from '../../components/ui/Tabs';
import { formatShortDate } from '../../lib/dates';
import { useClock } from '../../lib/useClock';
import { SECTIONS } from '../../app/navigation';
import { resolveSubjectFolder } from '../../data/m3102';
import { useGroupStore } from '../group/groupStore';
import { useEditMode } from '../settings/EditModeContext';
import { LectureNoteDialog } from '../materials/LectureNoteDialog';
import { useLectureNoteDialog } from '../materials/useLectureNoteDialog';
import { useLectureNotesStore } from '../materials/lectureNotesStore';
import { MaterialDialog } from '../materials/MaterialDialog';
import { useMaterialDialog } from '../materials/useMaterialDialog';
import { useMaterialsStore } from '../materials/materialsStore';
import { NoteDialog } from '../notes/NoteDialog';
import { useNoteDialog } from '../notes/useNoteDialog';
import { useNotesStore } from '../notes/notesStore';
import { useScheduleStore } from '../schedule/scheduleStore';
import { isOpenTask } from '../tasks/taskFilters';
import { TaskDialog } from '../tasks/TaskDialog';
import { useTaskDialog } from '../tasks/useTaskDialog';
import { useTasksStore } from '../tasks/tasksStore';
import { resolveSubjectContacts } from './contacts';
import { SubjectContactsSection } from './SubjectContactsSection';
import { SubjectDialog } from './SubjectDialog';
import { SubjectInfoDialog } from './SubjectInfoDialog';
import { SubjectInfoSection } from './SubjectInfoSection';
import { useSubjectInfoStore } from './subjectInfoStore';
import { useSubjectInfoDialog } from './useSubjectInfoDialog';
import { SubjectLinksTab } from './SubjectLinksTab';
import { SubjectMaterialsTab } from './SubjectMaterialsTab';
import { SubjectNotesTab } from './SubjectNotesTab';
import { SubjectOverview } from './SubjectOverview';
import { SubjectTasksTab } from './SubjectTasksTab';
import { getNextDeadline } from './subjectStats';
import { useSubjectDialog } from './useSubjectDialog';
import { useSubjectsStore } from './subjectsStore';
import styles from './SubjectDetailPage.module.css';

export type SubjectTab = 'overview' | 'tasks' | 'materials' | 'notes' | 'links';

// Как в TodayHeader: играет один раз за сессию, а не при каждом открытии страницы предмета
let hasRevealedSubjectTitle = false;

const TAB_LABELS: Record<SubjectTab, string> = {
  overview: 'Обзор',
  tasks: 'Задачи',
  materials: 'Материалы',
  notes: 'Заметки',
  links: 'Ссылки',
};

/**
 * Страница предмета: шапка (название, преподаватель, ближайший дедлайн) и пять вкладок.
 * Задачи, материалы и заметки, добавленные здесь, всегда привязаны к этому предмету.
 */
export function SubjectDetailPage() {
  const { isEditMode } = useEditMode();
  const { subjectId } = useParams<{ subjectId: string }>();
  const navigate = useNavigate();
  const { today } = useClock();

  const subject = useSubjectsStore((state) => state.subjects.find((item) => item.id === subjectId));
  const tasks = useTasksStore((state) => state.tasks);
  const materials = useMaterialsStore((state) => state.materials);
  const lectureNotes = useLectureNotesStore((state) => state.lectureNotes);
  const subjectInfo = useSubjectInfoStore((state) => state.items);
  const notes = useNotesStore((state) => state.notes);
  const classes = useScheduleStore((state) => state.classes);
  const groupLinks = useGroupStore((state) => state.links);
  const groupDeadlines = useGroupStore((state) => state.deadlines);
  const deadlinesDone = useGroupStore((state) => state.deadlinesDone);

  // Вкладка — в адресе (?tab=materials): после конспекта «Назад» возвращает на неё же
  const [params, setParams] = useSearchParams();
  const tab = (Object.keys(TAB_LABELS) as SubjectTab[]).find((value) => value === params.get('tab')) ?? 'overview';
  const setTab = (value: SubjectTab) => setParams(value === 'overview' ? {} : { tab: value });
  const [shouldRevealTitle] = useState(() => !hasRevealedSubjectTitle);
  hasRevealedSubjectTitle = true;
  const subjectDialog = useSubjectDialog();
  const taskDialog = useTaskDialog();
  const materialDialog = useMaterialDialog();
  const lectureNoteDialog = useLectureNoteDialog();
  const noteDialog = useNoteDialog();
  const subjectInfoDialog = useSubjectInfoDialog();

  // Предмет не найден (удалён или неверная ссылка) — возвращаемся к списку
  if (!subject) return <Navigate to={SECTIONS.subjects.path} replace />;

  const subjectTasks = tasks.filter((task) => task.subjectId === subject.id);
  const subjectMaterials = materials.filter((material) => material.subjectId === subject.id && material.type !== 'link');
  const subjectLectureNotes = lectureNotes.filter((note) => note.subjectId === subject.id && !note.archived);
  const subjectLinks = materials.filter((material) => material.subjectId === subject.id && material.type === 'link');
  // Ссылки группы (data/links.json) — предмет указан названием или сокращением
  const subjectGroupLinks = groupLinks.filter((link) => resolveSubjectFolder(link.subject) === subject.id);
  const subjectNotes = notes.filter((note) => note.subjectId === subject.id);
  const subjectInfoItems = subjectInfo.filter((item) => item.subjectId === subject.id);
  const nextDeadline = getNextDeadline(tasks, subject.id, today, { deadlines: groupDeadlines, done: deadlinesDone });

  const tabItems: TabItem<SubjectTab>[] = [
    { value: 'overview', label: TAB_LABELS.overview },
    { value: 'tasks', label: TAB_LABELS.tasks, count: subjectTasks.filter(isOpenTask).length },
    { value: 'materials', label: TAB_LABELS.materials, count: subjectMaterials.length + subjectLectureNotes.length },
    { value: 'notes', label: TAB_LABELS.notes, count: subjectNotes.length },
    { value: 'links', label: TAB_LABELS.links, count: subjectGroupLinks.length + subjectLinks.length },
  ];

  const subtitle = [
    subject.teacherPrimary ?? 'Преподаватель не назначен',
    nextDeadline ? `Ближайший дедлайн ${formatShortDate(nextDeadline, 'long')}` : 'Нет дедлайнов',
  ].join(' · ');

  const resolvedContacts = resolveSubjectContacts(subject.id, classes, subject.contacts ?? []);

  return (
    <>
      <PageHeader
        title={subject.name}
        subtitle={subtitle}
        reveal={shouldRevealTitle}
        titleViewTransitionName={`subject-title-${subject.id}`}
        actions={
          isEditMode && (
            <Button variant="secondary" icon={Pencil} onClick={() => subjectDialog.openEdit(subject)}>
              Изменить
            </Button>
          )
        }
      />

      <SubjectContactsSection contacts={resolvedContacts} telegramChatUrl={subject.telegramChatUrl} />

      <SubjectInfoSection items={subjectInfoItems} onEdit={subjectInfoDialog.openEdit} />

      <Tabs label="Разделы предмета" items={tabItems} value={tab} onChange={setTab} className={styles.tabs} />

      <div role="tabpanel" className={styles.panel}>
        {tab === 'overview' && (
          <SubjectOverview
            tasks={subjectTasks}
            materials={subjectMaterials}
            links={subjectLinks}
            groupLinks={subjectGroupLinks}
            today={today}
            onSwitchTab={setTab}
            onEditTask={taskDialog.openEdit}
            onEditMaterial={materialDialog.openEdit}
          />
        )}
        {tab === 'tasks' && (
          <SubjectTasksTab
            tasks={subjectTasks}
            today={today}
            onAdd={() => taskDialog.openCreate({ subjectId: subject.id })}
            onEdit={taskDialog.openEdit}
          />
        )}
        {tab === 'materials' && (
          <SubjectMaterialsTab
            lectureNotes={subjectLectureNotes}
            materials={subjectMaterials}
            today={today}
            onAddNote={() => lectureNoteDialog.openCreate(subject.id)}
            onEditNote={lectureNoteDialog.openEdit}
            onAddMaterial={() => materialDialog.openCreate({ subjectId: subject.id, type: 'pdf' })}
            onEditMaterial={materialDialog.openEdit}
          />
        )}
        {tab === 'notes' && (
          <SubjectNotesTab
            notes={subjectNotes}
            today={today}
            onAdd={() => noteDialog.openCreate(subject.id)}
            onEdit={noteDialog.openEdit}
          />
        )}
        {tab === 'links' && (
          <SubjectLinksTab
            links={subjectLinks}
            groupLinks={subjectGroupLinks}
            today={today}
            onAdd={() => materialDialog.openCreate({ subjectId: subject.id, type: 'link' })}
            onEdit={materialDialog.openEdit}
          />
        )}
      </div>

      <SubjectDialog
        target={subjectDialog.target}
        onClose={subjectDialog.close}
        onDeleted={() => navigate(SECTIONS.subjects.path)}
      />
      <TaskDialog target={taskDialog.target} onClose={taskDialog.close} />
      <MaterialDialog target={materialDialog.target} onClose={materialDialog.close} />
      <LectureNoteDialog target={lectureNoteDialog.target} onClose={lectureNoteDialog.close} />
      <NoteDialog target={noteDialog.target} onClose={noteDialog.close} />
      <SubjectInfoDialog target={subjectInfoDialog.target} onClose={subjectInfoDialog.close} />
    </>
  );
}
