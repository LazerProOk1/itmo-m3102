import { repoEditUrl } from './github.js';
import { LOADER } from './icons.js';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const KINDS = [
  [/forms\.gle|docs\.google\.com\/forms/, 'Форма', 'FORM'],
  [/disk\.yandex|yadi\.sk/, 'Диск', 'DISK'],
  [/yonote/, 'Yonote', 'YO'],
  [/t\.me/, 'Telegram', 'TG'],
  [/github\.io/, 'Сайт', 'WEB'],
  [/github\.com/, 'GitHub', 'GIT'],
];
const kindOf = item => {
  if (item.kind) return { label: item.kind, badge: item.kind.slice(0, 4).toUpperCase() };
  const hit = KINDS.find(([re]) => re.test(item.url));
  return hit ? { label: hit[1], badge: hit[2] } : { label: 'Ссылка', badge: '↗' };
};
const tone = text => [...text].reduce((v, c) => (v * 31 + c.charCodeAt(0)) >>> 0, 7) % 6;
const safeUrl = raw => { try { const u = new URL(raw); return /^https?:$/.test(u.protocol) ? u.href : ''; } catch { return ''; } };
const host = url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };

/** Переключатель «Файлы | Ссылки» для раздела «Материалы». */
export const materialsSwitch = active => `<nav class="mat-switch" aria-label="Раздел материалов"><a href="#/materials" class="${active === 'files' ? 'is-active' : ''}">Файлы</a><a href="#/links" class="${active === 'links' ? 'is-active' : ''}">Ссылки</a></nav>`;

function normalize(raw) {
  const items = Array.isArray(raw?.items) ? raw.items : [];
  return items.filter(i => i && i.title && safeUrl(i.url)).map(i => ({
    title: String(i.title), description: String(i.description || ''), url: safeUrl(i.url),
    group: String(i.group || 'Прочее'), subject: String(i.subject || ''), kind: i.kind ? String(i.kind) : '',
  }));
}
function card(item, i) {
  const k = kindOf(item);
  const search = `${item.title} ${item.description} ${item.subject} ${k.label} ${host(item.url)}`.toLowerCase();
  return `<a class="link-card tone-${tone(item.subject || item.group)}" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer" style="--i:${i}" data-search="${esc(search)}">
    <span class="link-badge" aria-hidden="true">${esc(k.badge)}</span>
    <span class="link-body"><strong>${esc(item.title)}</strong>${item.description ? `<small>${esc(item.description)}</small>` : ''}
      <span class="link-meta">${item.subject ? `<span class="link-subject">${esc(item.subject)}</span>` : ''}<span class="link-host">${esc(host(item.url))}</span></span></span>
    <span class="link-arrow" aria-hidden="true">↗</span></a>`;
}
function draw(root, items, query = '') {
  const q = query.trim().toLowerCase();
  const groups = new Map();
  items.forEach(item => { if (!groups.has(item.group)) groups.set(item.group, []); groups.get(item.group).push(item); });
  let n = 0;
  root.innerHTML = [...groups].map(([name, list]) => `<section class="link-group"><div class="link-group-head"><h2>${esc(name)}</h2><span>${list.length}</span></div><div class="link-grid">${list.map(item => card(item, n++)).join('')}</div></section>`).join('')
    || '<div class="link-empty"><span>🔗</span><strong>Ссылок пока нет</strong><p>Добавьте первую — кнопка выше.</p></div>';
  if (q) {
    root.querySelectorAll('.link-card').forEach(c => { c.hidden = !c.dataset.search.includes(q); });
    root.querySelectorAll('.link-group').forEach(g => { g.hidden = ![...g.querySelectorAll('.link-card')].some(c => !c.hidden); });
    if (![...root.querySelectorAll('.link-card')].some(c => !c.hidden)) root.insertAdjacentHTML('beforeend', '<div class="link-empty"><span>🔍</span><strong>Ничего не найдено</strong><p>Попробуйте другое слово.</p></div>');
  }
}
export async function renderLinksPage() {
  const content = document.querySelector('#content');
  content.innerHTML = `<section class="links-page">
    <div class="intro links-intro"><div><span class="sched-eyebrow">ПОЛЕЗНЫЕ ССЫЛКИ · М3102</span><h1>Материалы</h1><p class="sub">Формы сдачи, чужие конспекты и курсы — всё, что обычно теряется в чатах.</p></div>
      <a class="btn2 btn-primary" href="${repoEditUrl('data/links.json')}" target="_blank" rel="noopener">＋ Добавить ссылку</a></div>
    ${materialsSwitch('links')}
    <label class="links-search"><input type="search" placeholder="Поиск по ссылкам" aria-label="Поиск по ссылкам" autocomplete="off"></label>
    <div id="links-list"><p class="state">${LOADER}</p></div>
    <details class="links-help"><summary>Как добавить ссылку</summary>
      <p>Нажмите «Добавить ссылку», в открывшемся файле <code>data/links.json</code> скопируйте любой блок внутри <code>items</code> и поправьте поля:</p>
      <pre>{
  "title": "Название",
  "description": "Короткое пояснение",
  "url": "https://…",
  "group": "Раздел на странице",
  "subject": "Предмет (задаёт цвет)"
}</pre>
      <p>Блоки разделяются запятой. Обязательны только <code>title</code> и <code>url</code>. После сохранения сайт обновится в течение пары минут.</p></details></section>`;
  const list = content.querySelector('#links-list');
  try {
    const response = await fetch('./data/links.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const items = normalize(await response.json());
    draw(list, items);
    content.querySelector('.links-search input').addEventListener('input', e => draw(list, items, e.target.value));
  } catch (error) { list.innerHTML = `<p class="state">Не удалось загрузить ссылки: ${esc(error.message)}</p>`; }
}
