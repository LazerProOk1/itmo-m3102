// Переименовывает файлы И папки, в именах которых есть пробелы, запятые или точки.
// У файлов расширение сохраняется. Корневые папки (ROOTS) не трогаются.
//
// Пишет:
//   data/display-names.json — «новый путь» -> «оригинальное имя» (для красивого отображения на сайте)
//   data/old-paths.json     — «старый путь» -> «новый путь»      (чтобы старые ссылки продолжали работать)
// Также правит относительные ссылки и картинки в .md.
//
// Запуск из корня репозитория:  node tools/normalize-names.mjs [--dry]
import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOTS = ['Конспекты', 'Записи лекций', 'Лабораторные', 'Материалы'];
const NAMES_FILE = 'data/display-names.json';
const MOVED_FILE = 'data/old-paths.json';
const DRY = process.argv.includes('--dry');

const P = path.posix;
const nfc = value => String(value).normalize('NFC');
const depth = p => p.split('/').length;
const readJson = file => fs.readFile(file, 'utf8').then(JSON.parse, () => ({}));
const slug = stem => nfc(stem).replace(/[\s,.]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '') || 'file';
const enc = p => p.split('/').map(seg => encodeURIComponent(seg).replace(/[()]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)).join('/');
const needsRename = (base, isDir) => {
  const ext = isDir ? '' : P.extname(base);
  return /[\s,.]/.test(base.slice(0, base.length - ext.length));
};

async function walk(dir, out) {
  let list;
  try { list = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of list) {
    if (entry.name.startsWith('.')) continue; // .DS_Store, .gitkeep и т.п.
    const p = `${dir}/${entry.name}`;
    out.push({ path: p, isDir: entry.isDirectory() });
    if (entry.isDirectory()) await walk(p, out);
  }
}

/* ---------- 1. План (диск ещё не трогаем) ---------- */
const entries = [];
for (const root of ROOTS) await walk(root, entries);

const newPath = new Map(ROOTS.map(root => [root, root])); // старый путь -> новый путь
const newBase = new Map();                                 // старый путь -> новое имя
const groups = new Map();
for (const entry of entries) {
  const parent = P.dirname(entry.path);
  if (!groups.has(parent)) groups.set(parent, []);
  groups.get(parent).push(entry);
}
// Родители обрабатываются раньше детей, поэтому новый путь родителя уже известен
for (const parent of [...groups.keys()].sort((a, b) => depth(a) - depth(b))) {
  const group = groups.get(parent).sort((a, b) => a.path.localeCompare(b.path, 'ru'));
  const targetParent = newPath.get(parent);
  const taken = new Set(group.filter(e => !needsRename(P.basename(e.path), e.isDir)).map(e => nfc(P.basename(e.path)).toLowerCase()));
  for (const entry of group) {
    const base = P.basename(entry.path);
    let name = base;
    if (needsRename(base, entry.isDir)) {
      const ext = entry.isDir ? '' : P.extname(base), stem = slug(base.slice(0, base.length - ext.length));
      name = `${stem}${ext}`;
      for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${stem}_${n}${ext}`;
      taken.add(name.toLowerCase());
    }
    newBase.set(entry.path, name);
    newPath.set(entry.path, `${targetParent}/${name}`);
  }
}
const renamedHere = entries.filter(e => newBase.get(e.path) !== P.basename(e.path));
const moved = entries.filter(e => newPath.get(e.path) !== e.path);

if (DRY) {
  for (const e of renamedHere) console.log(`${e.isDir ? '[папка]' : '[файл] '} ${e.path}  ->  ${newBase.get(e.path)}`);
  console.log(`\nЧто будет переименовано: ${renamedHere.length} (затронуто путей: ${moved.length}). Диск не изменён.`);
  process.exit(0);
}

/* ---------- 2. Переименование: сначала файлы, затем папки от самых глубоких ---------- */
const order = [...renamedHere].sort((a, b) => (Number(a.isDir) - Number(b.isDir)) || (depth(b.path) - depth(a.path)));
for (const entry of order) await fs.rename(entry.path, `${P.dirname(entry.path)}/${newBase.get(entry.path)}`);

/* ---------- 3. Ссылки и картинки в .md ---------- */
const current = new Map(entries.map(e => [nfc(e.path), e.path]));
let rewritten = 0;
for (const entry of entries.filter(e => !e.isDir && /\.md$/i.test(e.path))) {
  const oldDir = P.dirname(entry.path), newFile = newPath.get(entry.path), newDir = P.dirname(newFile);
  const text = await fs.readFile(newFile, 'utf8');
  // [текст](цель) и ![alt](цель), в т.ч. с <…> и с "title"
  const updated = text.replace(/(\]\()(<[^>]+>|[^)\s]+)((?:\s+"[^"]*")?\))/g, (whole, open, raw, close) => {
    const inner = raw.startsWith('<') ? raw.slice(1, -1) : raw;
    if (/^[a-z][a-z0-9+.-]*:|^\/\/|^#/i.test(inner)) return whole;
    const cut = inner.search(/[#?]/), target = cut < 0 ? inner : inner.slice(0, cut), tail = cut < 0 ? '' : inner.slice(cut);
    let decoded;
    try { decoded = decodeURIComponent(target); } catch { return whole; }
    if (!decoded) return whole;
    // Ссылка написана относительно СТАРОГО расположения файла
    const oldTarget = P.normalize(P.join(oldDir, decoded));
    const movedTo = newPath.get(current.get(nfc(oldTarget)) ?? oldTarget) ?? oldTarget;
    const rel = P.relative(newDir, movedTo);
    if (rel === P.normalize(decoded)) return whole;
    return `${open}${enc(rel)}${tail}${close}`;
  });
  if (updated !== text) { await fs.writeFile(newFile, updated); rewritten++; }
}

/* ---------- 4. display-names.json ---------- */
const names = await readJson(NAMES_FILE), nextNames = {};
for (const [key, value] of Object.entries(names)) {
  const actual = current.get(nfc(key));
  if (actual) nextNames[nfc(newPath.get(actual))] = value; // путь мог измениться из-за переименования родительской папки
}
for (const entry of renamedHere) nextNames[nfc(newPath.get(entry.path))] ??= P.basename(entry.path);

/* ---------- 5. old-paths.json ---------- */
const oldMoved = await readJson(MOVED_FILE), nextMoved = {};
for (const [from, to] of Object.entries(oldMoved)) {
  const actual = current.get(nfc(to));
  if (actual) nextMoved[nfc(from)] = newPath.get(actual); // цепочки a -> b -> c схлопываются в a -> c
}
for (const entry of moved) nextMoved[nfc(entry.path)] = newPath.get(entry.path);
for (const key of Object.keys(nextMoved)) if (nextMoved[key] === key) delete nextMoved[key];

const dump = object => JSON.stringify(Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b, 'ru'))), null, 2) + '\n';
await fs.mkdir('data', { recursive: true });
await fs.writeFile(NAMES_FILE, dump(nextNames));
await fs.writeFile(MOVED_FILE, dump(nextMoved));
console.log(`Переименовано: ${renamedHere.length} (затронуто путей: ${moved.length}). Обновлено .md-файлов со ссылками: ${rewritten}.`);
