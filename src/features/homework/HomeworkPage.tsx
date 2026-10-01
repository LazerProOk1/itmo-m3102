import { Copy, Download, ExternalLink, Plus, Upload } from 'lucide-react';
import { useState } from 'react';
import { Button, buttonClass } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import { ConfirmDeleteModal } from '../../components/ui/ConfirmDeleteModal';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { SegmentedControl, type SegmentedOption } from '../../components/ui/SegmentedControl';
import { pluralize } from '../../lib/pluralize';
import { useClock } from '../../lib/useClock';
import { repoEditUrl } from '../../services/github';
import { useEditMode } from '../settings/EditModeContext';
import { useSubjectsStore } from '../subjects/subjectsStore';
import { HomeworkCard } from './HomeworkCard';
import { useHomeworkDialog } from './HomeworkDialog';
import { HOMEWORK_PATH, serializeHomework, useHomeworkStore, type HomeworkItem } from './homeworkStore';
import { PublishHomeworkDialog } from './PublishHomeworkDialog';
import styles from './Homework.module.css';

type Filter = 'active' | 'overdue' | 'done' | 'all';

const FILTERS: SegmentedOption<Filter>[] = [
  { value: 'active', label: 'Актуальные' },
  { value: 'overdue', label: 'Просроченные' },
  { value: 'done', label: 'Выполненные' },
  { value: 'all', label: 'Все' },
];

const dueOrder = (item: HomeworkItem) => item.due || '9999-12-31';

/** Домашнее задание группы — общее для всех (data/homework.json), отметки «сделано» — личные. */
export function HomeworkPage() {
  const { today } = useClock();
  const items = useHomeworkStore((state) => state.items);
  const done = useHomeworkStore((state) => state.done);
  const hasDraft = useHomeworkStore((state) => state.hasDraft);
  const deleteItem = useHomeworkStore((state) => state.deleteItem);
  const discardDraft = useHomeworkStore((state) => state.discardDraft);
  const subjects = useSubjectsStore((state) => state.subjects);

  const { isEditMode } = useEditMode();
  const [filter, setFilter] = useState<Filter>('active');
  const [showEmpty, setShowEmpty] = useState(false);
  const openDialog = useHomeworkDialog((state) => state.open);
  const [deleting, setDeleting] = useState<HomeworkItem | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Просроченные — срок прошёл, а «сделано» не отмечено; в «Актуальных» их нет
  const filterOf = (item: HomeworkItem): Filter =>
    done[item.id] ? 'done' : item.due !== '' && item.due < today ? 'overdue' : 'active';
  const visible = items
    .filter((item) => filter === 'all' || filterOf(item) === filter)
    .sort((a, b) => dueOrder(a).localeCompare(dueOrder(b)) || a.subject.localeCompare(b.subject, 'ru'));

  const groups = new Map<string, HomeworkItem[]>();
  for (const item of visible) groups.set(item.subject, [...(groups.get(item.subject) ?? []), item]);
  if (showEmpty) for (const subject of subjects) if (!groups.has(subject.name)) groups.set(subject.name, []);
  const ordered = [...groups].sort(
    ([nameA, a], [nameB, b]) =>
      (a[0] ? dueOrder(a[0]) : '9999').localeCompare(b[0] ? dueOrder(b[0]) : '9999') || nameA.localeCompare(nameB, 'ru'),
  );

  function download() {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([serializeHomework(items)], { type: 'application/json' }));
    link.download = 'homework.json';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <>
      <PageHeader
        title="Домашнее задание"
        subtitle="Задания группы по всем предметам. Выполнение видно только вам."
        actions={
          isEditMode && (
            <Button variant="primary" icon={Plus} onClick={() => openDialog({})}>
              Добавить
            </Button>
          )
        }
      />

      <div className={styles.toolbar}>
        <SegmentedControl label="Фильтр заданий" options={FILTERS} value={filter} onChange={setFilter} />
        <Checkbox label="Показать предметы без заданий" checked={showEmpty} onChange={(event) => setShowEmpty(event.target.checked)} />
      </div>

      {isEditMode && hasDraft && (
        <div className={styles.draft}>
          Есть неопубликованные изменения — их видите только вы. Сохраните их в GitHub, чтобы увидела вся группа.{' '}
          <Button variant="ghost" size="sm" onClick={discardDraft}>
            Отменить мои изменения
          </Button>
        </div>
      )}

      {ordered.length === 0 ? (
        <EmptyState title="Всё под контролем" description="Заданий в этом списке пока нет." />
      ) : (
        // key по фильтру: при смене вкладки каскад проигрывается заново
        <div key={filter} className="stagger">
          {ordered.map(([subject, entries]) => (
            <section key={subject} className={styles.group}>
              <div className={styles.groupHead}>
                <h2>{subject}</h2>
                <span>{entries.length ? pluralize(entries.length, ['задание', 'задания', 'заданий']) : 'нет заданий'}</span>
              </div>
              {entries.length === 0 ? (
                <p className={styles.empty}>Заданий нет.</p>
              ) : (
                entries.map((item) => (
                  <HomeworkCard
                    key={item.id}
                    item={item}
                    today={today}
                    onEdit={isEditMode ? (entry) => openDialog({ item: entry }) : undefined}
                    onDelete={isEditMode ? setDeleting : undefined}
                  />
                ))
              )}
            </section>
          ))}
        </div>
      )}

      {isEditMode && (
        <div className={styles.publish}>
          <Button variant="primary" icon={Upload} onClick={() => setPublishing(true)}>
            Сохранить в GitHub
          </Button>
          <Button variant="secondary" icon={Download} onClick={download}>
            Скачать JSON
          </Button>
          <Button
            variant="secondary"
            icon={Copy}
            onClick={() => navigator.clipboard.writeText(serializeHomework(items)).then(() => setCopied(true))}
          >
            {copied ? 'Скопировано' : 'Копировать JSON'}
          </Button>
          <a className={buttonClass('ghost', 'md')} href={repoEditUrl(HOMEWORK_PATH)} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={14} strokeWidth={1.75} aria-hidden />
            Открыть на GitHub
          </a>
        </div>
      )}
      {isEditMode && (
        <p className={styles.hint}>Добавленные задания видны вам сразу. Чтобы их увидела вся группа, сохраните изменения в GitHub.</p>
      )}

      <PublishHomeworkDialog open={publishing} onClose={() => setPublishing(false)} />
      <ConfirmDeleteModal
        open={deleting !== null}
        title="Удалить это домашнее задание?"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) deleteItem(deleting.id);
          setDeleting(null);
        }}
      />
    </>
  );
}
