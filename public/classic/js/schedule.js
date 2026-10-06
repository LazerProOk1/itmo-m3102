export const SCHEDULE_DRAFT_KEY = 'm3102-draft-schedule-v1';
export const SCHEDULE_CACHE_KEY = 'm3102-cache-schedule-v1';
export const SCHEDULE_PENDING_KEY = 'm3102-pending-schedule-v1';

export const clone = value => structuredClone(value);
export const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const parseDate = key => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  return dateKey(date) === key ? date : null;
};
export const addDays = (date, days) => {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  next.setDate(next.getDate() + days);
  return next;
};
export const mondayOf = date => addDays(date, -((date.getDay() + 6) % 7));
export function weekParity(date, schedule) {
  const anchor = parseDate(schedule.anchorMonday);
  const weeks = Math.round((Date.UTC(mondayOf(date).getFullYear(), mondayOf(date).getMonth(), mondayOf(date).getDate()) - Date.UTC(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())) / 604800000);
  return weeks % 2 === 0 ? schedule.anchorParity : schedule.anchorParity === 'even' ? 'odd' : 'even';
}
export const cycleDayIndex = (date, schedule) => (weekParity(date, schedule) === 'odd' ? 0 : 7) + (date.getDay() + 6) % 7;
export function isVacation(date, schedule) {
  const key = dateKey(date), monthDay = key.slice(5);
  return schedule.vacations.some(v => {
    const value = v.recurring ? monthDay : key;
    return v.from <= v.to ? value >= v.from && value <= v.to : value >= v.from || value <= v.to;
  });
}
export function normalizeLesson(raw, id) {
  const [legacyStart, legacyEnd] = String(raw.time || '').split(/[–—-]/);
  return { id: raw.id || id, start: raw.start || legacyStart || '', end: raw.end || legacyEnd || '', subject: raw.subject || '', room: raw.room || '', teacher: raw.teacher || '', location: raw.location || '', kind: raw.kind || '', break: Boolean(raw.break) };
}
export function normalizeSchedule(raw) {
  if (!raw || !Array.isArray(raw.cycle) || raw.cycle.length !== 14 || !parseDate(raw.anchorMonday)) throw new Error('Неверный формат расписания');
  return { version: 1, group: String(raw.group || 'М3102'), anchorMonday: raw.anchorMonday, anchorParity: raw.anchorParity === 'odd' ? 'odd' : 'even', defaultLocation: String(raw.defaultLocation || ''), vacations: Array.isArray(raw.vacations) ? raw.vacations : [], cycle: raw.cycle.map((day, i) => (Array.isArray(day) ? day : []).map((lesson, j) => normalizeLesson(lesson, `cycle-${i + 1}-${j + 1}`))), overrides: Object.fromEntries(Object.entries(raw.overrides || {}).filter(([key, day]) => parseDate(key) && day && Array.isArray(day.lessons)).map(([key, day]) => [key, { note: String(day.note || ''), lessons: day.lessons.map((lesson, j) => normalizeLesson(lesson, `${key}-${j + 1}`)) }])) };
}
export function lessonsOn(date, schedule) {
  const override = schedule.overrides[dateKey(date)];
  if (override) return override.lessons;
  return isVacation(date, schedule) ? [] : schedule.cycle[cycleDayIndex(date, schedule)];
}
export function nextLessonDate(date, subject, schedule, limit = 60) {
  for (let i = 1; i <= limit; i++) {
    const next = addDays(date, i);
    if (lessonsOn(next, schedule).some(lesson => !lesson.break && lesson.subject === subject)) return dateKey(next);
  }
  return '';
}
export function validateLessons(lessons) {
  const errors = [];
  lessons.forEach((lesson, i) => {
    if (!lesson.subject.trim()) errors.push(`Пара ${i + 1}: укажите предмет`);
    if (!/^\d{2}:\d{2}$/.test(lesson.start) || !/^\d{2}:\d{2}$/.test(lesson.end) || lesson.start >= lesson.end || Number(lesson.start.slice(0, 2)) > 23 || Number(lesson.end.slice(0, 2)) > 23 || Number(lesson.start.slice(3)) > 59 || Number(lesson.end.slice(3)) > 59) errors.push(`Пара ${i + 1}: проверьте время`);
  });
  const sorted = [...lessons].sort((a, b) => a.start.localeCompare(b.start));
  const overlaps = sorted.flatMap((lesson, i) => i && sorted[i - 1].end > lesson.start ? [`${sorted[i - 1].subject} и ${lesson.subject} пересекаются`] : []);
  return { errors, overlaps };
}
export function readStored(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}
export function writeStored(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); return true; } catch { return false; }
}
export function applyScheduleChanges(before, remote, local) {
  const merged = clone(remote);
  for (let i = 0; i < 14; i++) if (JSON.stringify(before.cycle[i]) !== JSON.stringify(local.cycle[i])) merged.cycle[i] = clone(local.cycle[i]);
  for (const key of new Set([...Object.keys(before.overrides), ...Object.keys(local.overrides)])) {
    if (JSON.stringify(before.overrides[key]) === JSON.stringify(local.overrides[key])) continue;
    if (local.overrides[key]) merged.overrides[key] = clone(local.overrides[key]);
    else delete merged.overrides[key];
  }
  for (const key of ['anchorMonday', 'anchorParity', 'defaultLocation', 'vacations']) if (JSON.stringify(before[key]) !== JSON.stringify(local[key])) merged[key] = clone(local[key]);
  return merged;
}
export async function loadSchedule() {
  try {
    const response = await fetch('./data/schedule.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const base = normalizeSchedule(await response.json());
    writeStored(SCHEDULE_CACHE_KEY, base);
    const pending = readStored(SCHEDULE_PENDING_KEY);
    if (pending && JSON.stringify(base) === JSON.stringify(pending)) { try { localStorage.removeItem(SCHEDULE_PENDING_KEY); } catch { /* Приватный режим. */ } }
    const overlay = readStored(SCHEDULE_DRAFT_KEY) || (pending && JSON.stringify(base) !== JSON.stringify(pending) ? pending : null);
    return { base, data: overlay ? normalizeSchedule(overlay) : clone(base), stale: false };
  } catch (error) {
    const cached = readStored(SCHEDULE_CACHE_KEY);
    if (!cached) throw error;
    const base = normalizeSchedule(cached);
    const overlay = readStored(SCHEDULE_DRAFT_KEY) || readStored(SCHEDULE_PENDING_KEY);
    return { base, data: overlay ? normalizeSchedule(overlay) : clone(base), stale: true };
  }
}
