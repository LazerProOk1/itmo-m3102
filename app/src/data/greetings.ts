import { slotsAlbum } from '../lib/slotsAlbum';
import { storageKey } from '../lib/storage';

/**
 * Заголовки главной и паки из капсул «Колючего куша» — файл группы js/greetings.js, читается при сборке (копии нет). Это запасной
 * вариант: синхронизация подтягивает актуальный файл и между деплоями, и показывается он (см. `saveGreetings`).
 * Строка с одной точкой в конце — точка красится акцентом.
 */
import { GREETINGS, GREETING_PACKS } from '../../../js/greetings.js';

export { GREETINGS, GREETING_PACKS };

export const RUNAWAY_GREETING = 'Ёжик вырвался на свободу.';

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
