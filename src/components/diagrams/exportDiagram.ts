import { saveBlob } from '../../lib/download';

/** Свойства, которые диаграммы получают из CSS (классы и переменные темы), — в файле их надо вписать явно */
const PROPS = [
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-dasharray',
  'stroke-linecap',
  'stroke-linejoin',
  'opacity',
  'font-family',
  'font-size',
  'font-weight',
  'text-anchor',
  'dominant-baseline',
] as const;

/** SVG диаграммы как отдельный файл: размеры из viewBox, цвета текущей темы вписаны в style */
export function svgMarkup(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const source = [svg, ...svg.querySelectorAll('*')];
  const target = [clone, ...clone.querySelectorAll('*')];
  source.forEach((element, index) => {
    const computed = getComputedStyle(element);
    const node = target[index] as SVGElement;
    node.removeAttribute('class');
    node.setAttribute('style', PROPS.map((prop) => `${prop}:${computed.getPropertyValue(prop)}`).join(';'));
  });
  const box = svg.viewBox.baseVal;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(box?.width || svg.clientWidth));
  clone.setAttribute('height', String(box?.height || svg.clientHeight));
  return new XMLSerializer().serializeToString(clone);
}

export async function copySvg(svg: SVGSVGElement) {
  await navigator.clipboard.writeText(svgMarkup(svg));
}

export function downloadSvg(svg: SVGSVGElement, name: string) {
  saveBlob(new Blob([svgMarkup(svg)], { type: 'image/svg+xml' }), `${name}.svg`);
}

/** PNG в 2× — фон как у карточки диаграммы, чтобы светлые линии тёмной темы не пропали на прозрачном */
export async function downloadPng(svg: SVGSVGElement, name: string, background: string) {
  const markup = svgMarkup(svg);
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = image.width * scale;
    canvas.height = image.height * scale;
    const context = canvas.getContext('2d')!;
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (blob) saveBlob(blob, `${name}.png`);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Имя файла из заголовка диаграммы */
export const fileName = (title: string | undefined, lang: string) =>
  (title || lang)
    .replace(/\$[^$]*\$/g, '')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .trim() || lang;
