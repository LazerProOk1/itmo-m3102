import { timeToMinutes } from '../../lib/dates';
import type { ClassOccurrence, DaySchedule } from './occurrences';

export interface GridSlot {
  occurrence: ClassOccurrence;
  /** Минуты от начала суток */
  start: number;
  end: number;
  /** Пары в одно время (перенос сюда и отменённая на её месте) — рядом, каждая в своей дорожке */
  lane: number;
  lanes: number;
}

/** Часы сетки: от часа первой пары недели до часа после последней; пустая неделя — 9:00–18:00 */
export function gridHours(days: DaySchedule[]): { from: number; to: number } {
  const all = days.flatMap((day) => day.occurrences);
  if (all.length === 0) return { from: 9 * 60, to: 18 * 60 };
  const from = Math.min(...all.map((item) => timeToMinutes(item.details.startTime)));
  const to = Math.max(...all.map((item) => timeToMinutes(item.details.endTime)));
  return { from: Math.floor(from / 60) * 60, to: Math.ceil(to / 60) * 60 };
}

/** Раскладка дня: пересекающиеся по времени пары делят ширину колонки поровну */
export function layoutDay(occurrences: ClassOccurrence[]): GridSlot[] {
  const slots = occurrences
    .map((occurrence) => ({
      occurrence,
      start: timeToMinutes(occurrence.details.startTime),
      end: Math.max(timeToMinutes(occurrence.details.endTime), timeToMinutes(occurrence.details.startTime) + 30),
      lane: 0,
      lanes: 1,
    }))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  // Группа — пары, связанные пересечениями; внутри неё каждая занимает первую свободную дорожку
  let group: GridSlot[] = [];
  let groupEnd = -1;
  const close = () => {
    const lanes = Math.max(0, ...group.map((slot) => slot.lane)) + 1;
    for (const slot of group) slot.lanes = lanes;
    group = [];
  };
  for (const slot of slots) {
    if (slot.start >= groupEnd) close();
    const laneEnds = new Map<number, number>();
    for (const other of group) laneEnds.set(other.lane, Math.max(laneEnds.get(other.lane) ?? 0, other.end));
    while ((laneEnds.get(slot.lane) ?? -1) > slot.start) slot.lane++;
    group.push(slot);
    groupEnd = Math.max(groupEnd, slot.end);
  }
  close();
  return slots;
}
