import { applyScheduleChanges, clone, cycleDayIndex, dateKey, lessonsOn, normalizeLesson, normalizeSchedule, parseDate, SCHEDULE_DRAFT_KEY, SCHEDULE_PENDING_KEY, validateLessons, writeStored } from './schedule.js';
import { getBaseSchedule, getSchedule, refreshSchedule, selectedDate, setBaseSchedule, setEditorHandler, setSchedule } from './schedule-ui.js';
import { forgetToken, getToken, readRepoFile, repoEditUrl, saveToken, writeRepoFile } from './github.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let editing = false, scope = 'day', undo = [], redo = [], selectedLesson = -1, draggedLesson = -1;
const slots = ['09:50–11:20', '11:30–13:00', '13:30–15:00', '15:30–17:00', '17:10–18:40'];
const currentIndex = () => cycleDayIndex(selectedDate(), getSchedule());
function currentLessons() {
  const schedule = getSchedule(), date = selectedDate();
  return scope === 'day' ? clone(schedule.overrides[dateKey(date)]?.lessons ?? lessonsOn(date, schedule)) : clone(schedule.cycle[currentIndex()]);
}
function describeChanges() {
  const before = getBaseSchedule(), after = getSchedule();
  if (!before || !after) return [];
  const changes = [];
  for (let i = 0; i < 14; i++) if (JSON.stringify(before.cycle[i]) !== JSON.stringify(after.cycle[i])) changes.push(`Цикл, день ${i + 1}: изменены пары`);
  for (const key of new Set([...Object.keys(before.overrides), ...Object.keys(after.overrides)])) {
    const a = before.overrides[key], b = after.overrides[key];
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    const oldNames = new Set((a?.lessons || []).map(item => item.id));
    const newNames = new Set((b?.lessons || []).map(item => item.id));
    const added = (b?.lessons || []).filter(item => !oldNames.has(item.id)).map(item => `+ ${item.subject} ${item.start}`);
    const removed = (a?.lessons || []).filter(item => !newNames.has(item.id)).map(item => `− ${item.subject} ${item.start}`);
    changes.push(`${key}: ${[...added, ...removed].join(', ') || (b ? 'изменены пары или заметка' : 'возврат к циклу')}`);
  }
  if (['anchorMonday', 'anchorParity', 'vacations', 'defaultLocation'].some(key => JSON.stringify(before[key]) !== JSON.stringify(after[key]))) changes.push('Изменены настройки расписания');
  return changes;
}
function updatePanel() {
  const panel = document.querySelector('#sched-editor');
  if (!panel || !editing) return;
  const schedule = getSchedule(), date = selectedDate(), key = dateKey(date), index = currentIndex();
  const lessons = currentLessons();
  const changes = describeChanges();
  panel.innerHTML = `<section class="sched-edit-panel"><div class="sched-edit-head"><div><span class="sched-eyebrow">РЕЖИМ ПРАВКИ</span><h2>Редактирование</h2><p>Черновик: ${changes.length} изменений · сохраняется на этом устройстве</p></div><button class="btn2" data-close-editor>Готово</button></div>
    <div class="sched-scope" role="group" aria-label="Область изменения"><button type="button" data-scope="day" aria-pressed="${scope === 'day'}">Только этот день · ${esc(date.toLocaleDateString('ru-RU'))}</button><button type="button" data-scope="cycle" aria-pressed="${scope === 'cycle'}">Общее расписание · день ${index + 1}</button></div>
    ${scope === 'cycle' ? '<p class="sched-edit-warning">Изменятся все такие дни, включая прошедшие. Для одной даты выберите «Только этот день».</p>' : `<label class="sched-field">Заметка к дню<input data-note maxlength="150" value="${esc(schedule.overrides[key]?.note || '')}" placeholder="Например, перенос занятий"></label>`}
    <div class="sched-edit-lessons">${lessons.map((lesson, i) => `<div class="sched-edit-row" draggable="true" data-drag-index="${i}"><span><strong>${esc(lesson.start)}–${esc(lesson.end)}</strong> · ${esc(lesson.subject)}</span><div><button class="btn2" data-shift="${i}" data-step="-1" aria-label="Вверх">↑</button><button class="btn2" data-shift="${i}" data-step="1" aria-label="Вниз">↓</button><button class="btn2" data-lesson="${i}">Править</button><button class="btn2" data-duplicate="${i}" aria-label="Дублировать">⧉</button><button class="btn2" data-remove="${i}" aria-label="Удалить">×</button></div></div>`).join('') || '<p class="empty-line">Занятий нет.</p>'}</div>
    <div class="sched-edit-actions"><button class="btn2 btn-primary" data-add-lesson>＋ Добавить пару</button>${scope === 'day' ? '<button class="btn2" data-empty-day>Занятий нет</button><button class="btn2" data-reset-day>Вернуть к общему расписанию</button>' : ''}<button class="btn2" data-settings>Настройки</button></div>
    <div class="sched-edit-actions"><button class="btn2" data-undo ${undo.length ? '' : 'disabled'}>Отменить</button><button class="btn2" data-redo ${redo.length ? '' : 'disabled'}>Повторить</button><button class="btn2" data-reset-draft>Сбросить черновик</button></div>
    <details class="sched-diff"><summary>Список изменений · ${changes.length}</summary><ul>${changes.map(line => `<li>${esc(line)}</li>`).join('') || '<li>Пока нет изменений</li>'}</ul></details>
    <div class="sched-edit-actions"><button class="btn2 btn-primary" data-publish>Сохранить в GitHub</button><button class="btn2" data-download>Скачать JSON</button><button class="btn2" data-copy-json>Копировать JSON</button><a class="btn2" href="${repoEditUrl('data/schedule.json')}" target="_blank" rel="noopener">Открыть на GitHub ↗</a></div><p class="sched-edit-status" aria-live="polite"></p></section>`;
  const overlaps = validateLessons(lessons).overlaps;
  if (overlaps.length) panel.querySelector('.sched-edit-status').textContent = `Внимание: ${overlaps.join('; ')}`;
}
function mutate(change) {
  const next = clone(getSchedule());
  change(next);
  if (JSON.stringify(next) === JSON.stringify(getSchedule())) return;
  undo.push(clone(getSchedule())); if (undo.length > 50) undo.shift(); redo = [];
  setSchedule(next); writeStored(SCHEDULE_DRAFT_KEY, next); updatePanel();
}
function replaceLessons(next, lessons) {
  const sorted = lessons.sort((a, b) => a.start.localeCompare(b.start));
  if (scope === 'day') {
    const key = dateKey(selectedDate());
    next.overrides[key] = { note: next.overrides[key]?.note || '', lessons: sorted };
  } else next.cycle[currentIndex()] = sorted;
}
function moveLesson(from, to) {
  if (to < 0 || to >= currentLessons().length || from === to) return;
  mutate(next => { const lessons = currentLessons(); [lessons[from].start, lessons[to].start] = [lessons[to].start, lessons[from].start]; [lessons[from].end, lessons[to].end] = [lessons[to].end, lessons[from].end]; replaceLessons(next, lessons); });
}
function showLessonForm(index = -1) {
  selectedLesson = index;
  const lesson = index >= 0 ? currentLessons()[index] : { start: '09:50', end: '11:20', subject: '', room: '', teacher: '', location: getSchedule().defaultLocation, kind: '', break: false };
  const schedule = getSchedule();
  const subjects = [...new Set(schedule.cycle.flat().map(item => item.subject).filter(Boolean))];
  const teachers = [...new Set(schedule.cycle.flat().map(item => item.teacher).filter(Boolean))];
  const dialog = document.querySelector('#schedule-lesson-dialog');
  dialog.innerHTML = `<form method="dialog" id="schedule-lesson-form"><div class="dialog-head"><h2>${index >= 0 ? 'Изменить пару' : 'Новая пара'}</h2><button type="button" data-close-dialog aria-label="Закрыть">×</button></div><div class="sched-form-grid"><label class="sched-field wide">Предмет<input name="subject" list="sched-subjects" maxlength="120" value="${esc(lesson.subject)}"><datalist id="sched-subjects">${subjects.map(item => `<option value="${esc(item)}">`).join('')}</datalist></label><label class="sched-field">Начало<input type="time" name="start" required value="${esc(lesson.start)}"></label><label class="sched-field">Конец<input type="time" name="end" required value="${esc(lesson.end)}"></label><div class="sched-presets wide">${slots.map(slot => `<button type="button" data-slot="${slot}">${slot}</button>`).join('')}</div><label class="sched-field">Аудитория<input name="room" maxlength="50" value="${esc(lesson.room)}"></label><label class="sched-field">Тип<select name="kind"><option value="">Не указан</option>${[['lecture', 'Лекция'], ['practice', 'Практика'], ['lab', 'Лабораторная'], ['other', 'Другое']].map(([value, label]) => `<option value="${value}" ${lesson.kind === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label class="sched-field wide">Преподаватель<input name="teacher" list="sched-teachers" maxlength="120" value="${esc(lesson.teacher)}"><datalist id="sched-teachers">${teachers.map(item => `<option value="${esc(item)}">`).join('')}</datalist></label><label class="sched-field wide">Адрес<input name="location" maxlength="180" value="${esc(lesson.location)}"></label><label class="sched-checkbox wide"><input type="checkbox" name="break" ${lesson.break ? 'checked' : ''}> Перерыв / окно</label></div><p id="lesson-error" class="form-error" role="alert"></p><div class="dialog-actions"><button type="button" class="btn2" data-close-dialog>Отмена</button><button class="btn2 btn-primary" type="submit">Сохранить</button></div></form>`;
  dialog.showModal(); dialog.querySelector('[name=subject]').focus();
}
function showSettings() {
  const s = getSchedule(), dialog = document.querySelector('#schedule-settings-dialog');
  dialog.innerHTML = `<form method="dialog" id="schedule-settings-form"><div class="dialog-head"><h2>Настройки расписания</h2><button type="button" data-close-dialog aria-label="Закрыть">×</button></div><label class="sched-field">Опорный понедельник<input type="date" name="anchorMonday" required value="${esc(s.anchorMonday)}"></label><label class="sched-field">Чётность<select name="anchorParity"><option value="even" ${s.anchorParity === 'even' ? 'selected' : ''}>Чётная</option><option value="odd" ${s.anchorParity === 'odd' ? 'selected' : ''}>Нечётная</option></select></label><label class="sched-field">Адрес по умолчанию<input name="defaultLocation" value="${esc(s.defaultLocation)}"></label><label class="sched-field">Каникулы: по одному диапазону на строку, ММ-ДД,ММ-ДД или ГГГГ-ММ-ДД,ГГГГ-ММ-ДД<textarea name="vacations" rows="4">${esc(s.vacations.map(v => `${v.from},${v.to}`).join('\n'))}</textarea></label><p class="form-error" id="settings-error" role="alert"></p><div class="dialog-actions"><button class="btn2" type="button" data-close-dialog>Отмена</button><button class="btn2 btn-primary" type="submit">Сохранить</button></div></form>`;
  dialog.showModal();
}
function downloadJson() {
  const blob = new Blob([JSON.stringify(getSchedule(), null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = 'schedule.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function conflictChoice() {
  const dialog = document.querySelector('#schedule-conflict-dialog');
  dialog.showModal();
  return new Promise(resolve => {
    dialog.onclose = () => resolve(dialog.returnValue || 'cancel');
    dialog.querySelectorAll('[data-choice]').forEach(button => button.onclick = () => dialog.close(button.dataset.choice));
  });
}
async function publish() {
  const dialog = document.querySelector('#schedule-publish-dialog'), changes = describeChanges();
  dialog.querySelector('#schedule-publish-summary').textContent = changes.join('\n') || 'Изменений нет';
  dialog.querySelector('[name=message]').value = `Расписание: изменения на ${selectedDate().toLocaleDateString('ru-RU')}`;
  dialog.querySelector('[name=token]').value = '';
  dialog.querySelector('.token-present').hidden = !getToken();
  dialog.showModal();
}
async function commitSchedule(form) {
  const status = document.querySelector('#schedule-publish-status');
  status.textContent = 'Проверяем файл на GitHub…';
  const token = form.elements.token.value.trim();
  if (token) saveToken(token, form.elements.remember.checked);
  if (!getToken()) { status.textContent = 'Введите токен с правом Contents: Read and write.'; return; }
  try {
    const remote = await readRepoFile('data/schedule.json');
    const remoteData = normalizeSchedule(JSON.parse(remote.text));
    const local = getSchedule(), before = getBaseSchedule();
    let result = local;
    if (JSON.stringify(remoteData) !== JSON.stringify(before)) {
      const choice = await conflictChoice();
      if (choice === 'cancel') { status.textContent = 'Сохранение отменено.'; return; }
      if (choice === 'apply') result = applyScheduleChanges(before, remoteData, local);
    }
    status.textContent = 'Сохраняем изменения…';
    await writeRepoFile('data/schedule.json', JSON.stringify(result, null, 2) + '\n', form.elements.message.value.trim() || 'Обновить расписание', remote.sha);
    setBaseSchedule(clone(result)); setSchedule(clone(result));
    localStorage.removeItem(SCHEDULE_DRAFT_KEY);
    writeStored(SCHEDULE_PENDING_KEY, result);
    undo = []; redo = []; updatePanel();
    status.textContent = 'Сохранено. GitHub Pages обычно обновляется в течение нескольких минут.';
    const alert = document.querySelector('#sched-alert'); if (alert) { alert.hidden = false; alert.textContent = 'Изменения опубликованы в GitHub. Ожидаем обновления сайта; до него показана сохранённая версия.'; }
    setTimeout(() => dialog.close(), 1800);
    let attempts = 0;
    const timer = setInterval(async () => {
      if (++attempts > 12) { clearInterval(timer); return; }
      try { const response = await fetch('./data/schedule.json', { cache: 'no-store' }); if (response.ok && JSON.stringify(normalizeSchedule(await response.json())) === JSON.stringify(result)) { clearInterval(timer); localStorage.removeItem(SCHEDULE_PENDING_KEY); if (alert) alert.hidden = true; } } catch { /* Публикация ещё не дошла до Pages. */ }
    }, 15000);
  } catch (error) { status.textContent = error.message || 'Не удалось сохранить расписание.'; }
}
function handleClick(event) {
  const button = event.target.closest('button'); if (!button || !editing) return;
  if (button.dataset.closeEditor !== undefined) return toggleEditor();
  if (button.dataset.scope) { scope = button.dataset.scope; return updatePanel(); }
  if (button.dataset.lesson !== undefined) return showLessonForm(Number(button.dataset.lesson));
  if (button.dataset.addLesson !== undefined) return showLessonForm();
  if (button.dataset.duplicate !== undefined) return mutate(next => { const lessons = currentLessons(); const copy = clone(lessons[Number(button.dataset.duplicate)]); copy.id = crypto.randomUUID(); lessons.push(copy); replaceLessons(next, lessons); });
  if (button.dataset.remove !== undefined) {
    if (!confirm('Удалить эту пару из черновика?')) return;
    return mutate(next => { const lessons = currentLessons(); lessons.splice(Number(button.dataset.remove), 1); replaceLessons(next, lessons); });
  }
  if (button.dataset.shift !== undefined) return moveLesson(Number(button.dataset.shift), Number(button.dataset.shift) + Number(button.dataset.step));
  if (button.dataset.emptyDay !== undefined) return mutate(next => { next.overrides[dateKey(selectedDate())] = { note: next.overrides[dateKey(selectedDate())]?.note || 'Занятий нет', lessons: [] }; });
  if (button.dataset.resetDay !== undefined) return mutate(next => { delete next.overrides[dateKey(selectedDate())]; });
  if (button.dataset.settings !== undefined) return showSettings();
  if (button.dataset.undo !== undefined && undo.length) { redo.push(clone(getSchedule())); const next = undo.pop(); setSchedule(next); writeStored(SCHEDULE_DRAFT_KEY, next); return updatePanel(); }
  if (button.dataset.redo !== undefined && redo.length) { undo.push(clone(getSchedule())); const next = redo.pop(); setSchedule(next); writeStored(SCHEDULE_DRAFT_KEY, next); return updatePanel(); }
  if (button.dataset.resetDraft !== undefined) { if (!confirm('Сбросить все изменения в расписании на этом устройстве?')) return; undo = []; redo = []; localStorage.removeItem(SCHEDULE_DRAFT_KEY); setSchedule(clone(getBaseSchedule())); return updatePanel(); }
  if (button.dataset.download !== undefined) return downloadJson();
  if (button.dataset.copyJson !== undefined) return navigator.clipboard.writeText(JSON.stringify(getSchedule(), null, 2)).then(() => { button.textContent = 'Скопировано'; }).catch(() => { button.textContent = 'Не удалось скопировать'; });
  if (button.dataset.publish !== undefined) return publish();
}
export function toggleEditor(lessonIndex) {
  editing = !editing || Number.isInteger(lessonIndex);
  const page = document.querySelector('#schedule-page'); if (!page) return;
  page.classList.toggle('is-editing', editing);
  page.querySelector('#sched-edit').textContent = editing ? 'Закрыть редактор' : '✎ Изменить';
  if (!editing) { page.querySelector('#sched-editor').innerHTML = ''; return; }
  updatePanel();
  if (Number.isInteger(lessonIndex)) showLessonForm(lessonIndex);
  else page.querySelector('#sched-editor').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
export function installScheduleEditor() {
  setEditorHandler(toggleEditor);
  window.addEventListener('hashchange', () => { if (!location.hash.startsWith('#/schedule')) editing = false; });
  document.addEventListener('dragstart', event => { const row = event.target.closest('#sched-editor [data-drag-index]'); if (row) { draggedLesson = Number(row.dataset.dragIndex); event.dataTransfer.effectAllowed = 'move'; } });
  document.addEventListener('dragover', event => { if (draggedLesson >= 0 && event.target.closest('#sched-editor [data-drag-index]')) event.preventDefault(); });
  document.addEventListener('drop', event => { const row = event.target.closest('#sched-editor [data-drag-index]'); if (row && draggedLesson >= 0) { event.preventDefault(); moveLesson(draggedLesson, Number(row.dataset.dragIndex)); } draggedLesson = -1; });
  document.addEventListener('dragend', () => { draggedLesson = -1; });
  document.addEventListener('schedule:day', () => { if (editing) updatePanel(); });
  document.addEventListener('click', event => {
    if (event.target.closest('#sched-editor')) handleClick(event);
    const close = event.target.closest('[data-close-dialog]'); if (close) close.closest('dialog').close();
    const slot = event.target.closest('[data-slot]'); if (slot) { const [start, end] = slot.dataset.slot.split('–'); const form = slot.closest('form'); form.elements.start.value = start; form.elements.end.value = end; }
  });
  document.addEventListener('change', event => { if (event.target.matches('#sched-editor [data-note]')) mutate(next => { const key = dateKey(selectedDate()); next.overrides[key] = { note: event.target.value.trim(), lessons: clone(next.overrides[key]?.lessons ?? lessonsOn(selectedDate(), next)) }; }); });
  document.addEventListener('submit', event => {
    if (event.target.id === 'schedule-lesson-form') {
      event.preventDefault(); const form = event.target, values = Object.fromEntries(new FormData(form));
      const lesson = normalizeLesson({ ...values, subject: form.elements.break.checked && !values.subject.trim() ? 'Перерыв' : values.subject, break: form.elements.break.checked }, selectedLesson >= 0 ? currentLessons()[selectedLesson].id : crypto.randomUUID());
      const result = validateLessons([lesson]);
      if (result.errors.length) { form.querySelector('#lesson-error').textContent = result.errors.join(' · '); return; }
      mutate(next => { const lessons = currentLessons(); if (selectedLesson >= 0) lessons[selectedLesson] = lesson; else lessons.push(lesson); replaceLessons(next, lessons); });
      form.closest('dialog').close();
    }
    if (event.target.id === 'schedule-settings-form') {
      event.preventDefault(); const form = event.target, anchor = parseDate(form.elements.anchorMonday.value);
      const lines = form.elements.vacations.value.trim().split('\n').filter(Boolean);
      const vacations = lines.map(line => { const [from, to] = line.split(',').map(value => value.trim()); return { from, to, recurring: /^\d{2}-\d{2}$/.test(from) }; });
      if (!anchor || anchor.getDay() !== 1 || vacations.some(v => !v.from || !v.to || (v.recurring ? !/^\d{2}-\d{2}$/.test(v.to) : !parseDate(v.from) || !parseDate(v.to)))) { form.querySelector('#settings-error').textContent = 'Укажите понедельник и корректные диапазоны каникул.'; return; }
      mutate(next => { next.anchorMonday = form.elements.anchorMonday.value; next.anchorParity = form.elements.anchorParity.value; next.defaultLocation = form.elements.defaultLocation.value.trim(); next.vacations = vacations; }); form.closest('dialog').close();
    }
    if (event.target.id === 'schedule-publish-form') { event.preventDefault(); commitSchedule(event.target); }
  });
  document.addEventListener('keydown', event => {
    if (!editing || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z' || /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName)) return;
    event.preventDefault(); document.querySelector(event.shiftKey ? '[data-redo]' : '[data-undo]')?.click();
  });
  window.addEventListener('beforeunload', event => { if (editing && describeChanges().length) { event.preventDefault(); event.returnValue = ''; } });
  document.body.insertAdjacentHTML('beforeend', `<dialog id="schedule-lesson-dialog" class="app-dialog"></dialog><dialog id="schedule-settings-dialog" class="app-dialog"></dialog><dialog id="schedule-conflict-dialog" class="app-dialog"><h2>Расписание изменилось на GitHub</h2><p>После открытия редактора кто-то сохранил новую версию.</p><div class="dialog-actions"><button class="btn2" data-choice="cancel">Отмена</button><button class="btn2" data-choice="overwrite">Перезаписать</button><button class="btn2 btn-primary" data-choice="apply">Применить мои изменения поверх новой версии</button></div></dialog><dialog id="schedule-publish-dialog" class="app-dialog"><form id="schedule-publish-form"><div class="dialog-head"><h2>Сохранить в GitHub</h2><button type="button" data-close-dialog aria-label="Закрыть">×</button></div><pre id="schedule-publish-summary"></pre><label class="sched-field">Сообщение коммита<input name="message" maxlength="160" required></label><label class="sched-field">Fine-grained PAT<input name="token" type="password" autocomplete="off" placeholder="Оставьте пустым, если токен уже сохранён"></label><p class="token-present" hidden>Токен на этом устройстве уже есть.</p><label class="sched-checkbox"><input name="remember" type="checkbox"> Запомнить токен на этом устройстве</label><p class="dialog-hint">Создайте токен GitHub с доступом только к RedstoneLord/itmo-m3102 и правом Contents: Read and write. На чужом компьютере не отмечайте «Запомнить».</p><p class="dialog-hint"><a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">Создать fine-grained PAT ↗</a></p><p id="schedule-publish-status" aria-live="polite"></p><div class="dialog-actions"><button type="button" class="btn2" id="forget-github-token">Забыть токен</button><button type="submit" class="btn2 btn-primary">Сохранить</button></div></form></dialog>`);
  document.querySelector('#forget-github-token').onclick = () => { forgetToken(); document.querySelector('.token-present').hidden = true; document.querySelector('#schedule-publish-status').textContent = 'Токен удалён с этого устройства.'; };
}
