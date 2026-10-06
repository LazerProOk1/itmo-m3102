/**
 * Чистка HTML из docx (mammoth ничего не фильтрует): оставляем только текстовую разметку, таблицы, картинки и ссылки.
 * Разбор — в инертном документе DOMParser, скрипты в нём не выполняются.
 */
const ALLOWED_TAGS = new Set([
  'A',
  'B',
  'BLOCKQUOTE',
  'BR',
  'CODE',
  'DIV',
  'EM',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'HR',
  'I',
  'IMG',
  'LI',
  'OL',
  'P',
  'PRE',
  'S',
  'SPAN',
  'STRONG',
  'SUB',
  'SUP',
  'TABLE',
  'TBODY',
  'TD',
  'TH',
  'THEAD',
  'TR',
  'U',
  'UL',
]);
const ALLOWED_ATTRS = new Set(['href', 'src', 'alt', 'colspan', 'rowspan']);
const DROPPED_WITH_CONTENT = /^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|LINK|META|FORM|INPUT|SVG|MATH)$/;

const safeHref = (value: string) => /^(https?:|mailto:|#)/i.test(value.trim());
const safeSrc = (value: string) => /^(https:|data:image\/(png|jpe?g|gif|webp|bmp);base64,)/i.test(value.trim());

function clean(node: Element) {
  for (const child of [...node.children]) {
    if (!ALLOWED_TAGS.has(child.tagName)) {
      // Опасные теги уходят вместе с содержимым, остальные неизвестные — остаётся только их текст
      if (DROPPED_WITH_CONTENT.test(child.tagName)) child.remove();
      else {
        clean(child);
        child.replaceWith(...child.childNodes);
      }
      continue;
    }
    for (const attr of [...child.attributes]) {
      const keep = ALLOWED_ATTRS.has(attr.name) && (attr.name !== 'href' || safeHref(attr.value)) && (attr.name !== 'src' || safeSrc(attr.value));
      if (!keep) child.removeAttribute(attr.name);
    }
    if (child.tagName === 'A') {
      child.setAttribute('target', '_blank');
      child.setAttribute('rel', 'noopener noreferrer');
    }
    if (child.tagName === 'IMG' && !child.getAttribute('src')) child.remove();
    else clean(child);
  }
}

export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  clean(doc.body);
  return doc.body.innerHTML;
}
