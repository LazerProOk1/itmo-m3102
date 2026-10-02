import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storageKey } from '../../lib/storage';

/**
 * Домашнее задание группы — формат data/homework.json репозитория M3102 (общий с их сайтом):
 * добавленное здесь и опубликованное в GitHub видно и на сайте группы, и наоборот.
 */
export interface HomeworkLink {
  title: string;
  url: string;
}

export interface HomeworkItem {
  id: string;
  /** Название предмета строкой — как в расписании группы */
  subject: string;
  /** Пара, с которой задано: дата, id занятия и время начала (может быть пустым) */
  lessonDate: string;
  lessonId: string;
  lessonStart: string;
  text: string;
  /** Срок сдачи "2026-10-01" или пусто */
  due: string;
  links: HomeworkLink[];
  createdAt: string;
  updatedAt: string;
}

export const HOMEWORK_PATH = 'data/homework.json';

interface HomeworkStore {
  /** Последняя загруженная версия из репозитория */
  base: HomeworkItem[];
  /** То, что видит пользователь: base + локальные, ещё не опубликованные правки */
  items: HomeworkItem[];
  hasDraft: boolean;
  /** Личные отметки «сделано» (id → когда) — не публикуются */
  done: Record<string, string>;
  setRemote: (items: HomeworkItem[]) => void;
  saveItem: (item: HomeworkItem) => void;
  deleteItem: (id: string) => void;
  toggleDone: (id: string, done: boolean) => void;
  /** Правки опубликованы — result становится и базой, и текущим списком */
  markPublished: (result: HomeworkItem[]) => void;
  discardDraft: () => void;
}

export const useHomeworkStore = create<HomeworkStore>()(
  persist(
    (set) => ({
      base: [],
      items: [],
      hasDraft: false,
      done: {},
      setRemote: (items) => set((state) => ({ base: items, items: state.hasDraft ? state.items : items })),
      saveItem: (item) =>
        set((state) => ({
          hasDraft: true,
          items: state.items.some((row) => row.id === item.id) ? state.items.map((row) => (row.id === item.id ? item : row)) : [...state.items, item],
        })),
      deleteItem: (id) => set((state) => ({ hasDraft: true, items: state.items.filter((row) => row.id !== id) })),
      toggleDone: (id, done) =>
        set((state) => {
          const next = { ...state.done };
          if (done) next[id] = new Date().toISOString();
          else delete next[id];
          return { done: next };
        }),
      markPublished: (result) => set({ base: result, items: result, hasDraft: false }),
      discardDraft: () => set((state) => ({ items: state.base, hasDraft: false })),
    }),
    { name: storageKey('homework') },
  ),
);

export function validUrl(raw: string): string {
  try {
    const url = new URL(raw.trim());
    return /^https?:$/.test(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

/** Разбор и чистка homework.json — чужие данные, поэтому каждое поле приводится к строке */
export function parseHomework(raw: unknown): HomeworkItem[] {
  const items = (raw as { items?: unknown })?.items;
  if (!Array.isArray(items)) throw new Error('Неверный формат homework.json');
  return items
    .filter((item) => item && typeof item.id === 'string')
    .map((item) => ({
      id: item.id,
      subject: String(item.subject ?? ''),
      lessonDate: String(item.lessonDate ?? ''),
      lessonId: String(item.lessonId ?? ''),
      lessonStart: String(item.lessonStart ?? ''),
      text: String(item.text ?? ''),
      due: String(item.due ?? ''),
      links: Array.isArray(item.links)
        ? item.links
            .map((link: { title?: unknown; url?: unknown }) => ({
              title: String(link?.title ?? link?.url ?? ''),
              url: validUrl(String(link?.url ?? '')),
            }))
            .filter((link: HomeworkLink) => link.url)
        : [],
      createdAt: String(item.createdAt ?? ''),
      updatedAt: String(item.updatedAt ?? ''),
    }));
}

export const serializeHomework = (items: HomeworkItem[]) => JSON.stringify({ version: 1, items }, null, 2) + '\n';

/**
 * Слияние при публикации (как mergeHomework на сайте M3102): записи, изменённые локально, побеждают,
 * удалённые локально — удаляются, всё остальное (в т.ч. чужие новые записи) берётся из свежей версии.
 */
export function mergeHomework(base: HomeworkItem[], remote: HomeworkItem[], local: HomeworkItem[]): HomeworkItem[] {
  const before = new Map(base.map((item) => [item.id, item]));
  const desired = new Map(local.map((item) => [item.id, item]));
  const result = new Map(remote.map((item) => [item.id, item]));
  for (const [id, item] of desired) if (JSON.stringify(item) !== JSON.stringify(before.get(id))) result.set(id, item);
  for (const id of before.keys()) if (!desired.has(id)) result.delete(id);
  return [...result.values()];
}
