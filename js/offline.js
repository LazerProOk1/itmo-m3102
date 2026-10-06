/*
  Офлайн-режим: сохраняет в кэш браузера всё, что сайт умеет показывать без сети.

  - Один запрос к GitHub (git/trees) даёт список всех файлов репозитория с их sha, поэтому скачиваются
    только новые и изменённые файлы: конспекты (.md), PDF и картинки из папок материалов.
  - Списки папок для раздела «Материалы» собираются из того же дерева и кладутся туда, где их ищет sw.js.
  - JSON-данные сайта (лекции, ссылки, мемы, дедлайны) и расписание/домашние задания тоже прогреваются.
  - Аудио, docx, djvu не сохраняются: сайт открывает их только по ссылке «Скачать», офлайн она не сработает.

  Кэш CONTENT общий с sw.js (там же он используется при чтении). Состояние — в localStorage:
  { mode: 'on' | 'off' | undefined, files: { путь: sha }, at: ISO-дата }.
  mode не задан — первая загрузка стартует сама, только если файлов немного (AUTO_LIMIT), иначе спрашивает.
*/
import { githubFetch } from './github.js';
import { ensureSchedule } from './schedule-ui.js';
import { ensureHomework } from './homework.js';

const OWNER = 'RedstoneLord', REPO = 'itmo-m3102', BRANCH = 'master';
const CONTENT = 'm3102-content-v1';
const STATE_KEY = 'm3102-offline-v1';
const ROOTS = ['Конспекты', 'Записи лекций', 'Лабораторные', 'Материалы'];
const EXTRA_DIRS = ['img/diagrams/', 'img/memes/'];
const PHOTOS = 'img/photos/';
const VIEWABLE = /\.(md|pdf|png|jpe?g|gif|webp|svg|avif)$/i;
const WARM = ['data/lectures.json', 'data/display-names.json', 'data/old-paths.json', 'data/search-index.json', 'data/links.json', 'data/memes.json', 'Дедлайны/deadlines.json'];
const AUTO_LIMIT = 40 * 1024 * 1024;
const WORKERS = 4;
const RESYNC_MS = 6 * 3600e3;

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const enc = path => path.split('/').map(encodeURIComponent).join('/');
const rawUrl = path => `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${enc(path)}`;
const apiUrl = path => `https://api.github.com/repos/${OWNER}/${REPO}/contents${path ? `/${enc(path)}` : ''}?ref=${BRANCH}`;
const mb = bytes => `${(bytes / 1048576).toLocaleString('ru-RU', { maximumFractionDigits: bytes < 10485760 ? 1 : 0 })} МБ`;
const read = () => { try { return JSON.parse(localStorage.getItem(STATE_KEY)) || {}; } catch { return {}; } };
const save = patch => { try { localStorage.setItem(STATE_KEY, JSON.stringify({ ...read(), ...patch })); } catch { /* Приватный режим. */ } };

let status = { phase: 'idle', failed: 0 }, running = null, usage = '', dismissed = false, bar = null;
function emit(patch) {
  status = { ...status, ...patch };
  document.dispatchEvent(new CustomEvent('offline:status', { detail: status }));
  drawBar();
}
async function refreshUsage() {
  try { const { usage: used, quota } = await navigator.storage.estimate(); usage = `На устройстве занято ${mb(used)} из ${mb(quota)}.`; } catch { usage = ''; }
  document.dispatchEvent(new CustomEvent('offline:status', { detail: status }));
}

/* ---------- синхронизация ---------- */
const inScope = path => ROOTS.some(root => path.startsWith(`${root}/`)) || EXTRA_DIRS.some(dir => path.startsWith(dir));
const isWanted = entry => entry.type === 'blob' && VIEWABLE.test(entry.path) && inScope(entry.path);

async function fetchTree() {
  const response = await githubFetch(`https://api.github.com/repos/${OWNER}/${REPO}/git/trees/${BRANCH}?recursive=1`);
  if (!response.ok) throw new Error(response.status === 403 ? 'Достигнут лимит GitHub API — попробуйте позже.' : `GitHub ответил с ошибкой ${response.status}.`);
  const data = await response.json();
  return (data.tree || []).filter(entry => entry.type === 'blob' || entry.type === 'tree');
}

// Ответы вида GET /contents/<папка> — их читает renderBrowse (раздел «Материалы»)
async function seedListings(cache, tree) {
  const dirs = new Map([['', []]]);
  for (const entry of tree) {
    const cut = entry.path.lastIndexOf('/'), parent = cut < 0 ? '' : entry.path.slice(0, cut);
    if (!dirs.has(parent)) dirs.set(parent, []);
    if (entry.type === 'tree' && !dirs.has(entry.path)) dirs.set(entry.path, []);
    dirs.get(parent).push({ name: entry.path.slice(cut + 1), path: entry.path, type: entry.type === 'tree' ? 'dir' : 'file', size: entry.size || 0, sha: entry.sha });
  }
  const headers = { 'Content-Type': 'application/json; charset=utf-8' };
  for (const [dir, items] of dirs) await cache.put(apiUrl(dir), new Response(JSON.stringify(items), { headers }));
}

async function checkSpace(bytes) {
  try {
    const { usage: used, quota } = await navigator.storage.estimate();
    if (quota && bytes > (quota - used) * 0.9) throw new Error(`Не хватает места: нужно ${mb(bytes)}, свободно около ${mb(quota - used)}.`);
  } catch (error) { if (error.message.startsWith('Не хватает')) throw error; }
}

async function pool(items, worker) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(WORKERS, items.length) }, async () => { while (next < items.length) await worker(items[next++]); }));
}

async function run(auto) {
  if (!('caches' in window)) throw new Error('Браузер не поддерживает офлайн-кэш.');
  emit({ phase: 'tree', error: '', failed: 0 });
  const files = { ...(read().files || {}) };
  const tree = await fetchTree();
  const cache = await caches.open(CONTENT);
  const wanted = tree.filter(isWanted), todo = [];
  for (const entry of wanted) if (files[entry.path] !== entry.sha || !(await cache.match(rawUrl(entry.path), { ignoreVary: true }))) todo.push(entry);
  const bytes = todo.reduce((sum, entry) => sum + (entry.size || 0), 0);
  if (auto && read().mode !== 'on' && bytes > AUTO_LIMIT) { emit({ phase: 'ask', bytes, count: todo.length }); return; }
  await checkSpace(bytes);
  Promise.resolve(navigator.storage?.persist?.()).catch(() => {}); // просим браузер не вычищать кэш при нехватке места

  // Сначала маленькое, но важное: списки папок, JSON-данные, расписание, задания, фото студентов
  await seedListings(cache, tree);
  const photos = tree.filter(entry => entry.type === 'blob' && entry.path.startsWith(PHOTOS));
  await Promise.allSettled([
    ...WARM.map(path => fetch(`./${enc(path)}`, { cache: 'no-cache' }).then(response => response.blob())),
    ...photos.map(entry => fetch(`./${enc(entry.path)}`).then(response => response.blob())),
    ensureSchedule(), ensureHomework(),
  ]);

  const total = todo.length;
  let done = 0, loaded = 0, failed = 0;
  emit({ phase: 'download', total, done, failed, bytes, loaded });
  await pool(todo, async entry => {
    try {
      const url = rawUrl(entry.path);
      // cache:'reload' sw.js не перехватывает: получаем заведомо свежий файл, а не копию из кэша
      const response = await fetch(url, { cache: 'reload', credentials: 'omit' });
      if (!response.ok) throw new Error(String(response.status));
      await cache.put(url, response);
      files[entry.path] = entry.sha; loaded += entry.size || 0;
    } catch { failed++; }
    done++;
    emit({ phase: 'download', total, done, failed, bytes, loaded });
    if (done % 25 === 0) save({ files });
  });

  const keep = new Set(wanted.map(entry => entry.path));
  for (const path of Object.keys(files)) if (!keep.has(path)) { await cache.delete(rawUrl(path), { ignoreVary: true }); delete files[path]; }
  save({ files, at: new Date().toISOString() });
  emit({ phase: 'done', total, done, failed, bytes, loaded });
}

export function syncOffline({ auto = false } = {}) {
  if (running) return running;
  running = run(auto)
    .catch(error => emit({ phase: 'error', error: error.message || String(error) }))
    .finally(() => { running = null; refreshUsage(); });
  return running;
}
export async function clearOffline() {
  await caches.delete(CONTENT);
  save({ files: {}, at: '', mode: 'off' });
  emit({ phase: 'idle', failed: 0, error: '' });
  refreshUsage();
}

/* ---------- интерфейс ---------- */
function injectStyles() {
  if (document.getElementById('offline-style')) return;
  const style = document.createElement('style'); style.id = 'offline-style';
  style.textContent = `.off-bar{position:fixed;left:12px;right:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 12px);z-index:960;display:flex;align-items:center;flex-wrap:wrap;gap:8px 10px;max-width:560px;margin:0 auto;padding:11px 14px;border:1px solid var(--border);border-radius:11px;background:var(--card);color:var(--text);box-shadow:0 14px 40px rgba(20,20,35,.2);font-size:.82rem}
.off-bar[hidden]{display:none}.off-bar>span{flex:1 1 220px}
@media(max-width:760px){.off-bar{bottom:calc(env(safe-area-inset-bottom,0px) + 84px)}}
.off-line{margin:0 0 10px;font-size:.88rem;line-height:1.5}.off-progress{height:8px;border-radius:999px;background:var(--border);overflow:hidden;margin:0 0 10px}
.off-progress>span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--accent),var(--accent2));transition:width .3s}
.off-usage{color:var(--muted);font-size:.76rem;margin:0 0 12px}.off-actions{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}`;
  document.head.appendChild(style);
}
function drawBar() {
  if (!bar) return;
  if (status.phase === 'ask' && !dismissed) {
    bar.innerHTML = `<span>Скачать материалы для работы без сети? ${status.count} файлов, ${mb(status.bytes)}.</span><button class="btn2 btn-primary" type="button" data-off="go">Скачать</button><button class="btn2" type="button" data-off="skip">Не сейчас</button>`;
    bar.hidden = false;
  } else if (!navigator.onLine) { bar.textContent = 'Нет сети — показаны сохранённые данные.'; bar.hidden = false; }
  else bar.hidden = true;
}
const startDownload = () => { dismissed = false; save({ mode: 'on' }); syncOffline(); };

export function mountOfflinePanel(root) {
  const draw = () => {
    if (!root.isConnected) return document.removeEventListener('offline:status', draw);
    const state = read(), s = status, count = Object.keys(state.files || {}).length, busy = s.phase === 'tree' || s.phase === 'download';
    let line;
    if (s.phase === 'tree') line = 'Проверяем список файлов…';
    else if (s.phase === 'download') line = `Скачано ${s.done} из ${s.total} · ${mb(s.loaded)} из ${mb(s.bytes)}${s.failed ? ` · ошибок: ${s.failed}` : ''}`;
    else if (s.phase === 'ask') line = `Нужно скачать ${s.count} файлов (${mb(s.bytes)}).`;
    else if (s.phase === 'error') line = esc(s.error);
    else line = count ? `Сохранено файлов: ${count}${state.at ? ` · обновлено ${new Date(state.at).toLocaleString('ru-RU')}` : ''}${s.failed ? ` · не скачалось: ${s.failed}` : ''}` : 'Конспекты и PDF пока не сохранены на устройство.';
    const pct = s.phase === 'download' && s.total ? Math.round(s.done / s.total * 100) : 0;
    root.innerHTML = `<section class="dash-panel off-panel"><div class="panel-head"><h2>Работа без интернета</h2></div><p class="off-line">${line}</p>${busy ? `<div class="off-progress"><span style="width:${pct}%"></span></div>` : ''}${usage ? `<p class="off-usage">${esc(usage)}</p>` : ''}<div class="off-actions"><button class="btn2 btn-primary" type="button" data-off="go" ${busy ? 'disabled' : ''}>${count ? 'Обновить' : 'Скачать'}</button><button class="btn2" type="button" data-off="clear" ${busy ? 'disabled' : ''}>Очистить</button></div><label class="toggle-label"><input type="checkbox" data-off="auto" ${state.mode === 'off' ? '' : 'checked'}> Обновлять автоматически</label><p class="plan-hint">Сохраняются конспекты, PDF и картинки. Аудио и файлы для скачивания (docx, djvu) офлайн недоступны.</p></section>`;
  };
  root.onclick = async event => {
    const action = event.target.closest('button[data-off]')?.dataset.off;
    if (action === 'go') startDownload();
    if (action === 'clear' && confirm('Удалить сохранённые для офлайна файлы с этого устройства?')) await clearOffline();
  };
  root.onchange = event => { if (event.target.dataset.off === 'auto') save({ mode: event.target.checked ? 'on' : 'off' }); };
  document.addEventListener('offline:status', draw);
  draw(); refreshUsage();
}

export function installOffline() {
  injectStyles();
  bar = document.createElement('div'); bar.className = 'off-bar'; bar.hidden = true; bar.setAttribute('role', 'status');
  bar.onclick = event => {
    const action = event.target.closest('button[data-off]')?.dataset.off;
    if (action === 'go') startDownload();
    if (action === 'skip') { dismissed = true; drawBar(); }
  };
  document.body.append(bar);
  const stale = () => Date.now() - (Date.parse(read().at) || 0) > RESYNC_MS;
  window.addEventListener('offline', drawBar);
  window.addEventListener('online', () => { drawBar(); if (read().mode === 'on' && stale()) syncOffline({ auto: true }); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && navigator.onLine && read().mode === 'on' && stale()) syncOffline({ auto: true }); });
  drawBar();
  // Не мешаем первой отрисовке: синхронизация стартует чуть позже
  if (read().mode !== 'off' && navigator.onLine && !navigator.connection?.saveData) setTimeout(() => syncOffline({ auto: true }), 5000);
}
