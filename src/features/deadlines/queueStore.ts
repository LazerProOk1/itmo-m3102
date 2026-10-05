import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { localStore, storageKey } from '../../lib/storage';
import { GROUP_REPO, githubError, githubFetch, rateLimitReset } from '../../services/github';
import { queueLogin, queuePerson } from './queueNames';

/** Очередь сдачи — открытые issues с меткой queue-signup и заголовком "[id дедлайна] Имя" */
const QUEUE_LABEL = 'queue-signup';
/** Сами обновляем не чаще раза в 2 минуты: каждый запрос тратит лимит GitHub API (60 в час) */
const QUEUE_TTL = 2 * 60_000;

export interface QueueEntry {
  /** «Имя Фамилия» студента по GitHub-автору записи; не из группы — что он написал в заголовке */
  name: string;
  /** Что написано в заголовке сверх имени («(10.10.26)») или @логин автора не из группы */
  note?: string;
  /** GitHub-логин того, кто стоит (если он из группы) — открывает его профиль */
  login?: string;
  url: string;
}

async function loadQueues(): Promise<Record<string, QueueEntry[]>> {
  const { owner, repo } = GROUP_REPO;
  const response = await githubFetch(
    `https://api.github.com/repos/${owner}/${repo}/issues?labels=${QUEUE_LABEL}&state=open&sort=created&direction=asc&per_page=100`,
  );
  if (!response.ok) {
    // Коротко — это мелкая приписка под списком, а не плашка: сохранённая очередь показывается как есть
    const reset = rateLimitReset(response);
    if (reset) throw new Error(`лимит запросов к GitHub, обновится в ${reset}`);
    if (response.status === 403 || response.status === 429) throw new Error('лимит запросов к GitHub, попробуйте позже');
    throw new Error(githubError(response.status, false, response));
  }
  const issues = (await response.json()) as { title?: string; html_url: string; pull_request?: unknown; user?: { login?: string } }[];
  const queues: Record<string, QueueEntry[]> = {};
  for (const issue of issues) {
    const match = !issue.pull_request && /^\[([^\]]+)\]\s*(.*)$/.exec(issue.title ?? '');
    if (!match) continue;
    // Кто стоит — по GitHub-аккаунту автора и базе студентов: в заголовке пишут что угодно («Ладно Федя, я начну»)
    const typed = match[2]!.trim();
    const entry: QueueEntry = { ...queuePerson(typed, issue.user?.login), login: queueLogin(typed, issue.user?.login), url: issue.html_url };
    (queues[match[1]!.trim()] ??= []).push(entry);
  }
  return queues;
}

interface QueueStore {
  /** id дедлайна → очередь по порядку записи */
  queues: Record<string, QueueEntry[]>;
  at: number;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  /** Обновить, если данные старше 2 минут (страница дедлайнов, профиль) */
  refreshIfStale: () => void;
}

/**
 * Общая очередь сдачи — её показывают «Дедлайны» и профиль студента. Последняя загруженная сохраняется в браузере:
 * упёрлись в лимит GitHub или нет сети — показываем её, а внизу мелко пишем, почему не обновилась.
 */
export const useQueueStore = create<QueueStore>()(
  persist(
    (set, get) => ({
      queues: {},
      at: 0,
      loading: false,
      error: '',
      refresh: async () => {
        if (get().loading) return;
        set({ loading: true });
        try {
          set({ queues: await loadQueues(), at: Date.now(), error: '' });
        } catch (error) {
          set({
            error: !navigator.onLine ? 'нет интернета' : error instanceof Error ? error.message : 'не удалось загрузить очередь',
          });
        } finally {
          set({ loading: false });
        }
      },
      refreshIfStale: () => {
        if (!document.hidden && Date.now() - get().at > QUEUE_TTL) void get().refresh();
      },
    }),
    { name: storageKey('queue'), storage: localStore, partialize: ({ queues, at }) => ({ queues, at }) as QueueStore },
  ),
);
