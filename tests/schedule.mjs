import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cycleDayIndex, dateKey, isVacation, lessonsOn, loadSchedule, nextLessonDate, normalizeSchedule, parseDate, SCHEDULE_CACHE_KEY, SCHEDULE_PENDING_KEY, validateLessons, weekParity } from '../js/schedule.js';

const schedule = normalizeSchedule(JSON.parse(readFileSync(new URL('../data/schedule.json', import.meta.url))));
const day = key => parseDate(key);

test('цикл, каникулы и локальные даты', () => {
  assert.equal(dateKey(day('2026-09-22')), '2026-09-22');
  assert.equal(weekParity(day('2026-09-21'), schedule), 'even');
  assert.equal(cycleDayIndex(day('2026-09-22'), schedule), 8);
  assert.deepEqual(lessonsOn(day('2026-09-22'), schedule).map(x => [x.subject, x.start]), [['Дискретная математика', '09:50'], ['Линейная алгебра', '11:30']]);
  assert.equal(lessonsOn(day('2026-09-24'), schedule).length, 1);
  assert.equal(lessonsOn(day('2026-09-25'), schedule).length, 3);
  assert.equal(lessonsOn(day('2026-09-26'), schedule).filter(x => !x.break).length, 3);
  assert.equal(lessonsOn(day('2026-09-18'), schedule).length, 4);
  assert.equal(lessonsOn(day('2026-09-21'), schedule).length, 0);
  assert.equal(lessonsOn(day('2026-09-27'), schedule).length, 0);
  assert.equal(isVacation(day('2027-07-12'), schedule), true);
  const changed = structuredClone(schedule);
  changed.overrides['2027-07-12'] = { note: 'Экзамен', lessons: [schedule.cycle[8][0]] };
  assert.equal(lessonsOn(day('2027-07-12'), changed).length, 1);
});

test('следующая пара учитывает override', () => {
  assert.equal(nextLessonDate(day('2026-09-22'), 'Дискретная математика', schedule), '2026-09-23');
  const changed = structuredClone(schedule);
  changed.overrides['2026-09-23'] = { note: '', lessons: [] };
  assert.equal(nextLessonDate(day('2026-09-22'), 'Дискретная математика', changed), '2026-09-29');
});

test('валидация времени и предупреждение о пересечении', () => {
  assert.deepEqual(validateLessons([{ subject: 'A', start: '09:50', end: '11:20' }, { subject: 'B', start: '11:00', end: '12:00' }]).overlaps, ['A и B пересекаются']);
  assert.equal(validateLessons([{ subject: '', start: '10:00', end: '09:00' }]).errors.length, 2);
});

test('при ошибке сети используется последняя сохранённая версия', async () => {
  const oldFetch = globalThis.fetch, oldStorage = globalThis.localStorage;
  const saved = new Map([[SCHEDULE_CACHE_KEY, JSON.stringify(schedule)]]);
  globalThis.localStorage = { getItem: key => saved.get(key) || null, setItem: (key, value) => saved.set(key, value) };
  globalThis.fetch = async () => { throw new Error('offline'); };
  try {
    const loaded = await loadSchedule(); assert.equal(loaded.stale, true); assert.equal(lessonsOn(day('2026-09-22'), loaded.data).length, 2);
    const pending = structuredClone(schedule); pending.overrides['2026-09-22'] = { note: 'Перенос', lessons: [] };
    saved.set(SCHEDULE_PENDING_KEY, JSON.stringify(pending));
    assert.equal(lessonsOn(day('2026-09-22'), (await loadSchedule()).data).length, 0);
  }
  finally { globalThis.fetch = oldFetch; globalThis.localStorage = oldStorage; }
});
