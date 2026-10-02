import { ExternalLink, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button, buttonClass } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { PageHeader } from '../../components/ui/PageHeader';
import { cn } from '../../lib/cn';
import { GROUP_REPO, githubError, githubFetch, repoEditUrl } from '../../services/github';
import { useGroupStore, type GroupDeadline } from '../group/groupStore';
import { deadlineInfo, orderDeadlines } from './deadlineInfo';
import { useEditMode } from '../settings/EditModeContext';
import styles from './DeadlinesPage.module.css';

/** Очередь сдачи — открытые issues с меткой queue-signup и заголовком "[id дедлайна] Имя" */
const QUEUE_LABEL = 'queue-signup';

interface QueueEntry {
  name: string;
  url: string;
}

async function loadQueues(): Promise<Record<string, QueueEntry[]>> {
  const { owner, repo } = GROUP_REPO;
  const response = await githubFetch(
    `https://api.github.com/repos/${owner}/${repo}/issues?labels=${QUEUE_LABEL}&state=open&sort=created&direction=asc&per_page=100`,
  );
  if (!response.ok) throw new Error(githubError(response.status, false, response));
  const issues = (await response.json()) as { title?: string; html_url: string; pull_request?: unknown }[];
  const queues: Record<string, QueueEntry[]> = {};
  for (const issue of issues) {
    const match = !issue.pull_request && /^\[([^\]]+)\]\s*(.*)$/.exec(issue.title ?? '');
    if (!match) continue;
    (queues[match[1]!.trim()] ??= []).push({ name: match[2]!.trim() || '(без имени)', url: issue.html_url });
  }
  return queues;
}

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
  const [queues, setQueues] = useState<Record<string, QueueEntry[]>>({});
  const [queueError, setQueueError] = useState('');
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setQueues(await loadQueues());
      setQueueError('');
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : 'Не удалось загрузить очередь.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onVisible = () => !document.hidden && void refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  const remaining = deadlines.filter((item) => !doneMap[item.id]).length;

  return (
    <>
      <PageHeader
        title="Дедлайны"
        subtitle="Сроки сдачи и очередь группы М3102. Отметки выполнения видны только вам."
        actions={
          <>
            <Button variant="ghost" onClick={refresh} disabled={loading}>
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
                queueError={queueError}
                onJoined={() => setTimeout(refresh, 8000)}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}

interface DeadlineCardProps {
  item: GroupDeadline;
  index: number;
  done: boolean;
  queue: QueueEntry[];
  queueError: string;
  onJoined: () => void;
}

function DeadlineCard({ item, index, done, queue, queueError, onJoined }: DeadlineCardProps) {
  const toggleDone = useGroupStore((state) => state.toggleDeadlineDone);
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

      <div className={styles.queueHead}>
        Очередь <span>{queueError ? 'недоступна' : `${queue.length} чел.`}</span>
      </div>
      <ol className={styles.queue}>
        {queue.length === 0 ? (
          <li className={styles.queueEmpty}>{queueError || 'Очередь пока пуста'}</li>
        ) : (
          queue.map((entry) => (
            <li key={entry.url}>
              <a href={entry.url} target="_blank" rel="noopener noreferrer">
                {entry.name}
              </a>
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
      <Checkbox label="Выполнено для меня" checked={done} onChange={(event) => toggleDone(item.id, event.target.checked)} />
    </article>
  );
}
