import { addDays, cycleDayIndex, dateKey, isVacation, lessonsOn, loadSchedule, mondayOf, parseDate, weekParity } from './schedule.js';
import { LOADER } from './icons.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const pairs = n => n % 10 === 1 && n % 100 !== 11 ? 'пара' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'пары' : 'пар';
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const dateTitle = date => date.toLocaleDateString('ru-RU', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
const shortTeacher = name => { const parts = name.trim().split(/\s+/); return parts.length > 1 ? `${parts[0]} ${parts.slice(1).map(part => part[0] + '.').join(' ')}` : name; };
const subjectTone = subject => [...subject].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 7) % 6;
let base = null, data = null, loading = null, selected = new Date(), animations = [], sequence = 0, editor = null;
const cardAnimations = new WeakMap();

export const getSchedule = () => data;
export const getBaseSchedule = () => base;
export const setBaseSchedule = next => { base = next; };
export function setSchedule(next) { data = next; document.dispatchEvent(new CustomEvent('schedule:change')); refreshSchedule(); }
export async function ensureSchedule() {
  if (data) { refreshSchedule(); return data; }
  if (!loading) loading = loadSchedule().then(result => {
    base = result.base; data = result.data;
    const alert = document.querySelector('#sched-alert');
    if (alert) { alert.hidden = !result.stale; alert.textContent = result.stale ? 'Не удалось обновить расписание. Показана последняя сохранённая версия.' : ''; }
    document.dispatchEvent(new CustomEvent('schedule:ready', { detail: result }));
    refreshSchedule();
    return data;
  }).catch(error => {
    document.dispatchEvent(new CustomEvent('schedule:error', { detail: error }));
    const stage = document.querySelector('#sched-stage');
    if (stage) stage.innerHTML = '<p class="sched-empty">Не удалось загрузить расписание. Проверьте подключение и обновите страницу.</p>';
    throw error;
  });
  return loading;
}

function lessonMarkup(lesson, date, index) {
  const start = esc(lesson.start), end = esc(lesson.end);
  if (lesson.break) {
    const minutes = Number(lesson.end.slice(0, 2)) * 60 + Number(lesson.end.slice(3)) - Number(lesson.start.slice(0, 2)) * 60 - Number(lesson.start.slice(3));
    return `<div class="sched-gap"><span>${start}–${end}</span><span>Окно · ${Math.floor(minutes / 60)} ч ${minutes % 60} мин</span></div>`;
  }
  const kind = { lecture: 'Лекция', practice: 'Практика', lab: 'Лабораторная', other: 'Занятие' }[lesson.kind] || '';
  const address = lesson.location || data.defaultLocation;
  const map = `https://yandex.ru/maps/?text=${encodeURIComponent(address)}`;
  return `<article class="sched-entry tone-${subjectTone(lesson.subject)}" data-start="${start}" data-end="${end}" data-lesson="${esc(lesson.id)}">
    <div class="sched-time"><strong>${start}</strong><small>${end}</small></div><span class="sched-rail" aria-hidden="true"></span>
    <details class="sched-card"><summary><span class="sched-card-main"><strong>${esc(lesson.subject)}</strong><small>${lesson.room ? `ауд. ${esc(lesson.room)}` : 'Аудитория уточняется'}${lesson.teacher ? ` · ${esc(shortTeacher(lesson.teacher))}` : ''}</small></span><span class="sched-card-side">${kind ? `<span class="sched-kind">${kind}</span>` : ''}<span class="sched-chevron">⌄</span></span></summary>
      <div class="sched-card-body"><p>${lesson.teacher ? esc(lesson.teacher) : 'Преподаватель уточняется'}</p>${address ? `<a href="${map}" target="_blank" rel="noopener noreferrer">${esc(address)} ↗</a>` : ''}<div class="sched-live-text" aria-live="off"></div><div class="sched-homework-slot" data-lesson-homework="${esc(lesson.id)}"></div><div class="sched-card-actions"><button type="button" class="btn2" data-add-homework="${esc(lesson.id)}">＋ Домашнее задание</button><button type="button" class="btn2 sched-edit-lesson" data-edit-lesson="${index}">Изменить пару</button></div></div>
      <div class="sched-progress" aria-hidden="true"></div>
    </details></article>`;
}
function dayMarkup(date) {
  const lessons = lessonsOn(date, data);
  if (!lessons.length) return `<div class="sched-empty"><span aria-hidden="true">${isVacation(date, data) && !data.overrides[dateKey(date)] ? '☀' : '◇'}</span><strong>${isVacation(date, data) && !data.overrides[dateKey(date)] ? 'Каникулы' : 'Свободный день'}</strong><p>Занятий на этот день нет.</p></div>`;
  return `<div class="sched-timeline">${lessons.map((lesson, index) => lessonMarkup(lesson, date, index)).join('')}</div>`;
}
function updateHeader() {
  const title = document.querySelector('#sched-day-title');
  if (!title || !data) return;
  const lessons = lessonsOn(selected, data).filter(lesson => !lesson.break);
  const override = data.overrides[dateKey(selected)];
  title.textContent = dateTitle(selected);
  document.querySelector('#sched-day-sub').textContent = `${weekParity(selected, data) === 'even' ? 'Чётная' : 'Нечётная'} неделя · ${lessons.length} ${pairs(lessons.length)}${lessons.length ? ` · ${lessons[0].start}–${lessons.at(-1).end}` : ''}`;
  document.querySelector('#sched-override').textContent = override ? `Изменено${override.note ? ` · ${override.note}` : ''}` : '';
  document.querySelector('#sched-today').hidden = dateKey(selected) === dateKey(new Date());
  document.querySelector('#sched-month').textContent = mondayOf(selected).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
}
function updateIndicator() {
  const track = document.querySelector('.week-pills'), current = track?.querySelector('.week-pill[aria-selected="true"]'), indicator = track?.querySelector('.week-indicator');
  if (!current || !indicator) return;
  indicator.style.width = `${current.offsetWidth}px`;
  indicator.style.transform = `translateX(${current.offsetLeft}px)`;
  if (!track.classList.contains('is-ready')) requestAnimationFrame(() => track.classList.add('is-ready'));
}
function fillWeek(animate = false) {
  const track = document.querySelector('.week-pills');
  if (!track || !data) return;
  const monday = mondayOf(selected), existing = track.querySelector('.week-pill')?.dataset.date;
  if (existing !== dateKey(monday)) {
    if (!track.querySelector('.week-indicator')) track.innerHTML = '<span class="week-indicator" aria-hidden="true"></span>';
    track.querySelectorAll('.week-pill').forEach(pill => pill.remove());
    track.insertAdjacentHTML('beforeend', Array.from({ length: 7 }, (_, i) => {
      const date = addDays(monday, i), key = dateKey(date), count = lessonsOn(date, data).filter(lesson => !lesson.break).length;
      return `<button type="button" class="week-pill" data-date="${key}" aria-current="${key === dateKey(new Date()) ? 'date' : 'false'}" aria-selected="false"><span>${weekdays[i]}</span><strong>${date.getDate()}</strong><i aria-label="${count} занятий" class="week-dots">${count ? '•'.repeat(Math.min(count, 4)) : ''}</i>${data.overrides[key] ? '<b class="week-edited" aria-label="Изменено"></b>' : ''}</button>`;
    }).join(''));
    if (animate && !reduceMotion()) track.animate([{ opacity: .4, transform: 'translateX(18px)' }, { opacity: 1, transform: 'translateX(0)' }], { duration: 280, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }
  track.querySelectorAll('.week-pill').forEach(pill => pill.setAttribute('aria-selected', String(pill.dataset.date === dateKey(selected))));
  requestAnimationFrame(updateIndicator);
}
function updateLive() {
  const stage = document.querySelector('#sched-stage');
  if (!stage || !data || dateKey(selected) !== dateKey(new Date())) return;
  const now = new Date(), minute = now.getHours() * 60 + now.getMinutes();
  stage.querySelectorAll('.sched-entry').forEach(entry => {
    const [start, end] = [entry.dataset.start, entry.dataset.end].map(value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3)));
    entry.classList.toggle('is-past', minute >= end);
    entry.classList.toggle('is-current', minute >= start && minute < end);
    const text = entry.querySelector('.sched-live-text');
    if (text) text.textContent = minute >= start && minute < end ? `Сейчас идёт · осталось ${end - minute} мин` : minute < start ? `Начнётся через ${start - minute} мин` : 'Занятие завершено';
    entry.style.setProperty('--progress', `${Math.max(0, Math.min(100, (minute - start) / (end - start) * 100))}%`);
  });
}
function stopAnimations() {
  animations.forEach(animation => animation.cancel()); animations = [];
  const stage = document.querySelector('#sched-stage');
  if (stage) { stage.querySelectorAll('.sched-layer:not(:last-child)').forEach(node => node.remove()); stage.style.height = ''; }
}
export function showDay(date, { updateHash = true } = {}) {
  if (!data) { selected = date; return; }
  const stage = document.querySelector('#sched-stage');
  if (!stage) { selected = date; return; }
  const previous = selected;
  if (dateKey(previous) === dateKey(date) && stage.querySelector('.sched-layer')) return;
  stopAnimations();
  const old = stage.querySelector('.sched-layer'), oldHeight = old?.offsetHeight || 0;
  const direction = date > previous ? 1 : -1;
  selected = date;
  const next = document.createElement('div');
  next.className = 'sched-layer'; next.innerHTML = dayMarkup(date);
  stage.append(next);
  updateHeader(); fillWeek(dateKey(mondayOf(previous)) !== dateKey(mondayOf(date))); updateLive();
  document.dispatchEvent(new CustomEvent('schedule:day', { detail: { date, layer: next } }));
  if (updateHash) history.replaceState(null, '', `#/schedule/${dateKey(date)}`);
  if (!old || reduceMotion()) { old?.remove(); return; }
  const id = ++sequence, newHeight = next.offsetHeight;
  stage.style.height = `${oldHeight}px`;
  const options = { duration: 280, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' };
  const outgoing = old.animate([{ opacity: 1, transform: 'translateX(0)' }, { opacity: 0, transform: `translateX(${-direction * 28}px)` }], { ...options, duration: 180 });
  const incoming = next.animate([{ opacity: 0, transform: `translateX(${direction * 28}px)` }, { opacity: 1, transform: 'translateX(0)' }], options);
  const height = stage.animate([{ height: `${oldHeight}px` }, { height: `${newHeight}px` }], options);
  animations = [outgoing, incoming, height];
  Promise.all(animations.map(animation => animation.finished.catch(() => null))).then(() => {
    if (id !== sequence) return;
    old.remove();
    stage.style.height = ''; 
    animations.forEach(animation => animation.cancel());
    animations = [];
  });
}
export function refreshSchedule() {
  if (!data || !document.querySelector('#sched-stage')) return;
  stopAnimations();
  const stage = document.querySelector('#sched-stage');
  stage.innerHTML = `<div class="sched-layer">${dayMarkup(selected)}</div>`;
  updateHeader(); fillWeek(); updateLive();
  document.dispatchEvent(new CustomEvent('schedule:day', { detail: { date: selected, layer: stage.firstElementChild } }));
}
export function mountSchedule(date = selected) {
  const content = document.querySelector('#content');
  if (document.querySelector('#schedule-page')) { showDay(date, { updateHash: false }); return; }
  selected = date;
  content.innerHTML = `<section id="schedule-page" class="schedule-page"><div class="intro sched-intro"><div><span class="sched-eyebrow">УЧЕБНЫЙ РИТМ · М3102</span><h1>Расписание</h1><p class="sub">Все занятия, аудитории и задания на одном экране.</p></div><button id="sched-edit" class="btn2" type="button">✎ Изменить</button></div><div id="sched-alert" class="sched-alert" hidden></div><div class="sched-toolbar"><div class="sched-month" id="sched-month"></div><div class="sched-nav"><button class="btn2" id="sched-prev-week" aria-label="Предыдущая неделя">←</button><button class="btn2" id="sched-next-week" aria-label="Следующая неделя">→</button></div></div><div class="week-pills" role="group" aria-label="Дни недели"></div><div class="sched-day-info"><div><h2 id="sched-day-title" aria-live="polite">${LOADER}</h2><p id="sched-day-sub"></p><span id="sched-override"></span></div><button class="btn2" id="sched-today" type="button" hidden>Сегодня</button></div><div id="sched-stage" class="sched-stage"><div class="sched-skeleton"></div></div><div id="sched-editor"></div></section>`;
  content.querySelector('.week-pills').addEventListener('click', event => { const pill = event.target.closest('[data-date]'); if (pill) showDay(parseDate(pill.dataset.date)); });
  content.querySelector('#sched-prev-week').onclick = () => showDay(addDays(selected, -7));
  content.querySelector('#sched-next-week').onclick = () => showDay(addDays(selected, 7));
  content.querySelector('#sched-today').onclick = () => showDay(new Date());
  content.querySelector('#sched-edit').onclick = () => editor?.();
  content.querySelector('#sched-stage').addEventListener('click', event => {
    const summary = event.target.closest('.sched-card summary');
    if (summary && !reduceMotion()) {
      event.preventDefault();
      const card = summary.parentElement, opening = !card.open, start = card.offsetHeight;
      cardAnimations.get(card)?.cancel();
      card.style.height = `${start}px`; card.style.overflow = 'hidden';
      if (opening) card.open = true;
      const end = opening ? card.scrollHeight : summary.offsetHeight;
      const animation = card.animate([{ height: `${start}px` }, { height: `${end}px` }], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' });
      cardAnimations.set(card, animation);
      const finish = () => {
        if (cardAnimations.get(card) !== animation) return;
        if (!opening) card.open = false;
      card.style.height = ''; card.style.overflow = ''; cardAnimations.delete(card);
    };
    animation.finished.then(finish, finish);
    }
    const button = event.target.closest('[data-edit-lesson]');
    if (button) editor?.(Number(button.dataset.editLesson));
  });
  let touchX = 0, touchY = 0;
  const stage = content.querySelector('#sched-stage');
  stage.addEventListener('touchstart', event => { touchX = event.touches[0].clientX; touchY = event.touches[0].clientY; }, { passive: true });
  stage.addEventListener('touchend', event => { const dx = event.changedTouches[0].clientX - touchX, dy = event.changedTouches[0].clientY - touchY; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) showDay(addDays(selected, dx < 0 ? 1 : -1)); }, { passive: true });
  ensureSchedule().catch(() => {});
}
export const selectedDate = () => selected;
export const setEditorHandler = handler => { editor = handler; };
document.addEventListener('keydown', event => {
  if (!document.querySelector('#schedule-page') || event.altKey || event.ctrlKey || event.metaKey || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); showDay(addDays(selected, event.key === 'ArrowRight' ? 1 : -1)); }
});
setInterval(updateLive, 30000);
window.addEventListener('resize', updateIndicator);
