// Импорт классического сайта группы (RedstoneLord/itmo-m3102, ветка master) в public/classic — копия только для показа рядом с нашим
// сайтом и переключателя стиля. Их репозиторий не меняем: берём файлы сайта (без конспектов и записей
// лекций), правим только копию (src/lib/classicPatch.ts). Список файлов — один запрос к GitHub API, сами файлы — с
// raw.githubusercontent.com (без git: на Windows он ломает кириллицу в путях). Запускается в CI перед сборкой
// (npm run classic) и вручную для dev. Нет сети или лимит API — предупреждение и выход без ошибки: кнопка сама скроется.
import { cpSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { patchClassicIndex } from '../src/lib/classicPatch';

const REPO = 'RedstoneLord/itmo-m3102';
// Его сайт читает data/ и Дедлайны/ по относительным путям, остальное (конспекты, PDF) — с raw.githubusercontent.com
const FOLDERS = ['css', 'js', 'img', 'data', 'Дедлайны'];
const FILES = ['index.html', 'site.css'];
const OUT = fileURLToPath(new URL('../public/classic', import.meta.url));
const PARALLEL = 8;

const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/');

async function listFiles(): Promise<{ sha: string; paths: string[] }> {
  const token = process.env.GITHUB_TOKEN;
  const response = await fetch(`https://api.github.com/repos/${REPO}/git/trees/master?recursive=1`, {
    headers: { Accept: 'application/vnd.github+json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!response.ok)
    throw new Error(`GitHub API ${response.status}${response.status === 403 ? ' (лимит запросов — подождите или задайте GITHUB_TOKEN)' : ''}`);
  const tree = (await response.json()) as { sha: string; truncated: boolean; tree: { path: string; type: string }[] };
  if (tree.truncated) throw new Error('дерево файлов обрезано GitHub — слишком большой репозиторий');
  const paths = tree.tree
    .filter((item) => item.type === 'blob' && (FILES.includes(item.path) || FOLDERS.some((folder) => item.path.startsWith(`${folder}/`))))
    .map((item) => item.path);
  if (!paths.includes('index.html')) throw new Error('в репозитории группы нет index.html — структура изменилась');
  return { sha: tree.sha, paths };
}

async function download(path: string): Promise<Buffer> {
  const response = await fetch(`https://raw.githubusercontent.com/${REPO}/master/${encodePath(path)}`);
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

try {
  const { sha, paths } = await listFiles();
  // Качаем во временную папку и подменяем целиком в конце: сорвалась сеть на середине — старая копия остаётся нетронутой
  const staging = `${OUT}.tmp`;
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(staging, { recursive: true });
  for (let i = 0; i < paths.length; i += PARALLEL) {
    await Promise.all(
      paths.slice(i, i + PARALLEL).map(async (path) => {
        let data = await download(path);
        if (path === 'index.html') data = Buffer.from(patchClassicIndex(data.toString('utf8')));
        mkdirSync(dirname(join(staging, path)), { recursive: true });
        writeFileSync(join(staging, path), data);
      }),
    );
  }
  writeFileSync(join(staging, 'imported.txt'), `${REPO} master (дерево ${sha})\n${new Date().toISOString()}\n`);
  rmSync(OUT, { recursive: true, force: true });
  try {
    renameSync(staging, OUT);
  } catch {
    // Windows не отдаёт папку под переименование, пока за ней следит dev-сервер (Vite) — тогда копируем
    cpSync(staging, OUT, { recursive: true });
    rmSync(staging, { recursive: true, force: true, maxRetries: 3 });
  }
  console.log(`Классический сайт импортирован в public/classic: ${paths.length} файлов, дерево ${sha.slice(0, 7)}`);
} catch (error) {
  console.warn('Классический сайт не импортирован:', error instanceof Error ? error.message : error);
  rmSync(`${OUT}.tmp`, { recursive: true, force: true });
}
