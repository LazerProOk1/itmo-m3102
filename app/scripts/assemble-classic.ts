// Классический сайт группы лежит в корне репозитория ровно так, как в RedstoneLord/itmo-m3102 (index.html, css/, js/,
// data/…), — чтобы потом сливать без конфликтов. Для сайта его нужно положить рядом с нашим приложением, в /classic/:
//
//   npm run classic             корень репозитория → app/public/classic (там же правится index.html: classicPatch.ts)
//   npm run classic -- --fresh  то же + самые свежие data/ и Дедлайны/ с их репозитория (в CI — перед каждой сборкой)
//   npm run classic -- --pull   скачать файлы сайта с их репозитория (master) в корень — обновить закоммиченную копию
//
// Список файлов — один запрос к GitHub API, файлы — с raw.githubusercontent.com (без git: на Windows он ломает
// кириллицу в путях). Конспекты и записи лекций не берём: их сайт читает с GitHub. Нет сети или лимит API — предупреждение
// и выход без ошибки: остаётся то, что лежит в корне.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { patchClassicIndex } from '../src/lib/classicPatch';

const REPO = 'RedstoneLord/itmo-m3102';
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUT = fileURLToPath(new URL('../public/classic', import.meta.url));
// Что их сайт отдаёт посетителю (читает data/ и Дедлайны/ по относительным путям) и что ещё лежит у них рядом с сайтом
const SERVED_FILES = ['index.html', 'site.css'];
const SERVED_DIRS = ['css', 'js', 'img', 'data', 'Дедлайны'];
const DATA_DIRS = ['data', 'Дедлайны'];
const PULL_FILES = [...SERVED_FILES, 'manifest.webmanifest', 'sw.js', 'package.json'];
const PULL_DIRS = [...SERVED_DIRS, 'tests'];
const PARALLEL = 8;

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

function assemble(): void {
  // Папку может держать dev-сервер (Windows не даёт её удалить) — тогда просто перезаписываем файлы поверх
  try {
    rmSync(OUT, { recursive: true, force: true, maxRetries: 3 });
  } catch {
    /* перезапишем поверх */
  }
  mkdirSync(OUT, { recursive: true });
  for (const name of [...SERVED_FILES, ...SERVED_DIRS]) {
    if (existsSync(join(ROOT, name))) copyTree(join(ROOT, name), join(OUT, name));
  }
  writeFileSync(join(OUT, 'index.html'), patchClassicIndex(readFileSync(join(ROOT, 'index.html'), 'utf8')));
}

const mode = process.argv.includes('--pull') ? 'pull' : process.argv.includes('--fresh') ? 'fresh' : 'local';
try {
  if (mode === 'pull') {
    const { sha, paths } = await listUpstream(PULL_FILES, PULL_DIRS);
    await downloadAll(paths, ROOT);
    console.log(`Классический сайт обновлён в корне репозитория: ${paths.length} файлов, дерево ${sha.slice(0, 7)}`);
  } else {
    assemble();
    if (mode === 'fresh') {
      try {
        const { sha, paths } = await listUpstream([], DATA_DIRS);
        await downloadAll(paths, OUT);
        console.log(`Классический сайт собран в app/public/classic; данные свежие (дерево ${sha.slice(0, 7)})`);
      } catch (error) {
        console.warn('Свежие данные классического сайта не получены, остались закоммиченные:', error instanceof Error ? error.message : error);
      }
    } else {
      console.log('Классический сайт собран в app/public/classic из корня репозитория');
    }
  }
} catch (error) {
  console.warn('Классический сайт не обновлён:', error instanceof Error ? error.message : error);
}
