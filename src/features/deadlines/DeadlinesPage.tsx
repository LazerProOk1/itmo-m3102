import { ExternalLink, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Badge } from '../../components/ui/Badge';
import { Button, buttonClass } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { PageHeader } from '../../components/ui/PageHeader';
import { useConfettiWhenCleared } from '../../lib/celebrate';
import { cn } from '../../lib/cn';
import { GROUP_REPO, repoEditUrl } from '../../services/github';
import { filePath, useGroupStore, type GroupDeadline } from '../group/groupStore';
import { resolveSubjectFolder } from '../../data/m3102';
import { deadlineSubjectId } from '../subjects/subjectStats';
import { useSubjectsStore } from '../subjects/subjectsStore';
import { deadlineInfo, orderDeadlines } from './deadlineInfo';
import { useEditMode } from '../settings/EditModeContext';
import { useProfileStore } from '../group/profileStore';
import { useQueueStore, type QueueEntry } from './queueStore';
import styles from './DeadlinesPage.module.css';

/**
 * Метку queue-signup ставит workflow label-deadline-signups.yml в репозитории группы: через ?labels=
 * GitHub разрешает ставить метки только участникам репозитория, у остальных запись терялась.
 */
export function joinQueueUrl(deadlineId: string, name: string): string {
  const { owner, repo } = GROUP_REPO;
  return `https://github.com/${owner}/${repo}/issues/new?title=${encodeURIComponent(`[${deadlineId}] ${name}`)}`;
}

const formatFull = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Дедлайны группы М3102: сроки из репозитория, общая очередь сдачи и личные отметки выполнения. */
export function DeadlinesPage() {
  const { isEditMode } = useEditMode();
  const deadlines = useGroupStore((state) => state.deadlines);
  const doneMap = useGroupStore((state) => state.deadlinesDone);
  useConfettiWhenCleared(deadlines.filter((item) => !doneMap[item.id]).length);
  const { queues, at: queueAt, error: queueError, loading, refresh, refreshIfStale } = useQueueStore();
  const queueKnown = queueAt > 0;

  useEffect(() => {
    // Открыли страницу или вернулись во вкладку — сами обновляем не чаще раза в 2 минуты (лимит GitHub API);
    // кнопка «Обновить» — всегда
    refreshIfStale();
    document.addEventListener('visibilitychange', refreshIfStale);
    return () => document.removeEventListener('visibilitychange', refreshIfStale);
  }, [refreshIfStale]);

  const remaining = deadlines.filter((item) => !doneMap[item.id]).length;

  return (
    <>
      <PageHeader
        title="Дедлайны"
        subtitle="Сроки сдачи и очередь группы М3102. Отметки выполнения видны только вам."
        actions={
          <>
            <Button variant="ghost" onClick={() => void refresh()} disabled={loading}>
              <RefreshCw size={14} strokeWidth={2} className={cn(loading && styles.spinning)} aria-hidden />
              Обновить
            </Button>
            {isEditMode && (
              <a className={buttonClass('secondary', 'md')} href={repoEditUrl('Дедлайны/deadlines.json')} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={14} strokeWidth={1.75} aria-hidden />
                Изменить сроки
              </a>
            )}
          </>
        }
      />

      {deadlines.length === 0 ? (
        <EmptyState title="Дедлайнов пока нет" description="Они появятся после синхронизации с репозиторием группы." />
      ) : (
        <>
          <div className={styles.overview}>
            <span className={styles.overviewLabel}>В фокусе</span>
            <strong>
              {remaining} <small>из {deadlines.length} сроков</small>
            </strong>
          </div>
          <div className={`${styles.grid} stagger`}>
            {orderDeadlines(deadlines, doneMap).map((item, index) => (
              <DeadlineCard
                key={item.id}
                item={item}
                index={index}
                done={Boolean(doneMap[item.id])}
                queue={queues[item.id] ?? []}
                queueKnown={queueKnown}
                onJoined={() => setTimeout(() => void refresh(), 8000)}
              />
            ))}
          </div>
          {queueError && (
            <p className={styles.staleNote}>
              {queueKnown ? `Очередь от ${formatClock(queueAt)}: обновить не вышло — ${queueError}.` : `Очередь не загрузилась: ${queueError}.`}
            </p>
          )}
        </>
      )}
    </>
  );
}

/** «14:32», а если не сегодня — «5 окт., 14:32» */
function formatClock(at: number): string {
  const date = new Date(at);
  const time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return date.toDateString() === new Date().toDateString()
    ? time
    : `${date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}, ${time}`;
}

/** Связи дедлайна: предмет «АИСД - Лаба» → страница предмета, его конспекты и папка лабораторных группы */
function DeadlineLinks({ name }: { name: string }) {
  const subjectId = deadlineSubjectId(name);
  const subjectName = useSubjectsStore((state) => state.subjects.find((subject) => subject.id === subjectId)?.name);
  const labsFolder = useGroupStore((state) => {
    const file = state.files.find(
      (item) => item.path.startsWith('Лабораторные/') && resolveSubjectFolder(item.path.split('/')[1] ?? '') === subjectId,
    );
    return file && file.path.split('/').slice(0, 2).join('/');
  });
  if (!subjectId || !subjectName) return null;
  return (
    <p className={styles.links}>
      <Link to={`/subjects/${subjectId}`}>{subjectName}</Link>
      <Link to={`/materials?s=${subjectId}`}>Конспекты</Link>
      {labsFolder && <Link to={filePath(labsFolder)}>Лабораторные</Link>}
    </p>
  );
}

interface DeadlineCardProps {
  item: GroupDeadline;
  index: number;
  done: boolean;
  queue: QueueEntry[];
  /** Очередь хоть раз загружалась (показываем сохранённую, даже если обновить сейчас не вышло) */
  queueKnown: boolean;
  onJoined: () => void;
}

function DeadlineCard({ item, index, done, queue, queueKnown, onJoined }: DeadlineCardProps) {
  const toggleDone = useGroupStore((state) => state.toggleDeadlineDone);
  const openProfile = useProfileStore((state) => state.open);
  const [name, setName] = useState('');
  const badge = deadlineInfo(item.deadline);

  function join() {
    if (!name.trim()) return;
    window.open(joinQueueUrl(item.id, name.trim()), '_blank', 'noopener');
    onJoined();
  }

  return (
    <article className={cn(styles.card, done && styles.done)} data-spot>
      <div className={styles.cardTop}>
        <span className={styles.index}>{String(index + 1).padStart(2, '0')}</span>
        <Badge tone={badge.tone}>{badge.label}</Badge>
      </div>
      <h3 className={styles.title}>{item.name}</h3>
      <p className={styles.note}>
        до {formatFull(item.deadline)}
        {item.note && ` · ${item.note}`}
      </p>
      <DeadlineLinks name={item.name} />

      <div className={styles.queueHead}>
        Очередь <span>{queueKnown ? `${queue.length} чел.` : 'не загрузилась'}</span>
      </div>
      <ol className={styles.queue}>
        {queue.length === 0 ? (
          <li className={styles.queueEmpty}>{queueKnown ? 'Очередь пока пуста' : 'Появится, когда GitHub ответит'}</li>
        ) : (
          queue.map((entry) => (
            <li key={entry.url}>
              {/* Студент группы — чип с фото: видно, что это человек и его можно открыть; чужой — запись на GitHub */}
              {entry.login ? (
                <button
                  type="button"
                  className={styles.queuePerson}
                  onClick={() => openProfile(entry.login!)}
                  aria-label={`${entry.name} — открыть профиль`}
                >
                  <img src={`https://github.com/${encodeURIComponent(entry.login)}.png?size=40`} alt="" loading="lazy" />
                  {entry.name}
                </button>
              ) : (
                <a href={entry.url} target="_blank" rel="noopener noreferrer">
                  {entry.name}
                </a>
              )}
              {entry.note && <span className={styles.queueNote}>{entry.note}</span>}
            </li>
          ))
        )}
      </ol>
      <form
        className={styles.join}
        onSubmit={(event) => {
          event.preventDefault();
          join();
        }}
      >
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ваше имя" aria-label={`Имя для очереди «${item.name}»`} />
        <Button type="submit" variant="primary" disabled={!name.trim()}>
          В очередь ↗
        </Button>
      </form>
      <Checkbox celebrate label="Выполнено для меня" checked={done} onChange={(event) => toggleDone(item.id, event.target.checked)} />
    </article>
  );
}
