/*
  Service worker сайта М3102.
  - Оболочка сайта (HTML, JS, CSS, картинки): сначала сеть, при её отсутствии — кэш.
    Поэтому обновления сайта доходят сразу, а офлайн приложение всё равно открывается.
  - Библиотеки с cdnjs (версии зафиксированы в URL): сначала кэш.
  - Конспекты и картинки из raw.githubusercontent.com, а также индексы лекций и поиска:
    сначала сеть, при её отсутствии — последняя просмотренная копия (кэш CONTENT).
    PDF не кэшируются (они грузятся по частям).
  - Всё остальное (data/schedule.json, data/homework.json, Дедлайны/*.json, GitHub API)
    не перехватывается: у сайта свои механизмы кэша и пометка «показана сохранённая версия».
  При изменении списка SHELL или после крупных правок можно поднять номер в CACHE.
*/
const CACHE = 'm3102-shell-v3';
const CONTENT = 'm3102-content-v1'; // не начинается с m3102-shell-, поэтому activate его не удаляет
const SHELL = [
  './', './index.html', './site.css', './manifest.webmanifest',
  './css/schedule.css', './css/homework.css', './css/diagrams.css', './css/memes.css', './css/deadlines.css',
  './css/lectures.css', './css/browse.css', './css/links.css', './css/quiz.css',
  './js/schedule.js', './js/schedule-ui.js', './js/schedule-editor.js', './js/github.js',
  './js/homework.js', './js/homework-text.js', './js/greetings.js', './js/memes.js', './js/links.js',
  './js/quiz.js', './js/lectures.js',
  './js/diagrams/index.js', './js/diagrams/expression.js', './js/diagrams/array-code.js',
  './js/diagrams/array-player.js', './js/diagrams/editor.js',
  './img/logo.png', './img/logo-t.png',
  './img/icons/icon-192.png', './img/icons/icon-512.png', './img/icons/apple-touch-icon.png',
  './css/shell.css', './js/icons.js',
];
const CDN = 'cdnjs.cloudflare.com';
const RAW = 'raw.githubusercontent.com';
const OFFLINE_DATA = ['data/lectures.json', 'data/display-names.json', 'data/search-index.json', 'data/old-paths.json'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Файлы кладём по одному: если какого-то нет, установка всё равно проходит
    await Promise.all(SHELL.map(url => cache.add(new Request(url, { cache: 'reload' })).catch(() => {})));
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

const cacheable = response => response && (response.ok || response.type === 'opaque');

async function networkFirst(request, fallbackKey) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (cacheable(response) && response.type === 'basic') cache.put(request, response.clone());
    return response;
  } catch (error) {
    const hit = await cache.match(request, { ignoreSearch: true }) || (fallbackKey && await cache.match(fallbackKey));
    if (hit) return hit;
    throw error;
  }
}

// Свежая копия из сети; без сети — последняя сохранённая в указанном кэше
async function networkFirstIn(cacheName, request) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (cacheable(response)) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (cacheable(response)) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.hostname === CDN) return event.respondWith(cacheFirst(request));
  // Конспекты и их картинки: онлайн — свежие, офлайн — последняя просмотренная копия
  if (url.hostname === RAW) {
    if (request.headers.has('range') || /\.pdf$/i.test(url.pathname)) return;
    return event.respondWith(networkFirstIn(CONTENT, request));
  }
  if (url.origin !== self.location.origin) return;
  const scope = new URL(self.registration.scope).pathname;
  const path = decodeURIComponent(url.pathname.slice(scope.length));
  if (OFFLINE_DATA.includes(path)) return event.respondWith(networkFirstIn(CONTENT, request));
  if (path.startsWith('data/') || path.startsWith('Дедлайны/')) return;
  if (request.mode === 'navigate') return event.respondWith(networkFirst(request, './index.html'));
  event.respondWith(networkFirst(request));
});
