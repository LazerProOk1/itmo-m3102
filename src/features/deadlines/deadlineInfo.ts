import type { BadgeTone } from '../../components/ui/Badge';
import type { GroupDeadline } from '../group/groupStore';

const DAY_MS = 86_400_000;
const dayStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

export interface DeadlineInfo {
  state: 'late' | 'urgent' | 'soon' | 'ok';
  /** «Сегодня», «Завтра», «Через 7 дн.», «Просрочен» */
  label: string;
  tone: BadgeTone;
}

const TONES: Record<DeadlineInfo['state'], BadgeTone> = { late: 'danger', urgent: 'danger', soon: 'warning', ok: 'success' };

/**
 * Статус срока как на сайте группы: дни считаются по календарю, а не «округлёнными сутками»
 * (дедлайн завтра в 23:59 — «Завтра», а не «через 2 дн.»). Цвет — по оставшимся часам.
 */
export function deadlineInfo(iso: string, now = Date.now()): DeadlineInfo {
  const due = new Date(iso);
  const diff = due.getTime() - now;
  const days = Math.round((dayStart(due) - dayStart(new Date(now))) / DAY_MS);
  const hours = diff / 3_600_000;
  const state: DeadlineInfo['state'] = diff <= 0 ? 'late' : hours < 24 ? 'urgent' : hours < 72 ? 'soon' : 'ok';
  const label = diff <= 0 ? 'Просрочен' : days === 0 ? 'Сегодня' : days === 1 ? 'Завтра' : `Через ${days} дн.`;
  return { state, label, tone: TONES[state] };
}

/** Порядок как на сайте группы: ближайшие → просроченные (свежие выше) → выполненные */
export function orderDeadlines(items: GroupDeadline[], done: Record<string, boolean>, now = Date.now()): GroupDeadline[] {
  const time = (item: GroupDeadline) => new Date(item.deadline).getTime();
  const rank = (item: GroupDeadline) => (done[item.id] ? 2 : time(item) <= now ? 1 : 0);
  return [...items].sort((a, b) => rank(a) - rank(b) || (rank(a) === 1 ? time(b) - time(a) : time(a) - time(b)));
}
