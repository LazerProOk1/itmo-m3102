import type { Page } from '@playwright/test';

/** Конспекты в заглушке репозитория группы */
export const NOTE_MD = 'Конспекты/ДМ/Лекция_1/Графы.md';
export const NOTE_PDF = 'Конспекты/ДМ/Лекция_2/Деревья.pdf';
export const NOTE_TEXT =
  '# Графы\n\n## Определение\n\nГраф — это пара множеств: вершины и рёбра. Слово-маячок: зюзюка.\n\n## Степени\n\nСумма степеней чётна.\n';
export const PDF_PAGES = 6;

/**
 * Подменяет GitHub: дерево репозиториев, файлы и PDF. Всё прочее вне сайта — обрывается, чтобы тест
 * не зависел от сети. Обработчики Playwright проверяются с последнего, поэтому «оборвать всё» — первым.
 */
export async function mockGithub(page: Page) {
  // На весь контекст, а не на страницу: PDF качает воркер pdf.js, его запросы page.route не видит
  const context = page.context();
  await context.route(
    (url) => url.hostname !== 'localhost',
    (route) => route.abort(),
  );
  await context.route('https://api.github.com/**', (route) => {
    const url = decodeURIComponent(route.request().url());
    if (url.includes('/issues')) return route.fulfill({ json: [] });
    const tree = url.includes('RedstoneLord') ? [NOTE_MD, NOTE_PDF].map((path) => ({ path, type: 'blob', sha: path.length.toString(16) })) : [];
    return route.fulfill({ json: { truncated: false, tree } });
  });
  await context.route('https://raw.githubusercontent.com/**', (route) => {
    const url = decodeURIComponent(route.request().url());
    if (url.endsWith('.md')) return route.fulfill({ body: NOTE_TEXT, contentType: 'text/plain; charset=utf-8' });
    if (url.endsWith('deadlines.json')) return route.fulfill({ json: [] });
    if (url.endsWith('homework.json') || url.endsWith('links.json')) return route.fulfill({ json: { items: [] } });
    return route.fulfill({ status: 404 });
  });
  await context.route('https://redstonelord.github.io/**/*.pdf', (route) =>
    route.fulfill({ body: makePdf(PDF_PAGES), contentType: 'application/pdf', headers: { 'Access-Control-Allow-Origin': '*' } }),
  );
}

/** Минимальный PDF из n страниц A4 с надписью «Page i» — без файлов-образцов в репозитории */
export function makePdf(pages: number): Buffer {
  const objects: string[] = [];
  const pageIds = Array.from({ length: pages }, (_, index) => 4 + index * 2);
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  pageIds.forEach((id, index) => {
    const stream = `BT /F1 64 Tf 72 700 Td (Page ${index + 1}) Tj ET`;
    objects[id] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${id + 1} 0 R >>`;
    objects[id + 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}
