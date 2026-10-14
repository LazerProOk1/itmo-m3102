import { storageKey } from '../lib/storage';

/**
 * Заголовки главной — те же, что на сайте группы (js/greetings.js в их репозитории). Это запасной список:
 * синхронизация сама подтягивает актуальный файл группы, и показывается он (см. `saveGreetings`).
 * Строка с одной точкой в конце — точка красится акцентом.
 */
export const GREETINGS = [
  'Ваш учебный день.',
  'Здравствуйте, Влад Сергеевич.',
  'С днём Мастер-теоремы.',
  'Вы Апельсин?',
  'Доо, доо, коллега.',
  'Несложно заметить, что...',
  'Очевидно, что...',
  'Ёжик вырвался на свободу.',
  'Архимедовость достигнута.',
  'Нашли разделяющий элемент.',
  'Отделали сумму меньше ε.',
  'Для любого сколь угодно малого...',
  'Счетное объединение счетных множеств.',
  'Напишите на Rust.',
  'Вы на кольце квадратных матриц.',
  'Тестик на пять минут.',
  'Ваше учебное пространство.',
  'Он делает сальто.',
  'Яндекс коворк закрыли.',
  'Почитай конспекты.',
  'Кто пришел на лекцию по ИСРПО?',
  'Мяу.',
  // Добавлены у группы 06.10.2026 (коммит 4c4f9ce)
  'Сегодня будет консультация?',
  'Коши.',
  'Теорема Кантора.',
  'Последовательность сходится, а вы нет.',
  'Эпсилон-окрестность вашего дедлайна.',
  'Интеграл не берётся. Совсем.',
  'Аналогично доказывается обратное.',
  'Асимптотически вы уже опоздали.',
  'O(1) до дедлайна.',
  'Переполнение стека во время лекции.',
  'P = NP? Не сегодня.',
  'Segmentation fault (core dumped).',
  'Пересдача — тоже часть образовательной траектории.',
  'Ёжик сдал матан с первого раза.',
  'Фыр-фыр.',
  'Удар по ДОЦ Яндекса.',
];

export const RUNAWAY_GREETING = 'Ёжик вырвался на свободу.';

/**
 * Строки из js/greetings.js группы: берём только строковые литералы, сам файл не исполняем.
 * Комментарии пропускаем (в шапке файла есть кавычки). Нет ни одной строки — null, остаётся прежний список.
 */
export function parseGreetings(source: string): string[] | null {
  const body = /GREETINGS\s*=\s*\[([\s\S]*?)\]\s*;/.exec(source)?.[1];
  if (!body) return null;
  const lines: string[] = [];
  for (const match of body.matchAll(/\/\/[^\n]*|\/\*[\s\S]*?\*\/|'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"/g)) {
    const text = (match[1] ?? match[2])?.replace(/\\(.)/g, '$1').trim();
    if (text) lines.push(text);
  }
  return lines.length > 0 && lines.length <= 200 ? lines : null;
}

const STORAGE_KEY = storageKey('greetings');
let synced: string[] | null | undefined;

/** Список, который подтянула синхронизация (хранится в браузере), иначе встроенный */
function currentGreetings(): string[] {
  if (synced === undefined) {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
      synced = Array.isArray(saved) && saved.length > 0 && saved.every((line) => typeof line === 'string') ? (saved as string[]) : null;
    } catch {
      synced = null;
    }
  }
  return synced ?? GREETINGS;
}

/** Запомнить список группы: показывается с этой же сессии, переживает перезагрузку */
export function saveGreetings(lines: string[]): void {
  synced = lines;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    // Хранилище запрещено или переполнено — до перезагрузки список всё равно работает
  }
}

let previous = '';

/** Случайная строка; одна и та же два раза подряд не выпадает */
export function pickGreeting(random = Math.random): string {
  const all = currentGreetings();
  const pool = all.length > 1 ? all.filter((line) => line !== previous) : all;
  previous = pool[Math.floor(random() * pool.length)] ?? all[0]!;
  return previous;
}

/** "Ваш учебный день." → ["Ваш учебный день", "."]; многоточие и другие концовки не трогаем */
export function splitAccentPeriod(line: string): [string, string] {
  return /[^.]\.$/.test(line) ? [line.slice(0, -1), '.'] : [line, ''];
}
