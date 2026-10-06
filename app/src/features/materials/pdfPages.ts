import { storageKey } from '../../lib/storage';

/** Где остановился в каждом PDF: { файл: страница }, последние 100 файлов. Отдельный модуль: главной нужна только страница, а не pdf.js */
const PAGES_KEY = storageKey('pdf-pages');
const MAX_REMEMBERED = 100;

function readPages(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(PAGES_KEY) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
}

export function savedPage(file: string): number {
  return readPages()[file] ?? 0;
}

export function savePage(file: string, page: number) {
  const pages = readPages();
  delete pages[file]; // свежий — в конец, старые вытесняются первыми
  if (page > 1) pages[file] = page;
  const entries = Object.entries(pages).slice(-MAX_REMEMBERED);
  try {
    localStorage.setItem(PAGES_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Приватный режим или нет места — просто не запомним
  }
}
