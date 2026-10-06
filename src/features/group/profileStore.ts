import { create } from 'zustand';
import { storageKey } from '../../lib/storage';
import { GROUP_REPO, githubFetch, rateLimitReset } from '../../services/github';

/** Данные GitHub для профиля — раз в час: лимит API без токена 60 запросов в час на всех */
const TTL = 60 * 60_000;
const COMMITS_KEY = storageKey('contributors');

interface Cached<T> {
  at: number;
  data: T;
}

interface ProfileStore {
  /** GitHub-логин открытого профиля */
  login: string | null;
  /** Профиль уже открывали — окно загружено и остаётся в DOM */
  used: boolean;
  /** Логин → коммитов в репозиторий группы; null — ещё не загружено или GitHub недоступен */
  commits: Record<string, number> | null;
  /** Почему не обновилось (лимит GitHub, нет сети) — мелкая приписка, сохранённое показывается */
  error: string;
  open: (login: string) => void;
  close: () => void;
}

function read<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') as T | null;
  } catch {
    return null;
  }
}

/** Коротко, почему GitHub не ответил: это строка под списком, не плашка */
function failure(response?: Response): string {
  if (!response) return navigator.onLine ? 'GitHub не ответил' : 'нет интернета';
  const reset = rateLimitReset(response);
  if (reset) return `лимит запросов к GitHub, обновится в ${reset}`;
  return response.status === 403 || response.status === 429 ? 'лимит запросов к GitHub, попробуйте позже' : `GitHub ответил ${response.status}`;
}

/**
 * «Назад» закрывает профиль, а не уводит со страницы под ним. При открытии кладём в историю запись с тем же
 * адресом; роутер её не видит: её popstate перехватываем раньше него (capture на window срабатывает первым)
 * и гасим — иначе роутер перерисовал бы всё приложение и окно снова «застывало» бы. Закрыли крестиком или Esc —
 * запись убираем сами (history.back), этот popstate тоже гасим.
 */
const entry = {
  /** Наша запись сейчас верхняя в истории */
  pushed: false,
  /** Следующий popstate — от нашего же history.back() */
  swallow: false,
};

function pushProfileEntry() {
  if (entry.pushed) return;
  window.history.pushState(window.history.state, '');
  entry.pushed = true;
}

function dropProfileEntry() {
  if (!entry.pushed) return;
  entry.pushed = false;
  entry.swallow = true;
  window.history.back();
}

/**
 * Профиль студента открывается из любого места (карточка на «Студентах», имя в очереди дедлайна) — окно одно,
 * в AppShell. Своё состояние, а не адрес: смена адреса перерисовывает всё приложение, и окно «застывало».
 */
export const useProfileStore = create<ProfileStore>()((set) => {
  addEventListener(
    'popstate',
    (event) => {
      if (entry.swallow) {
        entry.swallow = false;
        event.stopImmediatePropagation();
      } else if (entry.pushed) {
        entry.pushed = false;
        event.stopImmediatePropagation();
        set({ login: null });
      }
    },
    { capture: true },
  );
  async function loadCommits() {
    // Старый формат кеша ({ at, commits }) без data — скачать заново
    const cached = read<Cached<unknown>>(COMMITS_KEY);
    if (cached?.data && Date.now() - cached.at < TTL) return;
    const { owner, repo } = GROUP_REPO;
    const response = await githubFetch(`https://api.github.com/repos/${owner}/${repo}/contributors?per_page=100`).catch(() => undefined);
    if (!response?.ok) return set({ error: failure(response) });
    const list = (await response.json()) as { login?: string; contributions?: number }[];
    const commits = Object.fromEntries(list.filter((item) => item.login).map((item) => [item.login!.toLowerCase(), item.contributions ?? 0]));
    localStorage.setItem(COMMITS_KEY, JSON.stringify({ at: Date.now(), data: commits }));
    set({ commits });
  }

  return {
    login: null,
    used: false,
    commits: read<Cached<Record<string, number>>>(COMMITS_KEY)?.data ?? null,
    error: '',
    open: (login) => {
      pushProfileEntry();
      set({ login, used: true, error: '' });
      void loadCommits();
    },
    close: () => {
      set({ login: null });
      dropProfileEntry();
    },
  };
});
