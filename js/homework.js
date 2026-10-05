import { addDays, dateKey, lessonsOn, nextLessonDate, parseDate, readStored, writeStored } from './schedule.js';
import { ensureSchedule, getSchedule, selectedDate } from './schedule-ui.js';
import { getToken, mergeHomework, readRepoFile, repoEditUrl, saveToken, writeRepoFile } from './github.js';
import { esc, renderText, validUrl } from './homework-text.js';
import { LOADER } from './icons.js';

const cacheKey = 'm3102-cache-homework-v1', draftKey = 'm3102-draft-homework-v1', pendingKey = 'm3102-pending-homework-v1', doneKey = 'm3102-hw-done-v1';
let base = null, homework = null, loading = null, filter = 'active', showEmpty = false, editingId = '', listAnimation = null;
let done = readStored(doneKey) || {};
const dateLabel = key => parseDate(key)?.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) || '';
const dueOrder = item => item.due || '9999-12-31';
function dueStatus(key) {
  if (!key) return 'Без срока';
  const today = parseDate(dateKey(new Date())), due = parseDate(key);
  if (!due) return 'Без срока';
  const days = Math.round((Date.UTC(due.getFullYear(), due.getMonth(), due.getDate()) - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
  return days < 0 ? 'Просрочено' : days === 0 ? 'Сегодня' : days === 1 ? 'Завтра' : `Через ${days} дн.`;
}
function normalize(raw) {
  if (!raw || !Array.isArray(raw.items)) throw new Error('Неверный формат домашних заданий');
  return { version: 1, items: raw.items.filter(item => item && typeof item.id === 'string').map(item => ({ id: item.id, subject: String(item.subject || ''), lessonDate: String(item.lessonDate || ''), lessonId: String(item.lessonId || ''), lessonStart: String(item.lessonStart || ''), text: String(item.text || ''), due: String(item.due || ''), links: Array.isArray(item.links) ? item.links.filter(link => link && validUrl(link.url)).map(link => ({ title: String(link.title || link.url), url: validUrl(link.url) })) : [], createdAt: item.createdAt || '', updatedAt: item.updatedAt || '' })) };
}
export async function ensureHomework() {
  if (homework) return homework;
  if (!loading) loading = (async () => {
    let remote, stale = false;
    try {
      const response = await fetch('./data/homework.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      remote = normalize(await response.json()); writeStored(cacheKey, remote);
    } catch (error) { remote = readStored(cacheKey); stale = true; if (!remote) throw error; }
    base = remote;
    const pending = readStored(pendingKey);
    if (pending && JSON.stringify(remote) === JSON.stringify(pending)) { try { localStorage.removeItem(pendingKey); } catch {} }
    homework = normalize(readStored(draftKey) || (pending && JSON.stringify(remote) !== JSON.stringify(pending) ? pending : remote));
    if (stale) document.dispatchEvent(new CustomEvent('homework:stale'));
    renderAll(); return homework;
  })().catch(error => { const page = document.querySelector('#homework-list'); if (page) page.innerHTML = `<p class="state">Не удалось загрузить задания: ${esc(error.message)}</p>`; throw error; });
  return loading;
}
export const getHomework = () => homework;
function saveDraft() { writeStored(draftKey, homework); renderAll(); }
function itemMarkup(item, compact = false) {
  const checked = Boolean(done[item.id]);
  return `<article class="hw-item${checked ? ' is-done' : ''}" data-hw="${esc(item.id)}"><label class="hw-check"><input type="checkbox" data-hw-done="${esc(item.id)}" ${checked ? 'checked' : ''} aria-label="Отметить ${esc(item.subject)} выполненным"></label><div class="hw-content"><div class="hw-item-top"><strong>${esc(item.subject)}</strong><span class="hw-due${item.due && item.due < dateKey(new Date()) && !checked ? ' overdue' : ''}">${esc(dueStatus(item.due))}</span></div><div class="hw-text">${renderText(item.text)}</div>${item.links.map(link => `<a class="hw-link" href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">${esc(link.title)} ↗</a>`).join('')}${!compact && item.lessonDate ? `<a class="hw-origin" href="#/schedule/${esc(item.lessonDate)}">С пары ${esc(dateLabel(item.lessonDate))}${item.lessonStart ? `, ${esc(item.lessonStart)}` : ''} ↗</a>` : ''}</div>${!compact ? `<div class="hw-actions"><button type="button" data-hw-edit="${esc(item.id)}" aria-label="Изменить задание">✎</button><button type="button" data-hw-delete="${esc(item.id)}" aria-label="Удалить задание">×</button></div>` : ''}</article>`;
}
function visibleItems() {
  if (!homework) return [];
  return homework.items.filter(item => filter === 'all' || (filter === 'done' ? done[item.id] : !done[item.id])).sort((a, b) => dueOrder(a).localeCompare(dueOrder(b)) || a.subject.localeCompare(b.subject, 'ru'));
}
function renderList() {
  const container = document.querySelector('#homework-list'); if (!container || !homework) return;
  const items = visibleItems(), grouped = new Map();
  for (const item of items) { if (!grouped.has(item.subject)) grouped.set(item.subject, []); grouped.get(item.subject).push(item); }
  const subjects = showEmpty && getSchedule() ? [...new Set(getSchedule().cycle.flat().filter(item => !item.break).map(item => item.subject))] : [];
  for (const subject of subjects) if (!grouped.has(subject)) grouped.set(subject, []);
  const ordered = [...grouped].sort((a, b) => (a[1][0] ? dueOrder(a[1][0]) : '9999').localeCompare(b[1][0] ? dueOrder(b[1][0]) : '9999') || a[0].localeCompare(b[0], 'ru'));
  const html = ordered.map(([subject, entries]) => `<section class="hw-group"><div class="hw-group-head"><h2>${esc(subject)}</h2><span>${entries.length ? `${entries.length} ${entries.length === 1 ? 'задание' : [2, 3, 4].includes(entries.length % 10) && ![12, 13, 14].includes(entries.length % 100) ? 'задания' : 'заданий'}` : 'нет заданий'}</span></div>${entries.map(item => itemMarkup(item)).join('')}</section>`).join('');
  const layer = document.createElement('div'); layer.className = 'hw-list-layer'; layer.innerHTML = html || '<div class="hw-empty"><span>✓</span><h2>Всё под контролем</h2><p>Заданий в этом списке пока нет.</p></div>';
  listAnimation?.cancel(); container.style.height = ''; container.style.overflow = ''; container.querySelectorAll('.hw-list-layer:not(:last-child)').forEach(node => node.remove());
  const old = container.firstElementChild, oldHeight = old?.offsetHeight || 0; container.append(layer);
  if (old && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const height = layer.offsetHeight; container.style.height = `${oldHeight}px`; container.style.overflow = 'hidden';
    const outgoing = old.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: 'ease-out' });
    const incoming = layer.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'ease-out' });
    listAnimation = container.animate([{ height: `${oldHeight}px` }, { height: `${height}px` }], { duration: 220, easing: 'ease-out' });
    const finish = () => { old.remove(); container.style.height = ''; container.style.overflow = ''; listAnimation = null; };
    Promise.all([outgoing.finished, incoming.finished, listAnimation.finished]).then(finish, finish);
  } else old?.remove();
  container.querySelectorAll('[data-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === filter)));
}
function renderHomeSlot() {
  const slot = document.querySelector('#home-homework'); if (!slot || !homework) return;
  const items = homework.items.filter(item => !done[item.id]).sort((a, b) => dueOrder(a).localeCompare(dueOrder(b))).slice(0, 5);
  slot.innerHTML = items.length ? items.map(item => itemMarkup(item, true)).join('') : '<p class="empty-line">Актуальных заданий пока нет.</p>';
}
function renderLessonSlots() {
  const date = selectedDate(), layer = document.querySelector('#sched-stage .sched-layer:last-child');
  if (!layer || !homework) return;
  layer.querySelectorAll('[data-lesson-homework]').forEach(slot => {
    const items = homework.items.filter(item => item.lessonDate === dateKey(date) && item.lessonId === slot.dataset.lessonHomework);
    slot.innerHTML = items.length ? `<h3>Домашнее задание · ${items.length}</h3>${items.map(item => itemMarkup(item, true)).join('')}` : '';
  });
}
function renderAll() { renderList(); renderHomeSlot(); renderLessonSlots(); }
export function renderHomeworkPage() {
  const content = document.querySelector('#content');
  content.innerHTML = `<section class="homework-page"><div class="intro hw-intro"><span class="sched-eyebrow">ВАШ ПРОГРЕСС · М3102</span><h1>Домашнее задание</h1><p class="sub">Задания по всем предметам. Выполнение видно только вам.</p></div><div class="hw-toolbar"><div class="hw-filters" role="group" aria-label="Фильтр заданий"><button data-filter="active" aria-pressed="true">Актуальные</button><button data-filter="done" aria-pressed="false">Выполненные</button><button data-filter="all" aria-pressed="false">Все</button></div><button class="btn2 btn-primary" data-hw-add>＋ Добавить</button></div><label class="hw-show-empty"><input type="checkbox" id="hw-empty-toggle" ${showEmpty ? 'checked' : ''}> Показать предметы без заданий</label><div id="homework-alert" class="sched-alert" hidden></div><div id="homework-list"><p class="state">${LOADER}</p></div><div class="hw-publish"><button class="btn2 btn-primary" data-hw-publish>Сохранить в GitHub</button><button class="btn2" data-hw-download>Скачать JSON</button><button class="btn2" data-hw-copy>Копировать JSON</button><a class="btn2" href="${repoEditUrl('data/homework.json')}" target="_blank" rel="noopener">Открыть на GitHub ↗</a></div><p class="plan-hint">Добавленные задания видны вам сразу. Чтобы их увидела вся группа, сохраните изменения в GitHub.</p></section>`;
  ensureHomework().catch(() => {}); renderList();
  ensureSchedule().then(() => { if (showEmpty) renderList(); }).catch(() => {});
}
function openForm(item = null, lesson = null) {
  editingId = item?.id || '';
  const dialog = document.querySelector('#homework-dialog'), schedule = getSchedule();
  const subjects = schedule ? [...new Set(schedule.cycle.flat().filter(row => !row.break).map(row => row.subject))] : [];
  const date = lesson?.date || (item?.lessonDate ? parseDate(item.lessonDate) : null);
  const next = date && lesson?.subject && schedule ? nextLessonDate(date, lesson.subject, schedule) : '';
  dialog.innerHTML = `<form id="homework-form"><div class="dialog-head"><h2>${item ? 'Изменить задание' : 'Новое задание'}</h2><button type="button" data-close-dialog aria-label="Закрыть">×</button></div><label class="sched-field">Предмет<input name="subject" list="hw-subjects" required maxlength="120" value="${esc(item?.subject || lesson?.subject || '')}"><datalist id="hw-subjects">${subjects.map(subject => `<option value="${esc(subject)}">`).join('')}</datalist></label><label class="sched-field">Задание<textarea name="text" rows="5" required maxlength="5000" placeholder="Что нужно сделать? Поддерживаются **жирный**, *курсив*, ссылки и $формулы$">${esc(item?.text || '')}</textarea></label><label class="sched-field">Срок сдачи<input type="date" name="due" value="${esc(item?.due || next)}"></label><div class="sched-presets"><button type="button" data-hw-due="next">К следующей паре</button><button type="button" data-hw-due="week">Через неделю</button><button type="button" data-hw-due="none">Без срока</button></div><label class="sched-field">Ссылки на материалы — по одной на строку: название | https://…<textarea name="links" rows="3" placeholder="Листок | https://example.com/file.pdf">${esc((item?.links || []).map(link => `${link.title} | ${link.url}`).join('\n'))}</textarea></label><input type="hidden" name="lessonDate" value="${esc(item?.lessonDate || (date ? dateKey(date) : ''))}"><input type="hidden" name="lessonId" value="${esc(item?.lessonId || lesson?.id || '')}"><input type="hidden" name="lessonStart" value="${esc(item?.lessonStart || lesson?.start || '')}"><p class="form-error" id="homework-error" role="alert"></p><div class="dialog-actions"><button class="btn2" type="button" data-close-dialog>Отмена</button><button class="btn2 btn-primary" type="submit">Сохранить задание</button></div></form>`;
  dialog.showModal(); dialog.querySelector('[name=text]').focus();
}
function saveForm(form) {
  const values = Object.fromEntries(new FormData(form));
  const links = values.links.split('\n').filter(Boolean).map(line => { const [title, ...rest] = line.split('|'); const raw = rest.length ? rest.join('|').trim() : title.trim(); return { title: rest.length ? title.trim() || raw : raw, url: validUrl(raw) }; });
  if (links.some(link => !link.url)) { form.querySelector('#homework-error').textContent = 'Ссылки должны начинаться с http:// или https://'; return; }
  if (values.due && !parseDate(values.due)) { form.querySelector('#homework-error').textContent = 'Проверьте срок сдачи.'; return; }
  const old = homework.items.find(item => item.id === editingId), now = new Date().toISOString();
  const item = { id: old?.id || crypto.randomUUID(), subject: values.subject.trim(), lessonDate: values.lessonDate, lessonId: values.lessonId, lessonStart: values.lessonStart, text: values.text.trim(), due: values.due, links, createdAt: old?.createdAt || now, updatedAt: now };
  if (!item.subject || !item.text) { form.querySelector('#homework-error').textContent = 'Заполните предмет и задание.'; return; }
  if (old) homework.items = homework.items.map(row => row.id === old.id ? item : row); else homework.items.push(item);
  saveDraft(); form.closest('dialog').close();
}
function exportHomework() {
  const url = URL.createObjectURL(new Blob([JSON.stringify(homework, null, 2) + '\n'], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'homework.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function openPublish() {
  const dialog = document.querySelector('#homework-publish-dialog');
  dialog.querySelector('[name=token]').value = ''; dialog.querySelector('[name=message]').value = `Домашнее задание: обновление ${new Date().toLocaleDateString('ru-RU')}`;
  dialog.querySelector('.token-present').hidden = !getToken(); dialog.showModal();
}
async function commitHomework(form) {
  const status = form.querySelector('#homework-publish-status'), token = form.elements.token.value.trim();
  if (token) saveToken(token, form.elements.remember.checked);
  if (!getToken()) { status.textContent = 'Введите токен с правом Contents: Read and write.'; return; }
  status.textContent = 'Сохраняем…';
  try {
    const remote = await readRepoFile('data/homework.json'), latest = normalize(JSON.parse(remote.text));
    const result = mergeHomework(base, latest, homework);
    await writeRepoFile('data/homework.json', JSON.stringify(result, null, 2) + '\n', form.elements.message.value.trim() || 'Обновить домашнее задание', remote.sha);
    base = structuredClone(result); homework = structuredClone(result); localStorage.removeItem(draftKey); writeStored(pendingKey, result); renderAll();
    status.textContent = 'Сохранено. Задания появятся у группы после обновления GitHub Pages.';
    const alert = document.querySelector('#homework-alert'); if (alert) { alert.hidden = false; alert.textContent = 'Изменения опубликованы. Пока Pages обновляется, показана сохранённая версия.'; }
    setTimeout(() => form.closest('dialog').close(), 1800);
    let attempts = 0; const timer = setInterval(async () => { if (++attempts > 12) { clearInterval(timer); return; } try { const response = await fetch('./data/homework.json', { cache: 'no-store' }); if (response.ok && JSON.stringify(normalize(await response.json())) === JSON.stringify(result)) { clearInterval(timer); localStorage.removeItem(pendingKey); if (alert) alert.hidden = true; } } catch {} }, 15000);
  } catch (error) { status.textContent = error.message || 'Не удалось сохранить задания.'; }
}
export function installHomework() {
  document.body.insertAdjacentHTML('beforeend', `<dialog id="homework-dialog" class="app-dialog"></dialog><dialog id="homework-publish-dialog" class="app-dialog"><form id="homework-publish-form"><div class="dialog-head"><h2>Сохранить домашнее задание</h2><button type="button" data-close-dialog aria-label="Закрыть">×</button></div><p class="dialog-hint">Изменения станут видны всей группе после обновления GitHub Pages.</p><label class="sched-field">Сообщение коммита<input name="message" required maxlength="160"></label><label class="sched-field">Fine-grained PAT<input name="token" type="password" autocomplete="off" placeholder="Оставьте пустым, если токен сохранён"></label><p class="token-present" hidden>Токен на этом устройстве уже есть.</p><label class="sched-checkbox"><input type="checkbox" name="remember"> Запомнить токен на этом устройстве</label><p class="dialog-hint">Токену нужен доступ только к этому репозиторию и право Contents: Read and write. Не сохраняйте его на чужом компьютере.</p><p id="homework-publish-status" aria-live="polite"></p><div class="dialog-actions"><button type="button" class="btn2" data-close-dialog>Отмена</button><button class="btn2 btn-primary" type="submit">Сохранить</button></div></form></dialog>`);
  document.addEventListener('schedule:day', () => { ensureHomework().then(renderLessonSlots).catch(() => {}); });
  document.addEventListener('homework:stale', () => { const alert = document.querySelector('#homework-alert'); if (alert) { alert.hidden = false; alert.textContent = 'Не удалось обновить задания. Показана последняя сохранённая версия.'; } });
  document.addEventListener('click', event => {
    const addLesson = event.target.closest('[data-add-homework]');
    if (addLesson) { const lesson = lessonsOn(selectedDate(), getSchedule()).find(item => item.id === addLesson.dataset.addHomework); ensureHomework().then(() => openForm(null, { ...lesson, date: selectedDate() })).catch(() => {}); return; }
    if (event.target.closest('[data-hw-add]')) { ensureHomework().then(() => openForm()).catch(() => {}); return; }
    const edit = event.target.closest('[data-hw-edit]'); if (edit) { openForm(homework.items.find(item => item.id === edit.dataset.hwEdit)); return; }
    const remove = event.target.closest('[data-hw-delete]'); if (remove) { if (confirm('Удалить это домашнее задание?')) { homework.items = homework.items.filter(item => item.id !== remove.dataset.hwDelete); saveDraft(); } return; }
    const filterButton = event.target.closest('[data-filter]'); if (filterButton) { filter = filterButton.dataset.filter; document.querySelectorAll('[data-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === filter))); renderList(); return; }
    const dueButton = event.target.closest('[data-hw-due]'); if (dueButton) { const form = dueButton.closest('form'), date = parseDate(form.elements.lessonDate.value) || new Date(); form.elements.due.value = dueButton.dataset.hwDue === 'none' ? '' : dueButton.dataset.hwDue === 'week' ? dateKey(addDays(date, 7)) : (getSchedule() ? nextLessonDate(date, form.elements.subject.value, getSchedule()) : ''); return; }
    if (event.target.closest('[data-hw-publish]')) return openPublish();
    if (event.target.closest('[data-hw-download]')) return exportHomework();
    const copy = event.target.closest('[data-hw-copy]'); if (copy) return navigator.clipboard.writeText(JSON.stringify(homework, null, 2)).then(() => { copy.textContent = 'Скопировано'; }).catch(() => {});
  });
  document.addEventListener('change', event => {
    if (event.target.matches('[data-hw-done]')) { done[event.target.dataset.hwDone] = event.target.checked ? new Date().toISOString() : null; writeStored(doneKey, done); renderAll(); }
    if (event.target.id === 'hw-empty-toggle') { showEmpty = event.target.checked; renderList(); }
  });
  document.addEventListener('submit', event => { if (event.target.id === 'homework-form') { event.preventDefault(); saveForm(event.target); } if (event.target.id === 'homework-publish-form') { event.preventDefault(); commitHomework(event.target); } });
}
export function renderHomeHomework() { ensureHomework().then(renderHomeSlot).catch(() => { const slot = document.querySelector('#home-homework'); if (slot) slot.innerHTML = '<p class="empty-line">Не удалось загрузить задания.</p>'; }); }
