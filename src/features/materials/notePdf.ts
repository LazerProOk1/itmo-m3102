import { domToForeignObjectSvg } from 'modern-screenshot';
import { saveBlob } from '../../lib/download';
import { buildPdf, type PdfPage } from '../../lib/pdf';

/*
 * «Скачать PDF» — сразу файл, без окна печати (как на сайте группы). Страницы — картинки: копия конспекта
 * в светлой теме шириной с лист A4 снимается целиком самим браузером (SVG foreignObject — формулы KaTeX
 * и схемы ровно как на экране, без перекосов html2canvas) и режется на листы по границам блоков.
 * Внизу каждого листа — водяной знак М3102, адрес сайта и номер страницы. Векторный PDF с выделяемым
 * текстом — по-прежнему «Печать» (window.print, global.css @page).
 */

const MM = 96 / 25.4;
const PAGE_W = 210 * MM;
const PAGE_H = 297 * MM;
// Поля как у печати (@page в global.css): 16 сверху, 14 по бокам, 18 снизу под подпись
const MARGIN_X = 14 * MM;
const MARGIN_TOP = 16 * MM;
const MARGIN_BOTTOM = 18 * MM;
const CONTENT_W = PAGE_W - 2 * MARGIN_X;
const CONTENT_H = PAGE_H - MARGIN_TOP - MARGIN_BOTTOM;
/** Пикселей листа на пиксель CSS: 2 — ~190 dpi, текст чёткий, файл ~150–300 КБ на страницу */
const SCALE = 2;

/** Свойства, которые переносятся в снимок: раскладка, текст, рамки, фон, SVG-схемы */
const STYLE_PROPERTIES = [
  'display',
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'z-index',
  'float',
  'clear',
  'box-sizing',
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'border-top-style',
  'border-right-style',
  'border-bottom-style',
  'border-left-style',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-left-radius',
  'border-bottom-right-radius',
  'border-collapse',
  'border-spacing',
  'table-layout',
  'vertical-align',
  'flex-direction',
  'flex-wrap',
  'flex-grow',
  'flex-shrink',
  'flex-basis',
  'align-items',
  'align-self',
  'justify-content',
  'gap',
  'row-gap',
  'column-gap',
  'order',
  'grid-template-columns',
  'grid-template-rows',
  'grid-column',
  'grid-row',
  'overflow-x',
  'overflow-y',
  'visibility',
  'opacity',
  'transform',
  'transform-origin',
  'color',
  'background-color',
  'background-image',
  'background-size',
  'background-position',
  'background-repeat',
  'box-shadow',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'font-variant-numeric',
  'line-height',
  'letter-spacing',
  'word-spacing',
  'text-align',
  'text-indent',
  'text-transform',
  'text-decoration-line',
  'text-decoration-color',
  'white-space',
  'word-break',
  'overflow-wrap',
  'list-style-type',
  'list-style-position',
  'content',
  'counter-reset',
  'counter-increment',
  'fill',
  'stroke',
  'stroke-width',
  'stroke-dasharray',
  'stroke-linecap',
  'stroke-linejoin',
  'fill-opacity',
  'stroke-opacity',
  'font-feature-settings',
  'marker-end',
  'marker-start',
  'text-anchor',
  'dominant-baseline',
  'paint-order',
];

export interface Block {
  top: number;
  bottom: number;
  heading: boolean;
}

/**
 * Где начинается каждый лист. Режем по верху блока, который не влезает; заголовок не остаётся последним
 * на листе — уходит вместе со следующим блоком. Блок выше листа режется по высоте листа.
 */
export function pageStarts(blocks: Block[], pageHeight: number): number[] {
  const starts = [0];
  let start = 0;
  blocks.forEach((block, index) => {
    if (block.bottom - start <= pageHeight) return;
    let cut = block.top;
    const previous = blocks[index - 1];
    if (previous?.heading && previous.top > start) cut = previous.top;
    if (cut <= start) cut = start + pageHeight;
    start = cut;
    starts.push(start);
    while (block.bottom - start > pageHeight) {
      start += pageHeight;
      starts.push(start);
    }
  });
  return starts;
}

/** Блоки для разрезания: крупные (больше 40% листа) разбираются на детей — списки по пунктам, таблицы по строкам */
function collectBlocks(root: HTMLElement): Block[] {
  const rootTop = root.getBoundingClientRect().top;
  const blocks: Block[] = [];
  const walk = (element: Element) => {
    for (const child of element.children) {
      const style = getComputedStyle(child);
      if (style.display === 'none') continue;
      const rect = child.getBoundingClientRect();
      const split = rect.height > CONTENT_H * 0.4 && child.children.length > 0 && !/^(PRE|svg|IMG|FIGURE)$/i.test(child.tagName);
      if (style.display === 'contents' || split) walk(child);
      else if (rect.height > 0) blocks.push({ top: rect.top - rootTop, bottom: rect.bottom - rootTop, heading: /^H[1-6]$/.test(child.tagName) });
    }
  };
  walk(root);
  return blocks.sort((a, b) => a.top - b.top);
}

/** Конспект дорисовывается по разделам (ProgressiveMarkdown) — ждём, пока DOM перестанет меняться */
function settled(element: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    let timer = window.setTimeout(done, 400);
    const deadline = window.setTimeout(done, 10_000);
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = window.setTimeout(done, 400);
    });
    observer.observe(element, { childList: true, subtree: true });
    function done() {
      observer.disconnect();
      clearTimeout(timer);
      clearTimeout(deadline);
      resolve();
    }
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = src;
  return image.decode().then(() => image);
}

/** Копия конспекта для съёмки: светлая тема ([data-pdf] в tokens.css), без тестов и кнопок, ширина листа */
function buildSheet(source: HTMLElement, title: string, subtitle: string): HTMLElement {
  const sheet = document.createElement('div');
  sheet.dataset.pdf = '';
  sheet.style.cssText = `position:absolute;left:-20000px;top:0;width:${CONTENT_W}px;background:#fff;color:var(--color-text)`;
  const heading = document.createElement('h1');
  heading.textContent = title;
  heading.style.cssText = 'margin:0 0 4px;font-size:22px;font-weight:650;line-height:1.25;letter-spacing:-0.01em';
  sheet.append(heading);
  if (subtitle) {
    const sub = document.createElement('p');
    sub.textContent = subtitle;
    sub.style.cssText = 'margin:0 0 18px;font-size:13px;color:var(--color-text-muted)';
    sheet.append(sub);
  }
  const content = source.cloneNode(true) as HTMLElement;
  content.style.setProperty('--content-font-size', '11.5pt');
  content.querySelectorAll('[data-pdf-hide]').forEach((element) => element.remove());
  // Проигрыватель массива с кодом — в файле его статичный кадр, как в печати
  content.querySelectorAll<HTMLElement>('[data-export-frame]').forEach((element) => (element.style.display = 'block'));
  content.querySelectorAll('img').forEach((image) => (image.loading = 'eager'));
  // Схемы и блоки, что проявляются при прокрутке (whileInView), до которых не долистали, — ещё невидимы
  content.querySelectorAll<HTMLElement>('[style*="opacity"]').forEach((element) => {
    element.style.opacity = '';
    element.style.transform = '';
  });
  sheet.append(content);
  return sheet;
}

function drawFooter(context: CanvasRenderingContext2D, watermark: HTMLImageElement, page: number, total: number) {
  const baseline = (PAGE_H - 9 * MM) * SCALE;
  const logoW = 24 * MM * SCALE;
  const logoH = (logoW * watermark.naturalHeight) / watermark.naturalWidth;
  context.drawImage(watermark, MARGIN_X * SCALE, baseline - logoH * 0.85, logoW, logoH);
  context.font = `${8 * (96 / 72) * SCALE}px Inter, 'Inter Variable', sans-serif`;
  context.fillStyle = '#8a8a93';
  context.textBaseline = 'alphabetic';
  context.textAlign = 'left';
  context.fillText('lazerprook1.github.io/itmo-m3102', MARGIN_X * SCALE + logoW + 4 * MM * SCALE, baseline);
  context.textAlign = 'right';
  context.fillText(`${page} / ${total}`, (PAGE_W - MARGIN_X) * SCALE, baseline);
}

/** Собрать и скачать PDF конспекта; onProgress — для подписи на кнопке */
export async function downloadNotePdf(source: HTMLElement, title: string, subtitle: string, onProgress?: (text: string) => void) {
  onProgress?.('Готовлю…');
  await settled(source);
  const sheet = buildSheet(source, title, subtitle);
  document.body.append(sheet);
  try {
    await document.fonts.ready;
    await Promise.all([...sheet.querySelectorAll('img')].map((image) => image.decode().catch(() => {})));
    const width = sheet.offsetWidth;
    const height = sheet.scrollHeight;
    const starts = pageStarts(collectBlocks(sheet), CONTENT_H);

    onProgress?.('Снимаю страницы…');
    const svg = await domToForeignObjectSvg(sheet, {
      backgroundColor: '#ffffff',
      width,
      height,
      // Копировать только свойства, от которых зависит вид, а не все ~400: в конспекте тысячи узлов KaTeX
      includeStyleProperties: STYLE_PROPERTIES,
    });
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('width', String(width * SCALE));
    svg.setAttribute('height', String(height * SCALE));
    // data:, не blob: — картинка SVG с foreignObject из blob-ссылки «пачкает» canvas, и toBlob запрещён
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
    const [shot, watermark] = await Promise.all([loadImage(url), loadImage(`${import.meta.env.BASE_URL}pdf-watermark.png`)]);

    const pages: PdfPage[] = [];
    for (let index = 0; index < starts.length; index++) {
      onProgress?.(`Страница ${index + 1} из ${starts.length}`);
      const from = starts[index]!;
      const slice = Math.min(starts[index + 1] ?? height, height) - from;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(PAGE_W * SCALE);
      canvas.height = Math.round(PAGE_H * SCALE);
      const context = canvas.getContext('2d')!;
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(shot, 0, from * SCALE, width * SCALE, slice * SCALE, MARGIN_X * SCALE, MARGIN_TOP * SCALE, width * SCALE, slice * SCALE);
      drawFooter(context, watermark, index + 1, starts.length);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((result) => (result ? resolve(result) : reject(new Error('Не удалось сжать страницу'))), 'image/jpeg', 0.85),
      );
      pages.push({ jpeg: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height });
    }
    saveBlob(buildPdf(pages, title), `${title.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'Конспект'}.pdf`);
  } finally {
    sheet.remove();
  }
}
