import { Pencil, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import { Markdown } from '../../components/markdown/Markdown';
import { Checkbox } from '../../components/ui/Checkbox';
import { IconButton } from '../../components/ui/IconButton';
import { cn } from '../../lib/cn';
import { daysBetween } from '../../lib/dates';
import type { ISODate } from '../../types/models';
import { useHomeworkStore, type HomeworkItem } from './homeworkStore';
import styles from './Homework.module.css';

export function dueStatus(due: string, today: ISODate): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return 'Без срока';
  const days = daysBetween(today, due);
  return days < 0 ? 'Просрочено' : days === 0 ? 'Сегодня' : days === 1 ? 'Завтра' : `Через ${days} дн.`;
}

const shortDate = (key: string) => (key ? `${key.slice(8, 10)}.${key.slice(5, 7)}` : '');

interface HomeworkCardProps {
  item: HomeworkItem;
  today: ISODate;
  /** Без правки/удаления и ссылки на пару — для главной и карточки занятия */
  compact?: boolean;
  onEdit?: (item: HomeworkItem) => void;
  onDelete?: (item: HomeworkItem) => void;
}

export function HomeworkCard({ item, today, compact = false, onEdit, onDelete }: HomeworkCardProps) {
  const done = useHomeworkStore((state) => Boolean(state.done[item.id]));
  const toggleDone = useHomeworkStore((state) => state.toggleDone);
  const overdue = !done && item.due !== '' && item.due < today;

  return (
    <article className={cn(styles.card, done && styles.done)}>
      <Checkbox
        aria-label={`Отметить «${item.subject}» выполненным`}
        checked={done}
        onChange={(event) => toggleDone(item.id, event.target.checked)}
      />
      <div className={styles.body}>
        <div className={styles.top}>
          <strong>{item.subject}</strong>
          <span className={cn(styles.due, overdue && styles.overdue)}>{dueStatus(item.due, today)}</span>
        </div>
        <Markdown content={item.text} className={styles.text} />
        {item.links.map((link) => (
          <a key={link.url} className={styles.link} href={link.url} target="_blank" rel="noopener noreferrer">
            {link.title} ↗
          </a>
        ))}
        {!compact && item.lessonDate && (
          <Link className={styles.origin} to={`/schedule?date=${item.lessonDate}`}>
            С пары {shortDate(item.lessonDate)}
            {item.lessonStart && `, ${item.lessonStart}`} ↗
          </Link>
        )}
      </div>
      {!compact && (onEdit || onDelete) && (
        <div className={styles.actions}>
          {onEdit && <IconButton icon={Pencil} label="Изменить задание" size="sm" onClick={() => onEdit(item)} />}
          {onDelete && <IconButton icon={Trash2} label="Удалить задание" size="sm" onClick={() => onDelete(item)} />}
        </div>
      )}
    </article>
  );
}
