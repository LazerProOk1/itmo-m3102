import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storageKey } from '../../lib/storage';

/** Дедлайн из Дедлайны/deadlines.json репозитория группы */
export interface GroupDeadline {
  id: string;
  name: string;
  /** "2026-10-02T23:59:00+03:00" */
  deadline: string;
  note?: string;
}

/** Файл репозитория группы — для браузера файлов (как вкладка «Материалы» на сайте M3102) */
export interface RepoFile {
  path: string;
  size: number;
}

/** Полезная ссылка из data/links.json — формы сдачи, чужие конспекты, курсы */
export interface GroupLink {
  title: string;
  description: string;
  url: string;
  /** Раздел на странице */
  group: string;
  subject: string;
  /** Подпись типа; пусто — определяется по адресу */
  kind: string;
}

interface GroupStore {
  deadlines: GroupDeadline[];
  links: GroupLink[];
  /** Личные отметки «выполнено» — видны только в этом браузере */
  deadlinesDone: Record<string, boolean>;
  files: RepoFile[];
  toggleDeadlineDone: (id: string, done: boolean) => void;
}

export const useGroupStore = create<GroupStore>()(
  persist(
    (set) => ({
      deadlines: [],
      links: [],
      deadlinesDone: {},
      files: [],
      toggleDeadlineDone: (id, done) => set((state) => ({ deadlinesDone: { ...state.deadlinesDone, [id]: done } })),
    }),
    { name: storageKey('group') },
  ),
);

export function parseDeadlines(raw: unknown): GroupDeadline[] {
  if (!Array.isArray(raw)) throw new Error('Неверный формат deadlines.json');
  return raw
    .filter((item): item is GroupDeadline => Boolean(item?.id && item?.name && Number.isFinite(new Date(item.deadline).getTime())))
    .map(({ id, name, deadline, note }) => ({
      id: String(id),
      name: String(name),
      deadline: String(deadline),
      note: note ? String(note) : undefined,
    }))
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
}

function safeUrl(raw: string): string {
  try {
    const url = new URL(raw);
    return /^https?:$/.test(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

export function parseLinks(raw: unknown): GroupLink[] {
  const items = (raw as { items?: unknown })?.items;
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item?.title && safeUrl(String(item.url ?? '')))
    .map((item) => ({
      title: String(item.title),
      description: String(item.description ?? ''),
      url: safeUrl(String(item.url)),
      group: String(item.group || 'Прочее'),
      subject: String(item.subject ?? ''),
      kind: String(item.kind ?? ''),
    }));
}

/** Файлы и папки сайта, которые не относятся к материалам — как isHiddenPath на сайте M3102 */
const HIDDEN_FILES = ['site.css', 'package.json', 'readme.md', '.gitignore', 'index.html'];
const HIDDEN_FOLDERS = ['tests', 'inner', 'data', 'js', 'css', 'docs', 'img', '.github', 'дедлайны', 'tools', 'src', 'public'];

export function isHiddenPath(path: string): boolean {
  const parts = path.split('/');
  return HIDDEN_FILES.includes(parts[parts.length - 1]!.toLowerCase()) || parts.some((part) => HIDDEN_FOLDERS.includes(part.toLowerCase()));
}

/** Адрес страницы просмотра файла из репозитория группы (`#/files/...`) */
export const filePath = (path: string) => `/files/${path.split('/').map(encodeURIComponent).join('/')}`;
