// Строит data/search-index.json для полнотекстового поиска по конспектам (.md) и PDF.
// .md режутся на разделы по заголовкам; PDF — по страницам (нужен pdftotext из poppler-utils;
// если его нет, PDF просто пропускаются; сканы без текстового слоя не индексируются).
//
// Запуск из корня репозитория:  node tools/build-search-index.mjs
// Запускать ПОСЛЕ tools/normalize-names.mjs.
import { promises as fs } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const ROOTS = ['Конспекты', 'Записи лекций', 'Лабораторные', 'Материалы'];
const OUT = 'data/search-index.json';
const MAX_SECTION = 30000; // символов на раздел

async function walk(dir, out) {
  let list;
  try { list = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of list) {
    if (entry.name.startsWith('.')) continue;
    const p = `${dir}/${entry.name}`;
    if (entry.isDirectory()) await walk(p, out); else out.push(p);
  }
}

function stripFrontMatter(text) {
  const m = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  if (!m) return text;
  const lines = m[1].split(/\r?\n/).filter(line => line.trim());
  return lines.length && lines.every(line => /^[\w.-]+\s*:/.test(line.trim())) ? text.slice(m[0].length) : text;
}
const cleanHeading = s => s
  .replace(/\$([^$]+)\$/g, '$1').replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*`~]/g, '').replace(/\s+/g, ' ').trim();
const cleanBody = s => s
  .replace(/\$\$[\s\S]*?\$\$/g, ' ').replace(/\\\[[\s\S]*?\\\]/g, ' ').replace(/\\\([\s\S]*?\\\)/g, ' ').replace(/\$[^$\n]+\$/g, ' ')
  .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/<[^>]+>/g, ' ').replace(/^:::.*$/gm, ' ')
  .replace(/^\s*>\s?/gm, '').replace(/^\s*(?:[-+*]|\d+\.)\s+/gm, '').replace(/[*`~|]/g, ' ')
  .replace(/\s+/g, ' ').trim().slice(0, MAX_SECTION);

function sectionsOf(text) {
  const out = []; let heading = '', buf = [], fence = '';
  const flush = () => { const body = cleanBody(buf.join('\n')); if (body) out.push([heading, body]); buf = []; };
  for (const line of stripFrontMatter(text).split(/\r?\n/)) {
    const f = /^\s*(`{3,}|~{3,})/.exec(line);
    if (f) { if (!fence) fence = f[1][0]; else if (f[1][0] === fence) fence = ''; continue; } // строки ``` в индекс не попадают
    if (fence) { buf.push(line); continue; }
    const h = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (h) { flush(); heading = cleanHeading(h[2]); continue; }
    buf.push(line);
  }
  flush();
  return out;
}

let pdfMissing = false;
async function pdfPages(file) {
  try {
    const { stdout } = await run('pdftotext', ['-enc', 'UTF-8', file, '-'], { maxBuffer: 256 * 1024 * 1024 });
    return stdout.split('\f').map((t, i) => [i + 1, t.replace(/\s+/g, ' ').trim().slice(0, MAX_SECTION)]).filter(([, t]) => t);
  } catch (error) {
    if (error.code === 'ENOENT') pdfMissing = true; else console.warn(`PDF пропущен: ${file} (${error.message.split('\n')[0]})`);
    return [];
  }
}

const all = [];
for (const root of ROOTS) await walk(root, all);
all.sort((a, b) => a.localeCompare(b, 'ru'));

const files = [], sections = []; // sections: [индексФайла, заголовок, текст, страницаPDF?]
for (const file of all) {
  if (/\.md$/i.test(file)) {
    const parts = sectionsOf(await fs.readFile(file, 'utf8'));
    if (!parts.length) continue;
    files.push(file);
    for (const [heading, body] of parts) sections.push([files.length - 1, heading, body]);
  } else if (/\.pdf$/i.test(file)) {
    const pages = await pdfPages(file);
    if (!pages.length) continue;
    files.push(file);
    for (const [page, body] of pages) sections.push([files.length - 1, `Стр. ${page}`, body, page]);
  }
}
if (pdfMissing) console.warn('pdftotext не найден — PDF не проиндексированы (apt-get install poppler-utils).');

await fs.mkdir('data', { recursive: true });
const json = JSON.stringify({ v: 1, files, sections });
await fs.writeFile(OUT, json);
console.log(`Индекс: файлов ${files.length}, разделов ${sections.length}, ${(json.length / 1048576).toFixed(2)} МБ.`);
if (json.length > 25 * 1048576) console.warn('Индекс больше 25 МБ — подумайте о том, чтобы не индексировать PDF.');
