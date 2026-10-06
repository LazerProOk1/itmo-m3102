import { FolderOpen, Link2, NotebookText, SquareCheck } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { List } from '../../components/ui/List';
import { Section } from '../../components/ui/Section';
import { LinkCards } from '../group/LinksPage';
import type { GroupLink } from '../group/groupStore';
import { MaterialRow } from '../materials/MaterialRow';
import { LectureNoteRow } from '../materials/LectureNoteRow';
import { compareLessons } from '../materials/NoteReader';
import { parseLessonLabel } from '../schedule/lessons';
import { DeadlinesPanel, HomeworkPanel } from '../today/HomePanels';
import type { ISODate, LectureNote, Material, Task } from '../../types/models';
import { isOpenTask, sortTasks } from '../tasks/taskFilters';
import { TaskRow } from '../tasks/TaskRow';
import type { SubjectTab } from './SubjectDetailPage';
import styles from './SubjectOverview.module.css';

const PLAN_LIMIT = 5;
const RECENT_MATERIALS_LIMIT = 4;
const QUICK_LINKS_LIMIT = 5;
const LAST_NOTES_LIMIT = 4;

interface SubjectOverviewProps {
  subjectId: string;
  lectureNotes: LectureNote[];
  onEditNote: (note: LectureNote) => void;
  tasks: Task[];
  materials: Material[];
  links: Material[];
  groupLinks: GroupLink[];
  today: ISODate;
  onSwitchTab: (tab: SubjectTab) => void;
  onEditTask: (task: Task) => void;
  onEditMaterial: (material: Material) => void;
}

/**
 * Всё по предмету на одном экране: дедлайны и ДЗ группы по этому предмету, конспекты последних занятий,
 * свой учебный план, материалы и ссылки. Раньше «Обзор» показывал только личные задачи — общего тут не было.
 */
export function SubjectOverview({
  subjectId,
  lectureNotes,
  onEditNote,
  tasks,
  materials,
  links,
  groupLinks,
  today,
  onSwitchTab,
  onEditTask,
  onEditMaterial,
}: SubjectOverviewProps) {
  const plan = sortTasks(tasks.filter(isOpenTask), 'deadline').slice(0, PLAN_LIMIT);
  // Конспекты последних занятий — свежие сверху (Лекция 5, Практика 4…)
  // Только папки занятий («Лекция 4», «Практика 3»): «Доп Материалы» и «Тесты» — во вкладке «Материалы»
  const lastNotes = lectureNotes
    .filter((note) => parseLessonLabel(note.lectureNumber))
    .sort(compareLessons)
    .reverse()
    .slice(0, LAST_NOTES_LIMIT);

  const recentMaterials = [...materials].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, RECENT_MATERIALS_LIMIT);
  const quickLinks = [...links].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, QUICK_LINKS_LIMIT);

  const seeAll = (tab: SubjectTab) => (
    <Button variant="ghost" size="sm" onClick={() => onSwitchTab(tab)}>
      Все
    </Button>
  );

  return (
    <div className={styles.grid}>
      <DeadlinesPanel subjectId={subjectId} />

      <HomeworkPanel subjectId={subjectId} today={today} />

      <Section title="Конспекты занятий" action={seeAll('materials')}>
        {lastNotes.length === 0 ? (
          <EmptyState compact icon={NotebookText} title="Конспектов пока нет" />
        ) : (
          <List>
            {lastNotes.map((note) => (
              <LectureNoteRow key={note.id} note={note} today={today} onEdit={onEditNote} />
            ))}
          </List>
        )}
      </Section>

      <Section title="Мой план" meta={plan.length || undefined} action={seeAll('tasks')}>
        {plan.length === 0 ? (
          <EmptyState compact icon={SquareCheck} title="Своих задач по предмету нет" />
        ) : (
          <List>
            {plan.map((task) => (
              <TaskRow key={task.id} task={task} today={today} onEdit={onEditTask} />
            ))}
          </List>
        )}
      </Section>

      <Section title="Недавние материалы" action={seeAll('materials')}>
        {recentMaterials.length === 0 ? (
          <EmptyState compact icon={FolderOpen} title="Пока нет материалов" />
        ) : (
          <List>
            {recentMaterials.map((material) => (
              <MaterialRow key={material.id} material={material} today={today} onEdit={onEditMaterial} />
            ))}
          </List>
        )}
      </Section>

      <Section title="Быстрые ссылки" action={seeAll('links')}>
        {groupLinks.length > 0 && <LinkCards links={groupLinks} />}
        {quickLinks.length === 0 ? (
          groupLinks.length === 0 && <EmptyState compact icon={Link2} title="Пока нет ссылок" />
        ) : (
          <List>
            {quickLinks.map((link) => (
              <MaterialRow key={link.id} material={link} today={today} onEdit={onEditMaterial} />
            ))}
          </List>
        )}
      </Section>
    </div>
  );
}
