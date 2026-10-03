import { Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { SECTIONS } from '../../app/navigation';
import { AnimatedNumber } from '../../components/ui/AnimatedNumber';
import { Button, buttonClass } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import { IconButton } from '../../components/ui/IconButton';
import { Input } from '../../components/ui/Input';
import { Section } from '../../components/ui/Section';
import { useConfettiWhenCleared } from '../../lib/celebrate';
import { cn } from '../../lib/cn';
import { daysBetween, formatShortDate } from '../../lib/dates';
import { pluralize } from '../../lib/pluralize';
import type { ISODate } from '../../types/models';
import { filePath, useGroupStore, type GroupDeadline } from '../group/groupStore';
import { deadlineInfo, orderDeadlines } from '../deadlines/deadlineInfo';
import { HomeworkCard } from '../homework/HomeworkCard';
import { useHomeworkStore } from '../homework/homeworkStore';
import { useLectureNotesStore } from '../materials/lectureNotesStore';
import { useMarksStore } from '../materials/marksStore';
import { useSubjectsStore } from '../subjects/subjectsStore';
import { useTasksStore } from '../tasks/tasksStore';
import styles from './HomePanels.module.css';

export function SectionLink({ to, children }: { to: string; children: string }) {
  return (
    <Link to={to} className={buttonClass('ghost', 'sm')}>
      {children} ↗
    </Link>
  );
}

const dayMonth = (iso: string) => new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

function DeadlineRow({ item, done }: { item: GroupDeadline; done: boolean }) {
  const toggle = useGroupStore((state) => state.toggleDeadlineDone);
  return (
    <label className={cn(styles.row, done && styles.done)}>
      <Checkbox
        celebrate
        aria-label={`Отметить «${item.name}» выполненным`}
        checked={done}
        onChange={(event) => toggle(item.id, event.target.checked)}
      />
      <span className={styles.day}>{dayMonth(item.deadline)}</span>
      <span className={styles.detail}>
        <strong>{item.name}</strong>
        <small>{item.note || 'Общий дедлайн'}</small>
      </span>
      {!done && <span className={styles.status}>{deadlineInfo(item.deadline).label}</span>}
    </label>
  );
}

/** Ближайшие 3 дедлайна группы; отмеченные уходят в «Выполненные» */
export function DeadlinesPanel() {
  const deadlines = useGroupStore((state) => state.deadlines);
  const done = useGroupStore((state) => state.deadlinesDone);
  // Ближайшие впереди, просроченные — после них (как на сайте группы)
  const active = orderDeadlines(deadlines, done).filter((item) => !done[item.id]);
  const completed = deadlines.filter((item) => done[item.id]);
  useConfettiWhenCleared(active.length);

  return (
    <Section title="Ближайшие дедлайны" action={<SectionLink to={SECTIONS.deadlines.path}>Все дедлайны</SectionLink>}>
      {active.length === 0 ? (
        <p className={styles.empty}>{deadlines.length ? 'Все ближайшие дедлайны отмечены как выполненные.' : 'Сроков пока нет.'}</p>
      ) : (
        active.slice(0, 3).map((item) => <DeadlineRow key={item.id} item={item} done={false} />)
      )}
      {completed.length > 0 && (
        <details className={styles.completed}>
          <summary>Выполненные дедлайны · {completed.length}</summary>
          {completed.map((item) => (
            <DeadlineRow key={item.id} item={item} done />
          ))}
        </details>
      )}
    </Section>
  );
}

/** 5 ближайших невыполненных заданий группы */
export function HomeworkPanel({ today }: { today: ISODate }) {
  const items = useHomeworkStore((state) => state.items);
  const done = useHomeworkStore((state) => state.done);
  const open = items.filter((item) => !done[item.id]);
  useConfettiWhenCleared(open.length);
  const active = open.sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999')).slice(0, 5);

  return (
    <Section title="Домашнее задание" action={<SectionLink to={SECTIONS.homework.path}>Все задания</SectionLink>}>
      {active.length === 0 ? (
        <p className={styles.empty}>Актуальных заданий пока нет.</p>
      ) : (
        active.map((item) => <HomeworkCard key={item.id} item={item} today={today} compact />)
      )}
    </Section>
  );
}

const FOLDERS = [
  { name: 'Записи лекций', desc: 'Аудио прошедших занятий' },
  { name: 'Лабораторные', desc: 'Задания и отчёты' },
  { name: 'Материалы', desc: 'Учебники и полезные файлы' },
];

/**
 * Бенто, а не четыре одинаковые плитки: конспекты — главное, крупно и с числом; папки — компактно.
 * Ровная сетка равных карточек — примета шаблонного сайта, асимметрия читается как решение (21st.dev)
 */
export function MaterialsPanel() {
  const notes = useLectureNotesStore((state) => state.lectureNotes.filter((note) => !note.archived).length);
  const files = useGroupStore((state) => state.files);
  const count = (folder: string) => files.filter((file) => file.path.startsWith(`${folder}/`)).length;

  return (
    <Section title="Материалы" action={<SectionLink to="/files">Все материалы</SectionLink>}>
      <div className={styles.tiles}>
        <Link to={SECTIONS.materials.path} className={cn(styles.tile, styles.tileMain)} data-spot>
          <span className={styles.tileIndex}>01</span>
          <strong>Конспекты</strong>
          <small>Лекции и практики по предметам</small>
          <span className={styles.tileCount}>
            <AnimatedNumber value={notes} />
            <small>{pluralize(notes, ['конспект', 'конспекта', 'конспектов']).split(' ')[1]}</small>
          </span>
        </Link>
        {FOLDERS.map((folder, index) => (
          <Link key={folder.name} to={filePath(folder.name)} className={styles.tile} data-spot>
            <span className={styles.tileIndex}>{String(index + 2).padStart(2, '0')}</span>
            <strong>{folder.name}</strong>
            <small>
              {folder.desc}
              {count(folder.name) > 0 && ` · ${count(folder.name)}`}
            </small>
          </Link>
        ))}
      </div>
    </Section>
  );
}

/** «Мой учебный план» — личные задачи (раздел «Учебный план»): быстро добавить, отметить, удалить */
export function StudyPlanPanel({ today }: { today: ISODate }) {
  const tasks = useTasksStore((state) => state.tasks);
  const addTask = useTasksStore((state) => state.addTask);
  const toggleDone = useTasksStore((state) => state.toggleDone);
  const deleteTask = useTasksStore((state) => state.deleteTask);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');

  const sorted = [...tasks]
    .filter((task) => !hideCompleted || task.status !== 'done')
    .sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'));

  function add(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    addTask({ title: title.trim(), type: 'other', priority: 'normal', status: 'todo', deadline: date || undefined, links: [] });
    setTitle('');
    setDate('');
  }

  return (
    <Section
      title="Мой учебный план"
      action={<Checkbox label="Скрыть выполненные" checked={hideCompleted} onChange={(event) => setHideCompleted(event.target.checked)} />}
    >
      <form className={styles.planForm} onSubmit={add}>
        <Input
          value={title}
          maxLength={120}
          placeholder="Добавить свою задачу…"
          aria-label="Новая задача"
          onChange={(event) => setTitle(event.target.value)}
        />
        <Input type="date" value={date} aria-label="Срок задачи" onChange={(event) => setDate(event.target.value)} />
        <Button type="submit" variant="secondary" disabled={!title.trim()}>
          Добавить
        </Button>
      </form>
      {sorted.length === 0 ? (
        <p className={styles.empty}>Пока задач нет. Добавьте первую задачу.</p>
      ) : (
        sorted.map((task) => {
          const done = task.status === 'done';
          const overdue = !done && task.deadline !== undefined && daysBetween(today, task.deadline) < 0;
          return (
            <div key={task.id} className={cn(styles.row, done && styles.done)}>
              <Checkbox celebrate label={task.title} checked={done} onChange={() => toggleDone(task.id)} />
              {task.deadline && <span className={cn(styles.planDate, overdue && styles.overdue)}>{formatShortDate(task.deadline)}</span>}
              <IconButton icon={Trash2} label={`Удалить задачу «${task.title}»`} size="sm" onClick={() => deleteTask(task.id)} />
            </div>
          );
        })
      )}
      <p className={styles.hint}>Личные задачи и отметки хранятся в этом браузере.</p>
    </Section>
  );
}

/** Последние добавленные конспекты обеих папок */
export function RecentNotesPanel() {
  const notes = useLectureNotesStore((state) => state.lectureNotes);
  const subjects = useSubjectsStore((state) => state.subjects);
  const recent = notes
    .filter((note) => !note.archived)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6);

  return (
    <Section title="Недавние конспекты" action={<SectionLink to={SECTIONS.materials.path}>Все конспекты</SectionLink>}>
      {recent.length === 0 ? (
        <p className={styles.empty}>Пока нет конспектов.</p>
      ) : (
        <div className={styles.notes}>
          {recent.map((note) => (
            <Link key={note.id} to={`/materials/notes/${note.id}`} className={styles.note} data-spot data-morph>
              <strong data-morph-title>{note.title}</strong>
              <small>
                {subjects.find((subject) => subject.id === note.subjectId)?.name ?? 'Прочее'} · {note.lectureNumber} ·{' '}
                {new Date(note.createdAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })}
              </small>
            </Link>
          ))}
        </div>
      )}
    </Section>
  );
}

/** Закладки и пометки в конспектах — быстро вернуться к нужному месту; без них панели нет */
export function BookmarksPanel() {
  const notes = useLectureNotesStore((state) => state.lectureNotes);
  const bookmarks = useMarksStore((state) => state.bookmarks);
  const marks = useMarksStore((state) => state.marks);
  const marked = notes
    .filter((note) => bookmarks[note.id] || marks.some((mark) => mark.noteId === note.id))
    .sort((a, b) => (bookmarks[b.id] ?? '').localeCompare(bookmarks[a.id] ?? ''));
  if (!marked.length) return null;

  return (
    <Section title="Закладки и пометки">
      <div className={styles.notes}>
        {marked.map((note) => {
          const count = marks.filter((mark) => mark.noteId === note.id).length;
          return (
            <Link key={note.id} to={`/materials/notes/${note.id}`} className={styles.note} data-spot data-morph>
              <strong data-morph-title>{note.title}</strong>
              <small>
                {bookmarks[note.id] ? 'В закладках' : 'Пометки'}
                {count > 0 && ` · ${pluralize(count, ['пометка', 'пометки', 'пометок'])}`}
              </small>
            </Link>
          );
        })}
      </div>
    </Section>
  );
}
