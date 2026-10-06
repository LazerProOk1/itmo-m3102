/*
 * Офлайн-режим: сайт открывается без сети (метро, аудитория без Wi-Fi).
 * - Страница — сначала сеть (свежая версия после деплоя), без сети — из кеша.
 * - Файлы сборки (assets/ с хешем в имени), шрифты, иконки — из кеша, иначе сеть. При установке в кеш
 *   кладутся все страницы (~0,8 МБ по сети); после следующих деплоев — по ходу, при докачке в простое (App.tsx).
 * - PDF и картинки конспектов с GitHub — из кеша, а в фоне обновляются (stale-while-revalidate).
 * - «Работа без интернета» (src/services/offline.ts) кладёт PDF и картинки группы в свой кеш OFFLINE заранее —
 *   по адресу raw.githubusercontent; конспекты открывают те же файлы через GitHub Pages, поэтому при промахе
 *   ищем и под вторым адресом. Кеш OFFLINE обновление сайта не удаляет.
 * - Тексты конспектов, расписание, ДЗ и так лежат в localStorage — их SW не трогает.
 * ponytail: старые файлы сборки копятся в кеше; если разрастётся — сменить CACHE на новую версию.
 */
// Сменили файлы с постоянными именами (иконки) — поднять версию: старый кеш удалится при активации
const CACHE = 'm3102-v5';
// Vary: Origin у сервера: скрипт с crossorigin и тот же файл из addAll иначе считаются разными записями
const MATCH = { ignoreVary: true };
const OFFLINE = 'm3102-offline';
const PDF_HOSTS = ['raw.githubusercontent.com', 'redstonelord.github.io'];
const FILES = /\.(pdf|png|jpe?g|gif|webp|svg)$/i;
const RAW = 'https://raw.githubusercontent.com/RedstoneLord/itmo-m3102/master/';
const PAGES = 'https://redstonelord.github.io/itmo-m3102/';

/** Тот же файл группы под другим адресом: raw ↔ GitHub Pages */
const twin = (url) => (url.startsWith(RAW) ? PAGES + url.slice(RAW.length) : url.startsWith(PAGES) ? RAW + url.slice(PAGES.length) : null);
const findFile = async (request) => {
  const hit = await caches.match(request, MATCH);
  const other = hit ? null : twin(request.url);
  return hit || (other && (await caches.match(other, MATCH)));
};

/** Файлы оболочки и всех страниц по манифесту сборки (vite.config.ts); pdf.js и mermaid — при первом использовании */
async function shellFiles() {
  const manifest = await fetch('./asset-manifest.json').then((response) => response.json());
  const files = new Set(['./', './manifest.webmanifest', './favicon.png', './icon-192.png']);
  const seen = new Set();
  const visit = (key) => {
    const chunk = manifest[key];
    if (!chunk || seen.has(key)) return;
    seen.add(key);
    files.add('./' + chunk.file);
    for (const css of chunk.css ?? []) files.add('./' + css);
    for (const asset of chunk.assets ?? []) if (asset.endsWith('.woff2')) files.add('./' + asset);
    for (const imported of chunk.imports ?? []) visit(imported);
  };
  for (const [key, chunk] of Object.entries(manifest))
    if (chunk.isEntry || (chunk.isDynamicEntry && key.startsWith('src/') && !key.includes('PdfViewer'))) visit(key);
  return [...files];
}

// Первый визит грузится ещё без SW, и часть страниц докачивается раньше, чем он возьмёт управление, —
// поэтому весь сайт кладём в кеш при установке, а не по ходу
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(async (cache) => cache.addAll(await shellFiles()))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE && key !== OFFLINE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

const put = (request, response) => {
  if (response.ok) void caches.open(CACHE).then((cache) => cache.put(request, response));
  return response.clone();
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Копия классического сайта (/classic/, public/classic) — не наша: ни кеша, ни подмены страницы на нашу оболочку
  if (url.origin === self.location.origin && /\/classic(\/|$)/.test(url.pathname)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => put(request, response))
        .catch(() => caches.match(request, MATCH).then((hit) => hit || caches.match('./', MATCH))),
    );
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(caches.match(request, MATCH).then((hit) => hit || fetch(request).then((response) => put(request, response))));
    return;
  }

  if (PDF_HOSTS.includes(url.hostname) && FILES.test(url.pathname)) {
    event.respondWith(
      findFile(request).then((hit) => {
        // Без сети фоновое обновление просто не удаётся — отдаём сохранённый файл
        const fresh = fetch(request)
          .then((response) => put(request, response))
          .catch(() => hit || Response.error());
        return hit || fresh;
      }),
    );
  }
});
