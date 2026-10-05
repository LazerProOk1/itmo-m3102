/*
  Боковая панель конспекта (лекции + «Содержание») и поиск по сайту.
  Всё находится ВНЕ #note-body, поэтому генератор PDF (он клонирует только #note-body) не затрагивается.
*/
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const norm = value => String(value ?? '').toLowerCase().replace(/ё/g, 'е');
const nfc = value => String(value ?? '').normalize('NFC');
const enc = path => path.split('/').map(encodeURIComponent).join('/');
const hrefOf = file => `${file.type === 'pdf' ? '#/view/' : '#/note/'}${enc(file.path)}`;
const JUMP_KEY = 'm3102-jump-heading';
const takeJump = () => { try { const value = sessionStorage.getItem(JUMP_KEY) || ''; sessionStorage.removeItem(JUMP_KEY); return value; } catch { return ''; } };
const STATIC_PAGES = [
  { title: 'Расписание', href: '#/schedule' }, { title: 'Домашнее задание', href: '#/homework' }, { title: 'Дедлайны', href: '#/deadlines' },
  { title: 'Материалы', href: '#/materials' }, { title: 'Студенты', href: '#/students' }, { title: 'Диаграммы', href: '#/diagrams' }, { title: 'Мемы', href: '#/memes' },
];
const ICON_CHEV = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_LIST = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 6h16M4 12h10M4 18h13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const ICON_SEARCH = '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="m16 16 4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

// Убирает front-matter (--- main: true ---) из текста конспекта, чтобы он не попадал в разметку
export function stripFrontMatter(text) {
  const m = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  if (!m) return text;
  const lines = m[1].split(/\r?\n/).filter(line => line.trim());
  return lines.length && lines.every(line => /^[\w.-]+\s*:/.test(line.trim())) ? text.slice(m[0].length) : text;
}

/* ---------------- Порядок лекций ---------------- */
// Лекция 1, Лекция 2, Практика 2, Лекция 3 / Лекция 2-3, Лекция 4, Лекция 5-6 ...
const firstNum = value => { const m = /\d+/.exec(value); return m ? Number(m[0]) : Infinity; };
export const byLecture = (a, b) => (firstNum(a.name) - firstNum(b.name)) || a.name.localeCompare(b.name, 'ru', { numeric: true });

/* ---------------- Оригинальные имена файлов и папок ----------------
   tools/normalize-names.mjs переименовывает файлы и папки (пробелы, запятые, точки -> «_»)
   и записывает { "новый/путь": "Оригинальное имя" } в data/display-names.json. */
let namesPromise = null;
export const displayNames = {};
export function loadDisplayNames() {
  namesPromise ||= fetch('./data/display-names.json', { cache: 'no-cache' })
    .then(response => (response.ok ? response.json() : {}))
    .catch(() => ({}))
    .then(map => { for (const [key, value] of Object.entries(map || {})) displayNames[nfc(key)] = value; return displayNames; });
  return namesPromise;
}

const unslug = value => String(value ?? '').replace(/_/g, ' ');
export const prettyName = (path, fallback) => displayNames[nfc(path)] || unslug(fallback);

/* Старые ссылки: data/old-paths.json { "старый/путь": "новый/путь" } */
let movedPromise = null;
export async function findMoved(path) {
  movedPromise ||= fetch('./data/old-paths.json', { cache: 'no-cache' }).then(response => (response.ok ? response.json() : {})).catch(() => ({}));
  const map = await movedPromise;
  return map[nfc(path)] || '';
}

let indexPromise = null;
export function loadLectures() {
  indexPromise ||= Promise.all([
    fetch('./data/lectures.json', { cache: 'no-cache' }).then(response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); }),
    loadDisplayNames(),
  ]).then(([index]) => {
    const applyFolderName = item => { item.name = displayNames[nfc(item.path)] || unslug(item.name); };
    for (const subject of index.subjects || []) {
      subject.path ||= `${index.root}/${subject.name}`;   // у предметов в lectures.json нет path
      applyFolderName(subject);
      for (const lecture of subject.lectures) {
        applyFolderName(lecture);
        for (const file of lecture.files) {
          const original = displayNames[nfc(file.path)];
          file.name = original ? (/\.[^.]+$/.test(file.name) ? original : original.replace(/\.[^.]+$/, '')) : unslug(file.name);
        }
      }
      subject.lectures.sort(byLecture);
    }
    return index;
  }).catch(error => { indexPromise = null; throw error; });
  return indexPromise;
}
function locate(index, path) {
  const target = nfc(path);
  for (const subject of index.subjects || []) for (const lecture of subject.lectures) for (const file of lecture.files) if (nfc(file.path) === target) return { subject, lecture, file };
  return null;
}
function highlight(text, terms) {
  const n = norm(text); let start = -1, length = 0;
  for (const term of terms) { const i = n.indexOf(term); if (i >= 0 && (start < 0 || i < start)) { start = i; length = term.length; } }
  return start < 0 ? esc(text) : `${esc(text.slice(0, start))}<mark>${esc(text.slice(start, start + length))}</mark>${esc(text.slice(start + length))}`;
}
// Подсвечивает все вхождения всех слов (для фрагментов текста в результатах поиска)
function highlightAll(text, terms) {
  const n = norm(text), ranges = [];
  for (const term of terms) for (let i = n.indexOf(term); i >= 0; i = n.indexOf(term, i + term.length)) ranges.push([i, i + term.length]);
  ranges.sort((a, b) => a[0] - b[0]);
  let out = '', pos = 0;
  for (const [start, end] of ranges) {
    if (end <= pos) continue;
    const from = Math.max(start, pos);
    out += `${esc(text.slice(pos, from))}<mark>${esc(text.slice(from, end))}</mark>`; pos = end;
  }
  return out + esc(text.slice(pos));
}

/* ---------------- Боковая панель конспекта ---------------- */
let teardown = null;
export function mountSidebar(host, path, { toc = true } = {}) {
  teardown?.();
  const ac = new AbortController();
  const on = (target, type, fn, options) => target.addEventListener(type, fn, { signal: ac.signal, ...options });
  const $ = selector => host.querySelector(selector);
  let raf = 0, dead = false, items = [], btns = [], activeIdx = -2, cur = null, rendered = false, centered = false, bodyEl = null, observer = null;
  const collapsed = new Set(); // все лекции раскрыты по умолчанию; здесь — только свёрнутые вручную
  if (!toc) takeJump();

  host.hidden = false;
  host.parentElement?.classList.remove('no-side');
  host.className = `note-side-host${toc ? '' : ' no-toc'}`;
  host.innerHTML = `<button class="side-fab" type="button" aria-label="Открыть навигацию" aria-expanded="false">${ICON_LIST}</button>
    <div class="side-backdrop"></div>
    <aside class="side" aria-label="Навигация по конспекту">
      <div class="side-top"><div class="side-tabs" role="tablist"><button type="button" role="tab" data-tab="lectures" aria-selected="false">Лекции</button><button type="button" role="tab" data-tab="toc" aria-selected="false">Содержание</button><span class="side-tabs-ink" aria-hidden="true"></span></div><button class="side-close" type="button" aria-label="Закрыть навигацию">×</button></div>
      <section class="side-sec side-lectures" aria-label="Лекции"><div class="side-head"><h2>Лекции</h2><span class="side-subject"></span></div><input class="side-search" type="search" placeholder="Поиск в предмете" aria-label="Поиск по лекциям этого предмета" autocomplete="off"><div class="lec-list"><p class="side-empty">Загрузка…</p></div></section>
      ${toc ? '<section class="side-sec side-toc" aria-label="Содержание"><div class="side-head"><h2>Содержание</h2></div><nav class="toc"><span class="toc-ink" aria-hidden="true"></span><ol></ol></nav></section>' : ''}
    </aside>
    ${toc ? '<div class="read-progress" aria-hidden="true"><span></span></div>' : ''}`;
  const side = $('.side'), fab = $('.side-fab'), tocNav = $('.toc'), ink = $('.toc-ink'), bar = $('.read-progress span');

  const setOpen = open => {
    host.classList.toggle('is-open', open);
    fab.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('side-open', open);
    if (open) setTimeout(() => $('.side-close')?.focus({ preventScroll: true }), 60);
  };
  const setTab = tab => {
    host.dataset.tab = tab;
    host.querySelectorAll('.side-tabs [role=tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    if (tab === 'toc') { activeIdx = -2; schedule(); } else centerActive();
  };

  /* Лекции */
  function centerActive() {
    const list = $('.lec-list'), active = list?.querySelector('.is-active');
    if (!active || !list.clientHeight || centered) return;
    centered = true; list.scrollTop = Math.max(0, active.offsetTop - list.clientHeight / 2);
  }
  function renderLectures() {
    const list = $('.lec-list'), terms = norm($('.side-search').value.trim()).split(/\s+/).filter(Boolean);
    const { subject, lecture, file } = cur;
    const html = subject.lectures.map((lec, i) => {
      const lectureHit = terms.every(t => norm(lec.name).includes(t));
      const files = terms.length && !lectureHit ? lec.files.filter(f => terms.every(t => norm(f.name).includes(t))) : lec.files;
      if (!files.length) return '';
      const open = terms.length ? true : !collapsed.has(lec.path);
      return `<div class="lec${open ? ' is-open' : ''}${lec === lecture ? ' is-current' : ''}" data-lec="${esc(lec.path)}" style="--i:${i}"><div class="lec-row"><button class="lec-chev" type="button" aria-expanded="${open}" aria-label="Файлы: ${esc(lec.name)}">${ICON_CHEV}</button><a class="lec-name" href="${hrefOf(lec.files[0])}" title="${esc(lec.name)}">${highlight(lec.name, terms)}</a><span class="lec-count">${lec.files.length}</span></div><div class="lec-files"><div class="lec-files-in">${files.map(f => `<a class="lec-file${f.main ? ' is-main' : ''}${f === file ? ' is-active' : ''}" href="${hrefOf(f)}"${f === file ? ' aria-current="page"' : ''} title="${esc(f.name)}"><span class="lec-file-name">${highlight(f.name, terms)}</span>${f.type === 'pdf' ? '<span class="lec-badge">PDF</span>' : ''}</a>`).join('')}</div></div></div>`;
    }).join('');
    list.classList.toggle('enter', !rendered);
    list.innerHTML = html || '<p class="side-empty">Ничего не найдено в этом предмете.</p>';
    rendered = true; centerActive();
  }
  function noLectures() {
    host.classList.add('no-lectures');
    if (toc) setTab('toc'); else { host.hidden = true; host.parentElement?.classList.add('no-side'); }
  }
  loadLectures().then(index => {
    if (dead) return;
    cur = locate(index, path);
    if (!cur) return noLectures();
    $('.side-subject').textContent = cur.subject.name;
    renderLectures();
  }).catch(() => { if (!dead) noLectures(); });
  on($('.side-search'), 'input', () => { if (cur) renderLectures(); });

  /* Содержание + подсветка текущего раздела */
  function setActive(idx) {
    if (idx === activeIdx) return;
    activeIdx = idx;
    btns.forEach((b, i) => { b.classList.toggle('is-active', i === idx); if (i === idx) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
    const b = btns[idx];
    if (!b || !b.offsetHeight) { ink.style.opacity = '0'; return; }
    if (ink.style.opacity !== '1') { ink.style.transition = 'none'; ink.style.height = `${b.offsetHeight}px`; ink.style.transform = `translateY(${b.offsetTop}px)`; ink.offsetHeight; ink.style.transition = ''; }
    ink.style.opacity = '1'; ink.style.height = `${b.offsetHeight}px`; ink.style.transform = `translateY(${b.offsetTop}px)`;
    if (tocNav.clientHeight && (b.offsetTop < tocNav.scrollTop + 6 || b.offsetTop + b.offsetHeight > tocNav.scrollTop + tocNav.clientHeight - 6)) tocNav.scrollTo({ top: b.offsetTop - tocNav.clientHeight / 2, behavior: 'smooth' });
  }
  function update() {
    raf = 0;
    if (dead || !bodyEl) return;
    if (!host.isConnected) return destroy();
    const rect = bodyEl.getBoundingClientRect(), span = rect.height - innerHeight;
    bar.style.transform = `scaleX(${span > 0 ? Math.min(1, Math.max(0, -rect.top / span)) : 0})`;
    let idx = -1;
    for (let i = 0; i < items.length; i++) { if (items[i].el.getBoundingClientRect().top <= 120) idx = i; else break; }
    if (items.length && scrollY > 8 && innerHeight + scrollY >= document.documentElement.scrollHeight - 4) idx = items.length - 1;
    setActive(idx);
  }
  function schedule() { if (!raf && !dead) raf = requestAnimationFrame(update); }
  function setBody(body) {
    bodyEl = body;
    if (!toc) return;
    items = [...body.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(el => {
      const copy = el.cloneNode(true);
      copy.querySelectorAll('.heading-anchor').forEach(n => n.remove());
      copy.querySelectorAll('.katex').forEach(k => k.replaceWith(k.querySelector('annotation')?.textContent || ''));
      return { el, level: Number(el.tagName[1]), text: copy.textContent.replace(/\s+/g, ' ').trim() };
    }).filter(item => item.text);
    const min = Math.min(...items.map(item => item.level));
    tocNav.querySelector('ol').innerHTML = items.length
      ? items.map((item, i) => `<li><button type="button" class="toc-item" data-i="${i}" data-d="${item.level - min}" style="--d:${item.level - min}" title="${esc(item.text)}"><span>${esc(item.text)}</span></button></li>`).join('')
      : '<li class="side-empty">В этом конспекте нет заголовков.</li>';
    btns = [...tocNav.querySelectorAll('.toc-item')];
    on(window, 'scroll', schedule, { passive: true });
    on(window, 'resize', schedule);
    observer = new ResizeObserver(schedule); observer.observe(body);
    schedule();
    const jump = norm(takeJump());
    if (jump) { const hit = items.find(item => norm(item.text) === jump) || items.find(item => norm(item.text).includes(jump)); if (hit) requestAnimationFrame(() => hit.el.scrollIntoView({ block: 'start' })); }
  }

  /* Клики, выезжающее меню, жесты */
  on(host, 'click', e => {
    const chev = e.target.closest('.lec-chev');
    if (chev) {
      const group = chev.closest('.lec'), open = !group.classList.contains('is-open');
      group.classList.toggle('is-open', open); chev.setAttribute('aria-expanded', String(open));
      if (open) collapsed.delete(group.dataset.lec); else collapsed.add(group.dataset.lec);
      return;
    }
    if (e.target.closest('.lec-name, .lec-file')) return setOpen(false);
    const item = e.target.closest('.toc-item');
    if (item) { const target = items[Number(item.dataset.i)]?.el; setOpen(false); if (target) requestAnimationFrame(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' })); return; }
    const tab = e.target.closest('[role=tab]'); if (tab) return setTab(tab.dataset.tab);
    if (e.target.closest('.side-fab')) return setOpen(true);
    if (e.target.closest('.side-close, .side-backdrop')) setOpen(false);
  });
  on(document, 'keydown', e => { if (e.key === 'Escape' && host.classList.contains('is-open')) setOpen(false); });
  on(window, 'resize', () => { if (innerWidth > 1000 && host.classList.contains('is-open')) setOpen(false); });
  let startX = 0, startY = 0, dx = 0, dragging = false;
  on(side, 'touchstart', e => { const t = e.touches[0]; startX = t.clientX; startY = t.clientY; dx = 0; dragging = host.classList.contains('is-open'); }, { passive: true });
  on(side, 'touchmove', e => {
    if (!dragging) return;
    const t = e.touches[0], mx = t.clientX - startX, my = t.clientY - startY;
    if (dx === 0 && Math.abs(my) > Math.abs(mx)) { dragging = false; return; }
    dx = Math.max(0, mx); side.style.transition = 'none'; side.style.transform = `translateX(${dx}px)`;
  }, { passive: true });
  on(side, 'touchend', () => { if (!dragging) return; side.style.transition = ''; side.style.transform = ''; if (dx > 70) setOpen(false); dragging = false; }, { passive: true });
  on(window, 'hashchange', () => setTimeout(() => { if (!host.isConnected) destroy(); }, 0));

  function destroy() {
    dead = true; ac.abort(); cancelAnimationFrame(raf); observer?.disconnect();
    document.body.classList.remove('side-open');
    if (teardown === destroy) teardown = null;
  }
  teardown = destroy;
  setTab(toc ? 'toc' : 'lectures');
  return { setBody, destroy };
}

/* ---------------- Поиск по сайту ---------------- */
function buildEntries(index) {
  const out = STATIC_PAGES.map(page => ({ ...page, sub: 'Раздел сайта', kind: 'page' }));
  for (const subject of index?.subjects || []) for (const lecture of subject.lectures) {
    out.push({ title: lecture.name, sub: subject.name, href: hrefOf(lecture.files[0]), kind: 'lecture' });
    for (const file of lecture.files) {
      out.push({ title: file.name, sub: `${subject.name} · ${lecture.name}`, href: hrefOf(file), kind: file.type });
      for (const heading of file.headings || []) out.push({ title: heading, sub: `${subject.name} · ${lecture.name} · ${file.name}`, href: hrefOf(file), kind: 'h', jump: heading });
    }
  }
  return out;
}
const KIND_LABEL = { md: 'MD', pdf: 'PDF', h: '§', lecture: 'ЛК', page: '↗' };

/* Полнотекстовый индекс: data/search-index.json (строится tools/build-search-index.mjs) */
let textPromise = null;
function loadTextIndex() {
  textPromise ||= fetch('./data/search-index.json', { cache: 'no-cache' })
    .then(response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); })
    .then(raw => ({ files: raw.files || [], sections: (raw.sections || []).map(([f, h, t, p]) => ({ f, h, t, p })) }))
    .catch(error => { textPromise = null; throw error; });
  return textPromise;
}
function fileInfo(path) {
  let acc = '';
  const shown = path.split('/').map(segment => { acc = acc ? `${acc}/${segment}` : segment; return prettyName(acc, segment); });
  const title = shown.pop().replace(/\.[^.]+$/, '');
  shown.shift(); // корневая папка («Конспекты») в подписи не нужна
  return { title, sub: shown.join(' · '), href: `${/\.pdf$/i.test(path) ? '#/view/' : '#/note/'}${enc(path)}` };
}
function searchText(index, terms, phrase) {
  const scored = [];
  for (const section of index.sections) {
    const heading = section._h ??= norm(section.h), text = section._t ??= norm(section.t);
    let score = 0, first = -1;
    for (const term of terms) {
      const inHeading = heading.includes(term);
      let at = text.indexOf(term), count = 0;
      if (at < 0 && !inHeading) { score = -1; break; }
      for (; at >= 0 && count < 10; at = text.indexOf(term, at + term.length)) { if (first < 0 || at < first) first = at; count++; }
      score += count + (inHeading ? 15 : 0);
    }
    if (score < 0) continue;
    if (terms.length > 1 && text.includes(phrase)) score += 20;
    scored.push({ section, score, first });
  }
  scored.sort((a, b) => b.score - a.score);
  const perFile = new Map(), picked = [];
  for (const hit of scored) {
    const used = perFile.get(hit.section.f) || 0;
    if (used >= 2) continue;
    perFile.set(hit.section.f, used + 1); picked.push(hit);
    if (picked.length >= 8) break;
  }
  return picked;
}
function snippetOf(text, from, terms) {
  let start = Math.max(0, (from < 0 ? 0 : from) - 60);
  if (start > 0) { const space = text.indexOf(' ', start); if (space >= 0 && space < from) start = space + 1; }
  const end = Math.min(text.length, start + 180);
  return `${start > 0 ? '…' : ''}${highlightAll(text.slice(start, end), terms)}${end < text.length ? '…' : ''}`;
}

export function mountSiteSearch(root) {
  root.innerHTML = `<label class="ss-box">${ICON_SEARCH}<input class="ss-input" type="search" placeholder="Поиск по сайту" aria-label="Поиск по сайту" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="false" aria-controls="ss-list"><kbd aria-hidden="true">/</kbd></label><div class="ss-results" id="ss-list" role="listbox" hidden></div>`;
  const input = root.querySelector('.ss-input'), list = root.querySelector('.ss-results');
  let entries = [], state = 'idle', textState = 'idle', textIndex = null, selected = -1;

  const ensure = () => {
    if (state === 'idle') {
      state = 'loading';
      loadLectures().then(index => { entries = buildEntries(index); state = 'ready'; }).catch(() => { entries = buildEntries(null); state = 'failed'; }).finally(update);
    }
    if (textState === 'idle') {
      textState = 'loading';
      loadTextIndex().then(index => { textIndex = index; textState = 'ready'; }).catch(() => { textState = 'failed'; }).finally(update);
    }
  };
  const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); selected = -1; };
    const place = () => {
      if (!matchMedia('(max-width: 760px)').matches) { list.style.left = list.style.width = ''; return; }
      const rect = root.getBoundingClientRect();
      list.style.left = `${12 - rect.left}px`; list.style.width = `${innerWidth - 24}px`;
    };
  function search(query, limit) {
    const terms = norm(query).split(/\s+/).filter(Boolean), scored = [];
    for (const entry of entries) {
      const title = entry._t ||= norm(entry.title), sub = entry._s ||= norm(entry.sub);
      let score = 0, ok = true;
      for (const term of terms) {
        const at = title.indexOf(term);
        if (at >= 0) score += at === 0 ? 30 : 20; else if (sub.includes(term)) score += 5; else { ok = false; break; }
      }
      if (!ok) continue;
      score += { page: 6, lecture: 4, h: -8 }[entry.kind] || 0;
      scored.push([score, entry]);
    }
    return { terms, results: scored.sort((a, b) => b[0] - a[0]).slice(0, limit).map(pair => pair[1]) };
  }
  const titleItem = (r, terms) => `<a class="ss-item" role="option" href="${r.href}"${r.jump ? ` data-jump="${esc(r.jump)}"` : ''}><span class="ss-kind">${KIND_LABEL[r.kind]}</span><span class="ss-text"><strong>${highlight(r.title, terms)}</strong><small>${esc(r.sub)}</small></span></a>`;
  function textItem({ section, first }, terms) {
    const info = fileInfo(textIndex.files[section.f]);
    const heading = section.h ? ` › ${section.h}` : '';
    return `<a class="ss-item" role="option" href="${info.href}"${section.h && !section.p ? ` data-jump="${esc(section.h)}"` : ''}><span class="ss-kind">${section.p ? 'PDF' : '¶'}</span><span class="ss-text"><strong>${highlightAll(info.title + heading, terms)}</strong><small>${info.sub ? `${esc(info.sub)} · ` : ''}${snippetOf(section.t, first, terms)}</small></span></a>`;
  }
  function update() {
    const query = input.value.trim();
    if (!query) return close();
    const { terms, results } = search(query, 8);
    const phrase = norm(query).replace(/\s+/g, ' ');
    const hits = textState === 'ready' && query.length >= 2 ? searchText(textIndex, terms, phrase) : [];
    place();
    list.hidden = false; input.setAttribute('aria-expanded', 'true'); selected = -1;
    const notes = [
      state === 'loading' ? 'Загружаем индекс лекций…' : state === 'failed' ? 'Индекс лекций недоступен — ищем только по разделам сайта.' : '',
      textState === 'loading' ? 'Загружаем индекс текста…' : textState === 'failed' ? 'Поиск по тексту конспектов недоступен.' : '',
    ].filter(Boolean).map(text => `<p class="ss-note">${text}</p>`).join('');
    const body = results.map(r => titleItem(r, terms)).join('')
      + (hits.length ? `${results.length ? '<p class="ss-note">В тексте конспектов</p>' : ''}${hits.map(hit => textItem(hit, terms)).join('')}` : '');
    list.innerHTML = notes + (body || '<p class="ss-empty">Ничего не найдено. Попробуйте другое слово или часть названия.</p>');
  }
  const move = step => {
    const links = [...list.querySelectorAll('.ss-item')]; if (!links.length) return;
    selected = (selected + step + links.length) % links.length;
    links.forEach((a, i) => a.classList.toggle('is-sel', i === selected));
    links[selected].scrollIntoView({ block: 'nearest' });
  };

  input.addEventListener('focus', () => { ensure(); update(); });
  input.addEventListener('input', () => { ensure(); update(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') { const a = list.querySelector('.ss-item.is-sel') || list.querySelector('.ss-item'); if (a) { e.preventDefault(); a.click(); } }
    else if (e.key === 'Escape') { close(); input.blur(); }
  });
  list.addEventListener('click', e => {
    const a = e.target.closest('.ss-item'); if (!a) return;
    try { if (a.dataset.jump) sessionStorage.setItem(JUMP_KEY, a.dataset.jump); else sessionStorage.removeItem(JUMP_KEY); } catch { /* приватный режим */ }
    const href = a.getAttribute('href');
    close(); input.value = ''; input.blur();
    if (location.hash === href) setTimeout(() => window.dispatchEvent(new Event('hashchange')), 0);
  });
  document.addEventListener('pointerdown', e => { if (!root.contains(e.target)) close(); });
  window.addEventListener('resize', () => { if (!list.hidden) place(); });
  document.addEventListener('keydown', e => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
    if ((e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) { e.preventDefault(); input.focus(); input.select(); }
  });
}
