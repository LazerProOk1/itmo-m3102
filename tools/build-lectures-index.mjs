#!/usr/bin/env node
/*
  Собирает data/lectures.json из папки «Конспекты».

  Структура:  Конспекты/<Предмет>/<Лекция>/<файлы .md и .pdf>

  Главный файл лекции:
    1) файл с «main: true» в front-matter (первым в файле):
         ---
         main: true
         title: Необязательное отображаемое название
         ---
    2) если такого нет — первый по алфавиту (с учётом чисел: 2 идёт раньше 10).

  Запуск:   node tools/build-lectures-index.mjs
  Проверка: node tools/build-lectures-index.mjs --check   (код 1, если индекс устарел)
*/
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = 'Конспекты', OUTPUT = 'data/lectures.json';
const SKIP_DIRS = new Set(['img', 'images', 'assets', 'node_modules']);
const collator = new Intl.Collator('ru', { numeric: true, sensitivity: 'base' });
const byName = (a, b) => collator.compare(a, b);
const isDoc = name => /\.(md|pdf)$/i.test(name);
const notes = [];

async function entries(rel) {
  const list = await readdir(join(ROOT, rel), { withFileTypes: true }).catch(() => []);
  return list.filter(e => !e.name.startsWith('.')).sort((a, b) => byName(a.name, b.name));
}
async function collectFiles(rel) {
  const out = [];
  for (const e of await entries(rel)) {
    const path = `${rel}/${e.name}`;
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name.toLowerCase())) out.push(...await collectFiles(path)); }
    else if (isDoc(e.name)) out.push(path);
  }
  return out;
}
function splitFrontMatter(text) {
  const m = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  if (!m) return { meta: {}, body: text };
  const lines = m[1].split(/\r?\n/).filter(line => line.trim());
  if (!lines.length || !lines.every(line => /^[\w.-]+\s*:/.test(line.trim()))) return { meta: {}, body: text };
  const meta = {};
  for (const line of lines) { const i = line.indexOf(':'); meta[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, ''); }
  return { meta, body: text.slice(m[0].length) };
}
function headingsOf(body) {
  const text = body.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\1[ \t]*$/gm, '');
  const out = [];
  for (const m of text.matchAll(/^#{1,6}[ \t]+(.+?)[ \t#]*$/gm)) {
    const heading = m[1].replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[`*]/g, '').replace(/\$([^$]*)\$/g, '$1').replace(/\s+/g, ' ').trim();
    if (heading) out.push(heading);
  }
  return out.slice(0, 80);
}
async function readFileInfo(path) {
  const base = path.split('/').pop().replace(/\.(md|pdf)$/i, '');
  if (/\.pdf$/i.test(path)) return { name: base, path, type: 'pdf', main: false };
  const { meta, body } = splitFrontMatter(await readFile(join(ROOT, path), 'utf8'));
  const info = { name: meta.title || base, path, type: 'md', main: /^(true|yes|1|да)$/i.test(meta.main || '') };
  const headings = headingsOf(body);
  if (headings.length) info.headings = headings;
  return info;
}
async function buildLecture(subject, dir) {
  const rel = `${SOURCE}/${subject}/${dir}`;
  const paths = await collectFiles(rel);
  if (!paths.length) return null;
  const files = await Promise.all(paths.map(readFileInfo));
  files.sort((a, b) => byName(a.path, b.path));
  const marked = files.filter(f => f.main), main = marked[0] || files[0];
  if (marked.length > 1) notes.push(`⚠ ${rel}: несколько файлов с «main: true», выбран «${main.name}»`);
  if (!marked.length) notes.push(`• ${rel}: маркера main нет — главным назначен «${main.name}»`);
  files.forEach(f => { f.main = f === main; });
  return { name: dir, path: rel, files: [main, ...files.filter(f => f !== main)] };
}

const subjects = [];
for (const s of (await entries(SOURCE)).filter(e => e.isDirectory())) {
  const lectures = [];
  for (const l of await entries(`${SOURCE}/${s.name}`)) {
    if (l.isDirectory()) {
      if (SKIP_DIRS.has(l.name.toLowerCase())) continue;
      const lecture = await buildLecture(s.name, l.name);
      if (lecture) lectures.push(lecture);
    } else if (isDoc(l.name)) notes.push(`⚠ ${SOURCE}/${s.name}/${l.name}: файл лежит вне папки лекции и в индекс не попал`);
  }
  if (lectures.length) subjects.push({ name: s.name, lectures });
}

const output = JSON.stringify({ version: 1, root: SOURCE, subjects }, null, 1) + '\n';
const previous = await readFile(join(ROOT, OUTPUT), 'utf8').catch(() => '');
const total = subjects.reduce((sum, s) => sum + s.lectures.length, 0);
notes.forEach(line => console.log(line));
if (previous === output) console.log(`Индекс актуален: предметов ${subjects.length}, лекций ${total}.`);
else if (process.argv.includes('--check')) { console.error(`Индекс ${OUTPUT} устарел. Запустите: node tools/build-lectures-index.mjs`); process.exit(1); }
else {
  await mkdir(dirname(join(ROOT, OUTPUT)), { recursive: true });
  await writeFile(join(ROOT, OUTPUT), output);
  console.log(`Записано ${OUTPUT}: предметов ${subjects.length}, лекций ${total}.`);
}
