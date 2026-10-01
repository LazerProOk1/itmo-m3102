import { Clock, FolderOpen, Link2, SquareCheck } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { List } from '../../components/ui/List';
import { Section } from '../../components/ui/Section';
import { MaterialRow } from '../materials/MaterialRow';
import type { ISODate, Material, Task } from '../../types/models';
import { isOpenTask, sortTasks } from '../tasks/taskFilters';
import { TaskRow } from '../tasks/TaskRow';
import type { SubjectTab } from './SubjectDetailPage';
import styles from './SubjectOverview.module.css';

const UPCOMING_LIMIT = 5;
const RECENT_MATERIALS_LIMIT = 4;
const QUICK_LINKS_LIMIT = 5;

interface SubjectOverviewProps {
  tasks: Task[];
  materials: Material[];
  links: Material[];
  today: ISODate;
  onSwitchTab: (tab: SubjectTab) => void;
  onEditTask: (task: Task) => void;
  onEditMaterial: (material: Material) => void;
}

/** Сводка по предмету: задачи на сейчас, ближайшие дедлайны, последние материалы, быстрые ссылки. */
export function SubjectOverview({ tasks, materials, links, today, onSwitchTab, onEditTask, onEditMaterial }: SubjectOverviewProps) {
  const tasksForNow = sortTasks(
    tasks.filter((task) => isOpenTask(task) && task.deadline !== undefined && task.deadline <= today),
    'deadline',
  );

  const upcomingDeadlines = sortTasks(
    tasks.filter((task) => isOpenTask(task) && task.deadline !== undefined && task.deadline > today),
    'deadline',
  ).slice(0, UPCOMING_LIMIT);

  const recentMaterials = [...materials].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, RECENT_MATERIALS_LIMIT);
  const quickLinks = [...links].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, QUICK_LINKS_LIMIT);

  const seeAll = (tab: SubjectTab) => (
    <Button variant="ghost" size="sm" onClick={() => onSwitchTab(tab)}>
      Все
    </Button>
  );

  return (
    <div className={styles.grid}>
      <Section title="Задачи" meta={tasksForNow.length} action={seeAll('tasks')}>
        {tasksForNow.length === 0 ? (
          <EmptyState compact icon={SquareCheck} title="Сейчас ничего не горит" />
        ) : (
          <List>
            {tasksForNow.map((task) => (
              <TaskRow key={task.id} task={task} today={today} onEdit={onEditTask} />
            ))}
          </List>
        )}
      </Section>

      <Section title="Ближайшие дедлайны" action={seeAll('tasks')}>
        {upcomingDeadlines.length === 0 ? (
          <EmptyState compact icon={Clock} title="Нет ближайших дедлайнов" />
        ) : (
          <List>
            {upcomingDeadlines.map((task) => (
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
        {quickLinks.length === 0 ? (
          <EmptyState compact icon={Link2} title="Пока нет ссылок" />
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
