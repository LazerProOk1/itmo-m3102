// Переименовывает файлы с пробелами, запятыми и точками в имени (расширение сохраняется),
// записывает оригинальные имена в data/display-names.json и чинит относительные ссылки в .md.
// Запуск из корня репозитория: node scripts/normalize-names.mjs
import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOTS = ['Конспекты', 'Записи лекций', 'Лабораторные', 'Материалы'];
const MAP_FILE = 'data/display-names.json';
const toPosix = p => p.split(path.sep).join('/');
const slug = stem => stem.normalize('NFC').replace(/[\s,.]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'file';
const enc = p => p.split('/').map(encodeURIComponent).join('/');
const exists = p => fs.access(p).then(() => true, () => false);

async function walk(dir, out = []) {
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) await walk(full, out); else out.push(toPosix(full));
  }
  return out;
}
const listAll = async () => (await Promise.all(ROOTS.map(r => walk(r)))).flat();

const map = await fs.readFile(MAP_FILE, 'utf8').then(JSON.parse, () => ({}));
const renames = new Map(); // старый путь -> новый путь

for (const file of await listAll()) {
  const dir = path.posix.dirname(file), ext = path.posix.extname(file), base = path.posix.basename(file);
  const stem = base.slice(0, base.length - ext.length);
  if (!/[\s,.]/.test(stem)) continue;
  let next = `${slug(stem)}${ext}`, n = 2;
  while (renames.has(`${dir}/${next}`) || (await exists(`${dir}/${next}`))) next = `${slug(stem)}_${n++}${ext}`;
  const target = `${dir}/${next}`;
  await fs.rename(file, target);
  renames.set(file, target);
  map[target] = map[file] || base; // сохраняем самое первое (оригинальное) имя
  delete map[file];
}

// Обновляем относительные ссылки и картинки в .md
if (renames.size) {
  for (const file of (await listAll()).filter(f => /\.md$/i.test(f))) {
    const text = await fs.readFile(file, 'utf8'), dir = path.posix.dirname(file);
    const updated = text.replace(/(\]\()(<[^>]+>|[^)\s]+)(\))/g, (whole, open, raw, close) => {
      const inner = raw.replace(/^<|>$/g, '');
      if (/^[a-z][a-z0-9+.-]*:|^\/\/|^#/i.test(inner)) return whole;
      const [target, hash = ''] = inner.split(/(?=#)/);
      let decoded;
      try { decoded = decodeURIComponent(target); } catch { return whole; }
      const old = path.posix.normalize(path.posix.join(dir, decoded));
      const moved = renames.get(old);
      if (!moved) return whole;
      return `${open}${enc(path.posix.relative(dir, moved))}${hash}${close}`;
    });
    if (updated !== text) await fs.writeFile(file, updated);
  }
}

// Чистим записи о файлах, которых больше нет
for (const key of Object.keys(map)) if (!(await exists(key))) delete map[key];
await fs.mkdir('data', { recursive: true });
await fs.writeFile(MAP_FILE, JSON.stringify(Object.fromEntries(Object.entries(map).sort()), null, 2) + '\n');
console.log(`Переименовано файлов: ${renames.size}`);
