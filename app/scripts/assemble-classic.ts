// Классический сайт группы лежит в корне репозитория ровно так, как в RedstoneLord/itmo-m3102 (index.html, css/, js/,
// data/…), — чтобы потом объединять репозитории без конфликтов. Скрипт собирает из него то, что нужно сайту:
//
//   npm run classic             корень репозитория → app/public/classic (для dev: приложение на /, классический на /classic/)
//   npm run site                готовый сайт для Pages → app/site: классический в корне, приложение (app/dist) в /app/
//   … -- --fresh                к любому из них: самые свежие data/ и Дедлайны/ с их репозитория (в CI — всегда)
//   npm run classic -- --pull   скачать файлы сайта с их репозитория (master) в корень — обновить закоммиченную копию
//
// В собранной копии правится только index.html (classicPatch.ts) и подкладывается общий переключатель стиля
// (switch/site-switch.js). Список файлов — один запрос к GitHub API, файлы — с raw.githubusercontent.com (без git и без
// fs.cpSync: на Windows оба ломают кириллицу в путях). Конспекты и записи лекций не берём: оба сайта читают их с GitHub.
// Нет сети или лимит API — предупреждение и выход без ошибки: остаётся то, что лежит в корне.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { patchClassicIndex } from '../src/lib/classicPatch';

const REPO = 'RedstoneLord/itmo-m3102';
const APP = fileURLToPath(new URL('..', import.meta.url));
const ROOT = join(APP, '..');
// Что их сайт отдаёт посетителю (читает data/ и Дедлайны/ по относительным путям) и что ещё лежит у них рядом с сайтом
const SERVED_FILES = ['index.html', 'site.css'];
const SERVED_DIRS = ['css', 'js', 'img', 'data', 'Дедлайны'];
const DATA_DIRS = ['data', 'Дедлайны'];
const PULL_FILES = [...SERVED_FILES, 'manifest.webmanifest', 'sw.js', 'package.json'];
const PULL_DIRS = [...SERVED_DIRS, 'tests'];
const PARALLEL = 8;

/**
 * Старые посетители могли зарегистрировать сервис-воркер приложения на корне адреса (раньше приложение жило там).
 * Теперь в корне классический сайт, а воркер приложения — в /app/. Этот файл ложится на место старого sw.js, сам
 * удаляет старые кеши приложения (но не «Работу без интернета» — m3102-offline) и снимает регистрацию.
 */
const KILL_SWITCH = `// Снимает старую регистрацию приложения с корня адреса (приложение переехало в /app/).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (/^m3102-v\\d+$/.test(key)) await caches.delete(key);
      await self.registration.unregister();
      for (const client of await self.clients.matchAll({ type: 'window' })) client.navigate(client.url);
    })(),
  );
});
`;

const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/');
const inDirs = (path: string, dirs: string[]) => dirs.some((dir) => path.startsWith(`${dir}/`));

async function listUpstream(files: string[], dirs: string[]): Promise<{ sha: string; paths: string[] }> {
  // CLASSIC_TREE_JSON — готовый ответ API (gh api repos/…/git/trees/master?recursive=1 > файл): когда лимит анонимных
  // запросов (60 в час) уже выбран. В CI лимит выше — там идёт GITHUB_TOKEN самого запуска
  const token = process.env.GITHUB_TOKEN;
  const treeFile = process.env.CLASSIC_TREE_JSON;
  let body: string;
  if (treeFile) body = readFileSync(treeFile, 'utf8');
  else {
    const response = await fetch(`https://api.github.com/repos/${REPO}/git/trees/master?recursive=1`, {
      headers: { Accept: 'application/vnd.github+json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!response.ok)
      throw new Error(`GitHub API ${response.status}${response.status === 403 ? ' (лимит запросов — подождите или задайте CLASSIC_TREE_JSON)' : ''}`);
    body = await response.text();
  }
  const tree = JSON.parse(body) as { sha: string; truncated: boolean; tree: { path: string; type: string }[] };
  if (tree.truncated) throw new Error('дерево файлов обрезано GitHub — слишком большой репозиторий');
  const paths = tree.tree.filter((item) => item.type === 'blob' && (files.includes(item.path) || inDirs(item.path, dirs))).map((item) => item.path);
  if (files.includes('index.html') && !paths.includes('index.html')) throw new Error('в репозитории группы нет index.html — структура изменилась');
  return { sha: tree.sha, paths };
}

async function download(path: string): Promise<Buffer> {
  const response = await fetch(`https://raw.githubusercontent.com/${REPO}/master/${encodePath(path)}`);
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

/** Скачать пути в папку целиком или не скачать вовсе: сорвалась сеть на середине — на диске ничего не меняется */
async function downloadAll(paths: string[], into: string): Promise<void> {
  const loaded: [string, Buffer][] = [];
  for (let i = 0; i < paths.length; i += PARALLEL) {
    loaded.push(...(await Promise.all(paths.slice(i, i + PARALLEL).map(async (path): Promise<[string, Buffer]> => [path, await download(path)]))));
  }
  for (const [path, data] of loaded) {
    mkdirSync(dirname(join(into, path)), { recursive: true });
    writeFileSync(join(into, path), data);
  }
}

/** fs.cpSync в Node на Windows портит кириллицу в именах папок («Дедлайны») — копируем сами */
function copyTree(from: string, to: string): void {
  if (statSync(from).isDirectory()) {
    mkdirSync(to, { recursive: true });
    for (const name of readdirSync(from)) copyTree(join(from, name), join(to, name));
  } else {
    copyFileSync(from, to);
  }
}

/** Классический сайт из корня репозитория → папка `out`, с правкой index.html и переключателем стиля */
function assemble(out: string): void {
  // Папку может держать dev-сервер (Windows не даёт её удалить) — тогда просто перезаписываем файлы поверх
  try {
    rmSync(out, { recursive: true, force: true, maxRetries: 3 });
  } catch {
    /* перезапишем поверх */
  }
  mkdirSync(out, { recursive: true });
  for (const name of [...SERVED_FILES, ...SERVED_DIRS]) {
    if (existsSync(join(ROOT, name))) copyTree(join(ROOT, name), join(out, name));
  }
  copyTree(join(APP, 'public', 'switch'), join(out, 'switch'));
  writeFileSync(join(out, 'index.html'), patchClassicIndex(readFileSync(join(ROOT, 'index.html'), 'utf8')));
}

/** Готовый сайт: классический — в корне, приложение (уже собранное в app/dist) — в /app/ */
function assembleSite(out: string): void {
  const dist = join(APP, 'dist');
  if (!existsSync(join(dist, 'index.html'))) throw new Error('нет app/dist — сначала npm run build');
  assemble(out);
  copyTree(dist, join(out, 'app'));
  // dev-копия классического сайта (app/public/classic) попадает в dist вместе с public/ — в готовом сайте она лишняя
  rmSync(join(out, 'app', 'classic'), { recursive: true, force: true });
  writeFileSync(join(out, 'sw.js'), KILL_SWITCH);
  // Подписка на календарь живёт по старому адресу (в корне) — у подписчиков он уже прописан
  if (existsSync(join(dist, 'm3102.ics'))) copyFileSync(join(dist, 'm3102.ics'), join(out, 'm3102.ics'));
}

const siteMode = process.argv.includes('--site');
const mode = process.argv.includes('--pull') ? 'pull' : process.argv.includes('--fresh') ? 'fresh' : 'local';
const OUT = siteMode ? join(APP, 'site') : join(APP, 'public', 'classic');
try {
  if (mode === 'pull') {
    const { sha, paths } = await listUpstream(PULL_FILES, PULL_DIRS);
    await downloadAll(paths, ROOT);
    console.log(`Классический сайт обновлён в корне репозитория: ${paths.length} файлов, дерево ${sha.slice(0, 7)}`);
  } else {
    if (siteMode) assembleSite(OUT);
    else assemble(OUT);
    const where = siteMode ? 'app/site (классический в корне, приложение в /app/)' : 'app/public/classic';
    if (mode === 'fresh') {
      try {
        const { sha, paths } = await listUpstream([], DATA_DIRS);
        await downloadAll(paths, OUT);
        console.log(`Сайт собран в ${where}; данные свежие (дерево ${sha.slice(0, 7)})`);
      } catch (error) {
        console.warn('Свежие данные классического сайта не получены, остались закоммиченные:', error instanceof Error ? error.message : error);
      }
    } else {
      console.log(`Сайт собран в ${where} из корня репозитория`);
    }
  }
} catch (error) {
  console.warn('Классический сайт не обновлён:', error instanceof Error ? error.message : error);
}
