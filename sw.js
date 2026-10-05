/*
  Service worker сайта М3102: офлайн-режим.

  - Оболочка сайта (HTML, JS, CSS, картинки): сначала сеть, но не дольше TIMEOUT — потом копия из кэша.
    Обновления доходят сразу, а при плохой сети («Wi-Fi есть, интернета нет») сайт не зависает.
  - Библиотеки с cdnjs: сначала кэш. При установке их список берётся из index.html (вместе со шрифтами KaTeX),
    так что после первого запуска приложение открывается без сети целиком.
  - raw.githubusercontent.com (конспекты и их картинки): сеть → кэш CONTENT.
    PDF и Range-запросы не перехватываются (PDF грузятся по частям; офлайн их отдаёт страница из кэша, см. renderPdfView).
    Запросы с cache:'reload' тоже не перехватываются — так js/offline.js скачивает заведомо свежие файлы.
  - api.github.com: списки папок (/contents), коммиты и очереди (/issues) — сеть → кэш.
    Списки папок js/offline.js кладёт в кэш заранее, поэтому «Материалы» открываются без сети.
  - data/*.json для офлайна и Дедлайны/deadlines.json — сеть → кэш.
  - data/schedule.json и data/homework.json не перехватываются: у них свой кэш в localStorage
    и пометка «показана сохранённая версия».
  При изменении списка SHELL или после крупных правок можно поднять номер в CACHE.
*/
const CACHE = 'm3102-shell-v4';
const CONTENT = 'm3102-content-v1'; // не начинается с m3102-shell-, поэтому activate его не удаляет; то же имя в js/offline.js
const SHELL = [
  './', './index.html', './site.css', './manifest.webmanifest',
  './css/schedule.css', './css/homework.css', './css/diagrams.css', './css/memes.css', './css/deadlines.css',
  './css/lectures.css', './css/browse.css', './css/links.css', './css/quiz.css', './css/shell.css',
  './js/schedule.js', './js/schedule-ui.js', './js/schedule-editor.js', './js/github.js',
  './js/homework.js', './js/homework-text.js', './js/greetings.js', './js/memes.js', './js/links.js',
  './js/quiz.js', './js/lectures.js', './js/icons.js', './js/offline.js',
  './js/diagrams/index.js', './js/diagrams/expression.js', './js/diagrams/array-code.js',
  './js/diagrams/array-player.js', './js/diagrams/editor.js',
  './img/logo.png', './img/logo-t.png', './img/github.png',
  './img/icons/logo.png', './img/icons/logo-t.png',
  './img/icons/favicon-32.png', './img/icons/favicon-48.png',
  './img/icons/icon-192.png', './img/icons/icon-512.png', './img/icons/apple-touch-icon.png',
  './img/icons/icon-maskable-192.png', './img/icons/icon-maskable-512.png',
];
const CDN = 'cdnjs.cloudflare.com';
const RAW = 'raw.githubusercontent.com';
const API = 'api.github.com';
const REPO_API = '/repos/RedstoneLord/itmo-m3102/';
const OFFLINE_DATA = [
  'data/lectures.json', 'data/display-names.json', 'data/search-index.json', 'data/old-paths.json',
  'data/links.json', 'data/memes.json', 'Дедлайны/deadlines.json',
];
const TIMEOUT = 6000; // сколько ждать сеть, если в кэше есть копия

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Файлы кладём по одному: если какого-то нет, установка всё равно проходит
    await Promise.all(SHELL.map(url => cache.add(new Request(url, { cache: 'reload' })).catch(() => {})));
    await precacheCdn(cache);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('m3102-shell-') && name !== CACHE).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

// Все ссылки на cdnjs из index.html (скрипты, стили, pdf.worker) + woff2-шрифты из KaTeX-стилей
async function precacheCdn(cache) {
  try {
    const page = await cache.match('./index.html');
    if (!page) return;
    const html = await page.text();
    const urls = [...new Set(html.match(/https:\/\/cdnjs\.cloudflare\.com\/[^"'\s)<>]+/g) || [])];
    const add = url => cache.add(new Request(url, { cache: 'reload' })).catch(() => {});
    await Promise.all(urls.map(add));
    const fonts = new Set();
    for (const css of urls.filter(url => /\.css$/.test(url))) {
      const hit = await cache.match(css);
      const text = hit ? await hit.text() : '';
      for (const m of text.matchAll(/url\(\s*["']?(fonts\/[^)"']+?\.woff2)["']?\s*\)/g)) fonts.add(new URL(m[1], css).href);
    }
    await Promise.all([...fonts].map(add));
  } catch { /* без сети установка всё равно должна пройти */ }
}

/*
  Общая схема «сеть, а при сбое или таймауте — кэш».
  store кладёт ответ в кэш (не ждём), lookup ищет запасной ответ.
  serveBad: считать плохими и ответы вроде 403 (лимит GitHub API) — тогда тоже отдаём кэш, если он есть.
*/
async function respond(cache, request, { fetcher = () => fetch(request), lookup, store, timeout = 0, serveBad = false }) {
  const network = fetcher().then(response => {
    try { Promise.resolve(store(cache, request, response)).catch(() => {}); } catch { /* не вышло сохранить — не страшно */ }
    return response;
  });
  network.catch(() => {}); // если уже ответили из кэша, отказ сети никого не интересует
  let response = null, failure = null, timer;
  try {
    response = timeout
      ? await Promise.race([network, new Promise(resolve => { timer = setTimeout(resolve, timeout, null); })])
      : await network;
  } catch (error) { failure = error; } finally { clearTimeout(timer); }
  if (response && (response.ok || !serveBad)) return response;
  const hit = await lookup();
  if (hit) return hit;
  if (response) return response;
  if (failure) throw failure;
  return network; // таймаут, а в кэше пусто — продолжаем ждать сеть
}

const putOk = (cache, request, response) => response.status === 200 ? cache.put(request.url, response.clone()) : undefined;
// В кэш попадают только списки папок (массивы); ответы по одному файлу — нет, чтобы не подсовывать устаревший sha при сохранении
async function putListing(cache, request, response) {
  if (response.status !== 200) return;
  const copy = response.clone(), probe = response.clone();
  if (Array.isArray(await probe.json())) await cache.put(request.url, copy);
}

async function shell(request) {
  const cache = await caches.open(CACHE);
  const fallback = request.mode === 'navigate' ? './index.html' : '';
  return respond(cache, request, {
    timeout: TIMEOUT,
    lookup: async () => (await cache.match(request, { ignoreSearch: true })) || (fallback ? await cache.match(fallback) : undefined),
    store: (c, req, res) => res.status === 200 && res.type === 'basic' ? c.put(req, res.clone()) : undefined,
  });
}

async function content(request, { store = putOk, serveBad = false } = {}) {
  const cache = await caches.open(CONTENT);
  // <img> запрашивает без CORS и получил бы «непрозрачный» ответ: его нельзя проверить, а в квоте он учитывается с большим запасом.
  // raw.githubusercontent.com отдаёт CORS-заголовки, поэтому для картинок просим обычный ответ
  const plain = request.mode === 'no-cors' && new URL(request.url).hostname === RAW;
  return respond(cache, request, {
    fetcher: () => plain ? fetch(new Request(request.url, { mode: 'cors', credentials: 'omit' })).catch(() => fetch(request)) : fetch(request),
    lookup: () => cache.match(request.url, { ignoreVary: true }),
    store, serveBad, timeout: TIMEOUT,
  });
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response && (response.status === 200 || response.type === 'opaque')) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.hostname === CDN) return event.respondWith(cacheFirst(request));
  if (url.hostname === RAW) {
    if (request.headers.has('range') || /\.pdf$/i.test(url.pathname) || request.cache === 'reload') return;
    return event.respondWith(content(request));
  }
  if (url.hostname === API && url.pathname.startsWith(REPO_API)) {
    const rest = url.pathname.slice(REPO_API.length);
    if (rest.startsWith('contents')) return event.respondWith(content(request, { store: putListing, serveBad: true }));
    if (rest.startsWith('commits') || rest.startsWith('issues')) return event.respondWith(content(request, { serveBad: true }));
    return;
  }
  if (url.origin !== self.location.origin) return;
  const scope = new URL(self.registration.scope).pathname;
  let path;
  try { path = decodeURIComponent(url.pathname.slice(scope.length)); } catch { return; }
  if (OFFLINE_DATA.includes(path)) return event.respondWith(content(request));
  if (path.startsWith('data/') || path.startsWith('Дедлайны/')) return;
  event.respondWith(shell(request));
});
