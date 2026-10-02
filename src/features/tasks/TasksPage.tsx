import { ArrowDownUp, ListFilter, Plus, SquareCheck } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Dropdown, type DropdownOption } from '../../components/ui/Dropdown';
import { EmptyState } from '../../components/ui/EmptyState';
import { List } from '../../components/ui/List';
import { PageHeader } from '../../components/ui/PageHeader';
import { Tabs } from '../../components/ui/Tabs';
import { useClock } from '../../lib/useClock';
import { useSubjectsStore } from '../subjects/subjectsStore';
import { TaskDialog } from './TaskDialog';
import { filterTasks, sortTasks, type TaskSort, type TaskTab } from './taskFilters';
import { TaskRow } from './TaskRow';
import { useTaskDialog } from './useTaskDialog';
import { useTasksStore } from './tasksStore';
import styles from './TasksPage.module.css';

const TAB_ORDER: TaskTab[] = ['all', 'today', 'week', 'overdue', 'completed'];

const TAB_LABELS: Record<TaskTab, string> = {
  all: 'Все',
  today: 'Сегодня',
  week: 'На этой неделе',
  overdue: 'Просрочено',
  completed: 'Завершённые',
};

const SORT_LABELS: Record<TaskSort, string> = {
  deadline: 'По сроку',
  priority: 'По приоритету',
};

/** Страница задач: вкладки, фильтр по предмету, сортировка, создание и редактирование. */
export function TasksPage() {
  const { today } = useClock();
  const tasks = useTasksStore((state) => state.tasks);
  const subjects = useSubjectsStore((state) => state.subjects);
  const dialog = useTaskDialog();

  const [tab, setTab] = useState<TaskTab>('all');
  const [subjectId, setSubjectId] = useState('all');
  const [sort, setSort] = useState<TaskSort>('deadline');

  const subjectTasks = subjectId === 'all' ? tasks : tasks.filter((task) => task.subjectId === subjectId);
  const countFor = (value: TaskTab) => filterTasks(subjectTasks, value, today).length;
  const tabs = TAB_ORDER.map((value) => ({ value, label: TAB_LABELS[value], count: countFor(value) }));
  const visibleTasks = sortTasks(filterTasks(subjectTasks, tab, today), sort);

  const subjectOptions: DropdownOption[] = [
    { value: 'all', label: 'Все предметы' },
    ...subjects.map((subject) => ({ value: subject.id, label: subject.name })),
  ];
  const sortOptions: DropdownOption[] = (Object.keys(SORT_LABELS) as TaskSort[]).map((value) => ({
    value,
    label: SORT_LABELS[value],
  }));

  return (
    <>
      <PageHeader
        title="Учебный план"
        subtitle={`${countFor('all')} открыто · ${countFor('overdue')} просрочено · хранится только в этом браузере`}
        actions={
          <Button variant="primary" icon={Plus} onClick={() => dialog.openCreate()}>
            Новая задача
          </Button>
        }
      />

      <div className={styles.toolbar}>
        <Tabs label="Фильтр задач" items={tabs} value={tab} onChange={setTab} className={styles.tabs} />

        <div className={styles.filters}>
          <Dropdown
            variant="ghost"
            icon={ListFilter}
            aria-label="Фильтр по предмету"
            options={subjectOptions}
            value={subjectId}
            onChange={setSubjectId}
          />

          <Dropdown
            variant="ghost"
            icon={ArrowDownUp}
            aria-label="Сортировка"
            options={sortOptions}
            value={sort}
            onChange={(value) => setSort(value as TaskSort)}
          />
        </div>
      </div>

      {visibleTasks.length === 0 ? (
        <EmptyState compact icon={SquareCheck} title="Здесь пока нет задач" description="Задачи, подходящие под этот фильтр, появятся здесь." />
      ) : (
        <List>
          {visibleTasks.map((task) => (
            <TaskRow key={task.id} task={task} today={today} onEdit={dialog.openEdit} />
          ))}
        </List>
      )}

      <TaskDialog target={dialog.target} onClose={dialog.close} />
    </>
  );
}
