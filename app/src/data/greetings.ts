import { slotsAlbum } from '../lib/slotsAlbum';
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

/** Шутки из капсул «Колючего куша»: пак открывается, когда выпал предмет greet:<id>. Запасные — как у группы */
export const GREETING_PACKS: Record<string, string[]> = {
  cat: ['Кот сидит на конспекте.', 'Мур-мур-мур, Коши.'],
  rust: ['Борроу-чекер недоволен.', 'Если компилируется — значит, работает.'],
  matan: ['Для любого ε найдётся δ.', 'Сходится абсолютно. Как и ваш дедлайн.'],
  orange: ['Вы Апельсин? Мы Апельсин.', 'Апельсиновое настроение.'],
  casino: ['Ставки сделаны — ягоды потрачены.', 'Крупье-ёжик приветствует вас.'],
};

/** Строковые литералы из куска кода группы; комментарии пропускаем (в них бывают кавычки) */
function stringLiterals(body: string): string[] {
  const lines: string[] = [];
  for (const match of body.matchAll(/\/\/[^\n]*|\/\*[\s\S]*?\*\/|'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"/g)) {
    const text = (match[1] ?? match[2])?.replace(/\\(.)/g, '$1').trim();
    if (text) lines.push(text);
  }
  return lines;
}

/**
 * Строки из js/greetings.js группы: берём только строковые литералы, сам файл не исполняем.
 * Комментарии пропускаем (в шапке файла есть кавычки). Нет ни одной строки — null, остаётся прежний список.
 */
export function parseGreetings(source: string): string[] | null {
  const body = /GREETINGS\s*=\s*\[([\s\S]*?)\]\s*;/.exec(source)?.[1];
  const lines = body ? stringLiterals(body) : [];
  return lines.length > 0 && lines.length <= 200 ? lines : null;
}

/** Паки из GREETING_PACKS того же файла: `cat: ['…', '…'],` — нет ни одного — null, остаются запасные */
export function parseGreetingPacks(source: string): Record<string, string[]> | null {
  const body = /GREETING_PACKS\s*=\s*\{([\s\S]*?)\}\s*;/.exec(source)?.[1];
  if (!body) return null;
  const packs: Record<string, string[]> = {};
  for (const match of body.matchAll(/(\w+)\s*:\s*\[([\s\S]*?)\]/g)) {
    const lines = stringLiterals(match[2]!);
    if (lines.length > 0 && lines.length <= 20) packs[match[1]!] = lines;
  }
  return Object.keys(packs).length > 0 ? packs : null;
}

const STORAGE_KEY = storageKey('greetings');
const PACKS_KEY = storageKey('greeting-packs');
let synced: string[] | null | undefined;
let syncedPacks: Record<string, string[]> | null | undefined;

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

/** Паки, которые подтянула синхронизация, иначе запасные */
function currentPacks(): Record<string, string[]> {
  if (syncedPacks === undefined) {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(PACKS_KEY) ?? 'null');
      syncedPacks = saved && typeof saved === 'object' && !Array.isArray(saved) ? (saved as Record<string, string[]>) : null;
    } catch {
      syncedPacks = null;
    }
  }
  return syncedPacks ?? GREETING_PACKS;
}

/** Запомнить список (и паки) группы: показывается с этой же сессии, переживает перезагрузку */
export function saveGreetings(lines: string[], packs?: Record<string, string[]> | null): void {
  synced = lines;
  if (packs) syncedPacks = packs;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    if (packs) localStorage.setItem(PACKS_KEY, JSON.stringify(packs));
  } catch {
    // Хранилище запрещено или переполнено — до перезагрузки список всё равно работает
  }
}

/** Строки паков, которые уже выпали из капсул */
function unlockedGreetings(): string[] {
  const album = slotsAlbum(),
    packs = currentPacks();
  return Object.entries(packs).flatMap(([id, lines]) =>
    album[`greet:${id}`] && Array.isArray(lines) ? lines.filter((line) => typeof line === 'string') : [],
  );
}

let previous = '';

/** Случайная строка; одна и та же два раза подряд не выпадает */
export function pickGreeting(random = Math.random): string {
  const all = [...currentGreetings(), ...unlockedGreetings()];
  const pool = all.length > 1 ? all.filter((line) => line !== previous) : all;
  previous = pool[Math.floor(random() * pool.length)] ?? all[0]!;
  return previous;
}

/** "Ваш учебный день." → ["Ваш учебный день", "."]; многоточие и другие концовки не трогаем */
export function splitAccentPeriod(line: string): [string, string] {
  return /[^.]\.$/.test(line) ? [line.slice(0, -1), '.'] : [line, ''];
}
