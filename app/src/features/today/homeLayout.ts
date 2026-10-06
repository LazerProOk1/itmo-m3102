/** Блоки главной — в порядке по умолчанию. wide — во всю ширину, остальные — в сетку по два */
export const HOME_BLOCKS = [
  { id: 'next', label: 'Сейчас и следующая пара', wide: true },
  { id: 'review', label: 'Повторение ошибок', wide: true },
  { id: 'schedule', label: 'Пары на сегодня', wide: false },
  { id: 'deadlines', label: 'Ближайшие дедлайны', wide: false },
  { id: 'homework', label: 'Домашнее задание', wide: false },
  { id: 'materials', label: 'Материалы', wide: false },
  { id: 'plan', label: 'Мой учебный план', wide: false },
  { id: 'notes', label: 'Недавние конспекты', wide: false },
  { id: 'subjects', label: 'Предметы', wide: false },
  { id: 'bookmarks', label: 'Закладки', wide: false },
] as const;

export type HomeBlockId = (typeof HOME_BLOCKS)[number]['id'];

const KNOWN = new Set<string>(HOME_BLOCKS.map((block) => block.id));

/**
 * Порядок блоков с учётом сохранённого: сначала сохранённые (неизвестные — выброшены), затем блоки, которых
 * в сохранённом нет (появились в новой версии сайта) — на своих местах по умолчанию, в конце.
 */
export function arrangeBlocks(saved: readonly string[]): HomeBlockId[] {
  const kept = saved.filter((id, index) => KNOWN.has(id) && saved.indexOf(id) === index) as HomeBlockId[];
  const missing = HOME_BLOCKS.map((block) => block.id).filter((id) => !kept.includes(id));
  return [...kept, ...missing];
}

/** Сдвинуть блок на шаг вверх (-1) или вниз (+1) */
export function moveBlock(order: readonly HomeBlockId[], id: HomeBlockId, step: -1 | 1): HomeBlockId[] {
  const next = [...order];
  const at = next.indexOf(id);
  const to = at + step;
  if (at === -1 || to < 0 || to >= next.length) return next;
  [next[at], next[to]] = [next[to]!, next[at]!];
  return next;
}

/** Куда можно попасть при запуске сайта */
export const START_PAGES = [
  { value: '/today', label: 'Главная' },
  { value: '/schedule', label: 'Расписание' },
  { value: '/deadlines', label: 'Дедлайны' },
  { value: '/homework', label: 'Домашнее задание' },
  { value: '/materials', label: 'Материалы' },
  { value: '/calendar', label: 'Календарь' },
  { value: '/review', label: 'Повторение' },
] as const;
