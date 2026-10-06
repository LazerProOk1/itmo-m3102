import { Pencil, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import { LazyMarkdown as Markdown } from '../../components/markdown/LazyMarkdown';
import { Checkbox } from '../../components/ui/Checkbox';
import { IconButton } from '../../components/ui/IconButton';
import { cn } from '../../lib/cn';
import { useCursorGlow } from '../../lib/useCursorGlow';
import { daysBetween } from '../../lib/dates';
import type { ISODate } from '../../types/models';
import { useHomeworkStore, type HomeworkItem } from './homeworkStore';
import styles from './Homework.module.css';

/** Срочность задания — от неё цвет карточки и значка срока */
export type DueTone = 'overdue' | 'today' | 'soon' | 'later' | 'none';

export function dueTone(due: string, today: ISODate): DueTone {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return 'none';
  const days = daysBetween(today, due);
  return days < 0 ? 'overdue' : days === 0 ? 'today' : days <= 2 ? 'soon' : 'later';
}

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
  const glow = useCursorGlow();
  const tone = done ? 'none' : dueTone(item.due, today);

  return (
    <article
      className={cn(styles.card, styles[tone], done && styles.done)}
      data-lit=""
      onPointerMove={glow.onPointerMove}
      onPointerLeave={glow.onPointerLeave}
    >
      <Checkbox
        celebrate
        className={styles.check}
        aria-label={`Отметить «${item.subject}» выполненным`}
        checked={done}
        onChange={(event) => toggleDone(item.id, event.target.checked)}
      />
      <div className={styles.body}>
        <div className={styles.top}>
          {/* На странице «Домашнее задание» предмет уже в заголовке группы — не повторяем */}
          {compact && <strong>{item.subject}</strong>}
          <span className={styles.due}>
            {dueStatus(item.due, today)}
            {item.due && !compact && <span className={styles.dueDate}> · {shortDate(item.due)}</span>}
          </span>
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
