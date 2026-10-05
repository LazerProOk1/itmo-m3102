import { getToken, saveToken, forgetToken, readRepoFileOptional, readRepoFileMeta, writeRepoFile, writeRepoFileBase64, deleteRepoFile, repoEditUrl } from './github.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const MEMES_PATH = 'data/memes.json';
const MEMES_FOLDER = 'img/memes';
const MAX_BYTES = 4 * 1024 * 1024;
const NAME_KEY = 'm3102-meme-name-v1';
const rawUrl = path => `https://raw.githubusercontent.com/RedstoneLord/itmo-m3102/master/${path.split('/').map(encodeURIComponent).join('/')}`;

let manifest = null, loading = null;

function normalize(raw) {
  if (!raw || !Array.isArray(raw.items)) return { version: 1, items: [] };
  return { version: 1, items: raw.items.filter(item => item && item.id && item.file).map(item => ({
    id: String(item.id), file: String(item.file), title: String(item.title || ''), uploader: String(item.uploader || ''), createdAt: String(item.createdAt || ''),
  })) };
}
async function ensureMemes() {
  if (manifest) return manifest;
  if (!loading) loading = (async () => {
    let remote;
    try { remote = await readRepoFileOptional(MEMES_PATH); }
    catch (error) {
      const response = await fetch('./data/memes.json').catch(() => null);
      if (!response?.ok) throw error;
      remote = { text: await response.text() };
    }
    manifest = remote ? normalize(JSON.parse(remote.text)) : { version: 1, items: [] };
    return manifest;
  })().catch(error => { loading = null; throw error; });
  return loading;
}
const sortedItems = () => [...(manifest?.items || [])].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

function memeCard(item) {
  const src = rawUrl(item.file);
  const meta = [item.uploader, item.createdAt ? new Date(item.createdAt).toLocaleDateString('ru-RU') : ''].filter(Boolean).join(' · ');
  return `<figure class="meme-card" data-meme="${esc(item.id)}">
    <button type="button" class="meme-delete" data-meme-delete="${esc(item.id)}" aria-label="Удалить мем" title="Удалить">×</button>
    <div class="meme-img" data-meme-open="${esc(src)}"><img src="${esc(src)}" alt="${esc(item.title || 'Мем')}" loading="lazy"></div>
    ${item.title || meta ? `<figcaption>${item.title ? `<strong>${esc(item.title)}</strong>` : ''}${meta ? `<small>${esc(meta)}</small>` : ''}</figcaption>` : ''}
  </figure>`;
}
function renderGrid() {
  const grid = document.querySelector('#meme-grid');
  if (!grid) return;
  const items = sortedItems();
  grid.innerHTML = items.length ? items.map(memeCard).join('') : '<div class="meme-empty"><span aria-hidden="true">🖼</span><strong>Мемов пока нет</strong><p>Загрузите первый — кнопка выше.</p></div>';
}
function openLightbox(src) {
  const box = document.createElement('div');
  box.className = 'img-lightbox';
  box.innerHTML = `<img src="${esc(src)}" alt="">`;
  box.onclick = () => box.remove();
  document.body.append(box);
}
function openUploadDialog() {
  const dialog = document.querySelector('#meme-upload-dialog');
  dialog.innerHTML = `<form id="meme-upload-form"><div class="dialog-head"><h2>Добавить мем</h2><button type="button" data-close-dialog aria-label="Закрыть">×</button></div>
    <label class="sched-field">Изображение<input type="file" name="image" accept="image/*" required></label>
    <label class="sched-field">Подпись (необязательно)<input name="title" maxlength="140"></label>
    <label class="sched-field">Ваше имя (необязательно)<input name="uploader" maxlength="60" value="${esc(localStorage.getItem(NAME_KEY) || '')}"></label>
    <label class="sched-field">Fine-grained PAT<input name="token" type="password" autocomplete="off" placeholder="Оставьте пустым, если токен уже сохранён"></label>
    <p class="token-present" ${getToken() ? '' : 'hidden'}>Токен на этом устройстве уже есть.</p>
    <label class="sched-checkbox"><input type="checkbox" name="remember"> Запомнить токен на этом устройстве</label>
    <p class="dialog-hint">Нужен fine-grained PAT с доступом к RedstoneLord/itmo-m3102 и правом Contents: Read and write. Файл — до ${(MAX_BYTES / 1024 / 1024).toFixed(0)} МБ.</p>
    <p class="dialog-hint"><a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">Создать fine-grained PAT ↗</a></p>
    <p id="meme-upload-status" class="sched-edit-status" aria-live="polite"></p>
    <div class="dialog-actions"><button type="button" class="btn2" id="forget-meme-token">Забыть токен</button><button type="button" class="btn2" data-close-dialog>Отмена</button><button class="btn2 btn-primary" type="submit">Загрузить</button></div></form>`;
  dialog.showModal();
  dialog.querySelector('#forget-meme-token').onclick = () => { forgetToken(); dialog.querySelector('.token-present').hidden = true; dialog.querySelector('#meme-upload-status').textContent = 'Токен удалён с этого устройства.'; };
}
async function uploadMeme(form) {
  const status = form.querySelector('#meme-upload-status');
  const file = form.elements.image.files[0];
  if (!file) { status.textContent = 'Выберите изображение.'; return; }
  if (!file.type.startsWith('image/')) { status.textContent = 'Нужен файл изображения.'; return; }
  if (file.size > MAX_BYTES) { status.textContent = `Файл слишком большой (максимум ${(MAX_BYTES / 1024 / 1024).toFixed(0)} МБ).`; return; }
  const token = form.elements.token.value.trim();
  if (token) saveToken(token, form.elements.remember.checked);
  if (!getToken()) { status.textContent = 'Введите токен с правом Contents: Read and write.'; return; }
  const title = form.elements.title.value.trim(), uploader = form.elements.uploader.value.trim();
  if (uploader) { try { localStorage.setItem(NAME_KEY, uploader); } catch { /* Приватный режим. */ } }
  status.textContent = 'Загружаем изображение…';
  try {
    const ext = (/\/(\w+)/.exec(file.type)?.[1] || 'png').replace('jpeg', 'jpg').replace(/[^a-z0-9]/gi, '') || 'png';
    const id = crypto.randomUUID();
    const path = `${MEMES_FOLDER}/${id}.${ext}`;
    const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
    await writeRepoFileBase64(path, dataUrl.split(',')[1] || '', `Мемы: добавить ${title || id}`);
    status.textContent = 'Обновляем список…';
    const remote = await readRepoFileOptional(MEMES_PATH);
    const current = remote ? normalize(JSON.parse(remote.text)) : { version: 1, items: [] };
    current.items.push({ id, file: path, title, uploader, createdAt: new Date().toISOString() });
    await writeRepoFile(MEMES_PATH, JSON.stringify(current, null, 2) + '\n', `Мемы: добавить ${title || id}`, remote?.sha);
    manifest = current;
    renderGrid();
    status.textContent = 'Мем добавлен.';
    setTimeout(() => form.closest('dialog').close(), 900);
  } catch (error) { status.textContent = error.message || 'Не удалось загрузить мем.'; }
}
async function removeMeme(id) {
  const item = manifest?.items.find(entry => entry.id === id);
  if (!item) return;
  if (!getToken()) { alert('Для удаления нужен токен GitHub с правом Contents: Read and write.'); return; }
  if (!confirm('Удалить этот мем для всей группы?')) return;
  try {
    const meta = await readRepoFileMeta(item.file);
    if (meta) await deleteRepoFile(item.file, `Мемы: удалить ${item.title || id}`, meta.sha);
    const remote = await readRepoFileOptional(MEMES_PATH);
    const current = remote ? normalize(JSON.parse(remote.text)) : { version: 1, items: [] };
    current.items = current.items.filter(entry => entry.id !== id);
    await writeRepoFile(MEMES_PATH, JSON.stringify(current, null, 2) + '\n', `Мемы: удалить ${item.title || id}`, remote?.sha);
    manifest = current;
    renderGrid();
  } catch (error) { alert(error.message || 'Не удалось удалить мем.'); }
}
export function renderMemesPage() {
  const content = document.querySelector('#content');
  content.innerHTML = `<section class="memes-page"><div class="intro memes-intro"><div><span class="sched-eyebrow">БЕЗ ЭТОГО НИКАК · М3102</span><h1>Мемы</h1><p class="sub">Общая коллекция группы. Загружайте новые — они появятся у всех после сохранения в GitHub.</p></div><button class="btn2 btn-primary" id="meme-add" type="button">＋ Добавить мем</button></div><div id="meme-grid" class="meme-grid"><p class="state">Загрузка…</p></div><p class="dialog-hint">Изображения и подписи хранятся в репозитории и видны всей группе. <a href="${repoEditUrl(MEMES_PATH)}" target="_blank" rel="noopener">Список на GitHub ↗</a></p></section>`;
  content.querySelector('#meme-add').onclick = openUploadDialog;
  ensureMemes().then(renderGrid).catch(error => { const grid = content.querySelector('#meme-grid'); if (grid) grid.innerHTML = `<p class="state">Не удалось загрузить мемы: ${esc(error.message)}</p>`; });
}
export function installMemes() {
  document.body.insertAdjacentHTML('beforeend', '<dialog id="meme-upload-dialog" class="app-dialog"></dialog>');
  document.addEventListener('click', event => {
    const remove = event.target.closest('[data-meme-delete]'); if (remove) return removeMeme(remove.dataset.memeDelete);
    const open = event.target.closest('[data-meme-open]'); if (open) return openLightbox(open.dataset.memeOpen);
  });
  document.addEventListener('submit', event => { if (event.target.id === 'meme-upload-form') { event.preventDefault(); uploadMeme(event.target); } });
}
