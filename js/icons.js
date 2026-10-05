/*
  Единый набор SVG-иконок сайта (24×24, обводка currentColor — цвет и размер задаются CSS).
  ic(name, size)        — строка с <svg> для шаблонов;
  hydrateIcons(root)    — заполняет <span data-icon="home" data-size="22"></span>;
  installGlyphIcons()   — «страховка»: автоматически заменяет оставшиеся символы-стрелки/эмодзи
                          (×, ↗, ✎, 🔥 …) на SVG в любом тексте страницы (кроме конспектов, кода и игры).
*/
const P = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  tasks: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  more: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  notes: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/>',
  flask: '<path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2.2h12.4a1.5 1.5 0 0 0 1.3-2.2L14 9V3"/><path d="M7.5 15h9"/>',
  book: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v15H5.5A1.5 1.5 0 0 0 4 19.5z"/><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H19v-3"/>',
  pencil: '<path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z"/><path d="M14.5 6.5l3 3"/>',
  cap: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5"/>',
  diagram: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><path d="M10 6.5h4a3 3 0 0 1 3 3V14"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14a4 4 0 0 0 8 0M9 9.5h.01M15 9.5h.01"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-9 9"/>',
  gamepad: '<path d="M6 8h12a4 4 0 0 1 4 4v2a3 3 0 0 1-5.2 2L15 14H9l-1.8 2A3 3 0 0 1 2 14v-2a4 4 0 0 1 4-4z"/><path d="M7 10.5v3M5.5 12h3M16 11.5h.01M18 12.5h.01"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  file: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/>',
  audio: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  send: '<path d="M21 3L10 14"/><path d="M21 3l-7 18-4-7-7-4z"/>',
  code: '<path d="M8 8l-5 4 5 4M16 8l5 4-5 4M14 4l-4 16"/>',
  hash: '<path d="M5 9h14M5 15h14M10 3L8 21M16 3l-2 18"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/>',
  arrowUpRight: '<path d="M7 17L17 7M8 7h9v9"/>',
  arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronLeft: '<path d="m15 6-6 6 6 6"/>',
  chevronRight: '<path d="m9 6 6 6-6 6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  skipBack: '<path d="M6 5v14M19 5L9 12l10 7z"/>',
  skipForward: '<path d="M18 5v14M5 5l10 7-10 7z"/>',
  flame: '<path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 .3 1.2 1 2 2 2 0-3-.5-5 1-8z"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4v2a3 3 0 0 0 4 3M16 6h4v2a3 3 0 0 1-4 3M12 13v4M8 21h8M10 17h4"/>',
  sparkles: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
};

export const ic = (name, size = 20, cls = '') => {
  const s = typeof size === 'number' ? String(size) : size;
  return `<svg class="ic-svg${cls ? ' ' + cls : ''}" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${P[name] || P.file}</svg>`;
};

export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = ic(el.dataset.icon, Number(el.dataset.size) || 18); });
}

/* ---------- страховка: символы → SVG ---------- */
const GLYPHS = {
  '×': 'close', '↗': 'arrowUpRight', '←': 'arrowLeft', '→': 'arrowRight', '↑': 'arrowUp', '↓': 'arrowDown', '＋': 'plus', '✎': 'pencil', '↻': 'refresh',
  '⌄': 'chevronDown', '‹': 'chevronLeft', '›': 'chevronRight', '↶': 'undo', '↷': 'redo', '⧉': 'copy', '✓': 'check', '☀': 'sun', '◇': 'calendar', '▤': 'file',
  '▶': 'play', '⏸': 'pause', '⏮': 'skipBack', '⏭': 'skipForward',
  '🔥': 'flame', '🏆': 'trophy', '🎉': 'sparkles', '👍': 'check', '📚': 'book', '🧠': 'bulb', '🔍': 'search', '🔗': 'link', '🖼': 'image', '📄': 'file', '🎓': 'cap', '😂': 'smile',
};
const keys = Object.keys(GLYPHS).join('|');
const TEST = new RegExp(keys, 'u'), SPLIT = new RegExp(`(${keys})\\uFE0F?`, 'u');
const SKIP = 'svg,script,style,textarea,input,select,option,canvas,pre,code,.prose,.dgm,.mermaid,.hh-root,.arr-code,.diagram-source,[data-no-icons]';

export function installGlyphIcons() {
  const convert = node => {
    const text = node.nodeValue, parent = node.parentElement;
    if (!text || !TEST.test(text) || !parent || parent.closest(SKIP)) return;
    const frag = document.createDocumentFragment();
    text.split(SPLIT).forEach((part, i) => {
      if (i % 2 === 0) { if (part) frag.append(part); return; }
      const span = document.createElement('span');
      span.className = 'gi'; span.innerHTML = ic(GLYPHS[part], '1.15em');
      frag.append(span);
    });
    node.replaceWith(frag);
  };
  const scan = root => {
    if (root.nodeType === 3) return convert(root);
    if (root.nodeType !== 1 || root.closest?.(SKIP)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), found = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) if (TEST.test(n.nodeValue)) found.push(n);
    found.forEach(convert);
  };
  const queue = new Set(); let frame = 0;
  const flush = () => { frame = 0; const items = [...queue]; queue.clear(); items.forEach(n => { if (n.isConnected) scan(n); }); };
  new MutationObserver(records => {
    for (const r of records) { if (r.type === 'characterData') queue.add(r.target); else r.addedNodes.forEach(n => queue.add(n)); }
    if (!frame) frame = requestAnimationFrame(flush);
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
  scan(document.body);
}
