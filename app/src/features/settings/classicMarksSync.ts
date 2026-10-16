import { storageKey } from '../../lib/storage';
import { applyClassicMarks, countNew, currentAppMarks, previewImport, readClassicMarks } from './classicMarks';

/**
 * Отметки «сделано» из классической версии подхватываются сами: при открытии приложения и на лету, если она открыта в соседней
 * вкладке. Только добавляем и только чтение её ключей. Какие отметки уже учтены, помнит `SEEN_KEY`: снял отметку здесь — она
 * не вернётся при следующем открытии, хотя в классической ещё стоит.
 */
const SEEN_KEY = storageKey('classic-marks-seen');
const CLASSIC_KEYS = ['m3102-hw-done-v1', 'm3102-study-plan-v1'];

interface Seen {
  homework: string[];
  deadlines: string[];
}

function readSeen(): Seen {
  try {
    const raw = JSON.parse(localStorage.getItem(SEEN_KEY) ?? 'null') as Partial<Seen> | null;
    return { homework: Array.isArray(raw?.homework) ? raw.homework : [], deadlines: Array.isArray(raw?.deadlines) ? raw.deadlines : [] };
  } catch {
    return { homework: [], deadlines: [] };
  }
}

/** Сколько отметок добавилось в приложение */
export function syncClassicMarks(): number {
  const marks = readClassicMarks();
  const seen = readSeen();
  const known = { homework: new Set(seen.homework), deadlines: new Set(seen.deadlines) };
  const preview = previewImport(marks, currentAppMarks());
  const fresh = {
    ...preview,
    newHomework: Object.fromEntries(Object.entries(preview.newHomework).filter(([id]) => !known.homework.has(id))),
    newDeadlines: preview.newDeadlines.filter((id) => !known.deadlines.has(id)),
  };
  const added = countNew(fresh);
  if (added > 0) applyClassicMarks(fresh);
  // Всё, что сейчас есть в классической, учтено: и добавленное, и то, что у нас уже было
  const nextHomework = [...new Set([...seen.homework, ...Object.keys(marks.homework)])];
  const nextDeadlines = [...new Set([...seen.deadlines, ...marks.deadlines])];
  if (nextHomework.length !== seen.homework.length || nextDeadlines.length !== seen.deadlines.length) {
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify({ homework: nextHomework, deadlines: nextDeadlines }));
    } catch {
      // Хранилище закрыто — при следующем открытии отметка просто добавится ещё раз
    }
  }
  return added;
}

export function startClassicMarksSync(): void {
  syncClassicMarks();
  addEventListener('storage', (event) => {
    if (event.key && CLASSIC_KEYS.includes(event.key)) syncClassicMarks();
  });
  addEventListener('pageshow', (event) => {
    if (event.persisted) syncClassicMarks();
  });
}
