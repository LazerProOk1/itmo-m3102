// @ts-nocheck
/* Перенесено из js/slots-art.js сайта группы (автор — RedstoneLord) как есть; правки помечены «Правка поверх оригинала».
   Обновлять — копированием нового файла и повтором правок. */
/*
  Оригинальные SVG-символы слотов «Колючий куш» в одном скрытом спрайте (viewBox 0 0 100 100).
  Никаких чужих логотипов: «ИТМО»-щит и «C++» — стилизованные рисунки. Подписи — по-русски для скринридеров.
*/
export const LABELS = {
  berry: 'Малина', apple: 'Яблоко', mush: 'Гриб-мухомор', git: 'Значок Git', orange: 'Апельсин', cpp: 'Шестиугольник C++', rust: 'Рыжий ёжик с шестерёнкой',
  pi: 'Свиток ∑ и π', hog: 'Ёжик', king: 'Король ёжиков', wild: 'Дикий шар-ёжик (Wild)', scatter: 'Щит-скаттер', bonus: 'Корзина с ягодами (бонус)',
};
const g = (id, a, b, x2 = 0, y2 = 1) => `<linearGradient id="g-${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
const DEFS = [
  g('red', '#ff7a7a', '#c4232f'), g('pink', '#ff9ac4', '#d6246e'), g('orange', '#ffc15a', '#e8730e'), g('blue', '#6fb6ff', '#1b55c9'), g('green', '#9be37a', '#2c8c3c'),
  g('brown', '#a37850', '#5b3d2b'), g('peach', '#fbe0bd', '#e8b786'), g('gold', '#fff0a0', '#d99a1f'), g('navy', '#47c8e8', '#14316b'), g('parch', '#fff6dc', '#e2c78f'),
  g('violet', '#b69cff', '#5b3fd0'), g('wick', '#e2b46c', '#9a6a2d'), g('gitc', '#ff9a5c', '#d8381d'), g('rustc', '#ffb070', '#b5470f'),
  '<radialGradient id="g-ball" cx=".5" cy=".5" r=".5" fx=".4" fy=".35"><stop offset="0" stop-color="#c99a6a"/><stop offset="1" stop-color="#5b3d2b"/></radialGradient>',
  '<radialGradient id="g-hogbody" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#b88b5c"/><stop offset="1" stop-color="#5b3d2b"/></radialGradient>',
  '<radialGradient id="g-rhogbody" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#f0a56a"/><stop offset="1" stop-color="#a8481a"/></radialGradient>',
  '<radialGradient id="g-glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff6a0" stop-opacity=".95"/><stop offset="1" stop-color="#fff6a0" stop-opacity="0"/></radialGradient>',
].join('');

/* ---------- ёжик (по мотивам эмодзи 🦔) ----------
   Иголки — треугольники, чьи основания лежат ВНУТРИ эллипса тела (k < 1), а кончики выходят за его край (k > 1).
   Тело рисуется поверх оснований, поэтому иголки растут прямо из тела и не «парят» отдельно.
   Два слоя иголок (тёмный сзади, светлее спереди) дают объём. */
const rad = d => d * Math.PI / 180;
const quills = (n, a0, a1, tipK, baseK, fill) => {
  const cx = 48, cy = 60, rx = 33, ry = 27, step = (a1 - a0) / (n - 1), d = step * 0.58;
  const P = (a, k) => `${(cx + Math.cos(rad(a)) * rx * k).toFixed(1)},${(cy + Math.sin(rad(a)) * ry * k).toFixed(1)}`;
  return Array.from({ length: n }, (_, i) => { const a = a0 + step * i, tk = tipK + 0.07 * ((i * 5) % 3) / 2; return `<path d="M${P(a - d, baseK)} L${P(a, tk)} L${P(a + d, baseK)}Z" fill="${fill}"/>`; }).join('');
};
const crownHat = '<g transform="translate(61 32) rotate(12)"><path d="M-15 7L-17-9-8-2 0-13 8-2 17-9 15 7Z" fill="url(#g-gold)" stroke="#b9791a" stroke-width="2" stroke-linejoin="round"/><circle cx="-17" cy="-9" r="2.6" fill="#e8467c"/><circle cx="0" cy="-13" r="3" fill="#4aa8ff"/><circle cx="17" cy="-9" r="2.6" fill="#e8467c"/></g>';
const gearHat = '<g transform="translate(60 32)"><g fill="#c9622a" stroke="#7a2f08" stroke-width="1.4" stroke-linejoin="round">' + Array.from({ length: 8 }, (_, i) => `<rect x="-2.4" y="-10.5" width="4.8" height="5.5" rx="1" transform="rotate(${i * 45})"/>`).join('') + '</g><circle r="7" fill="#ffd09a" stroke="#7a2f08" stroke-width="2"/><circle r="2.6" fill="#7a2f08"/></g>';
const hedge = ({ hat = '', body = 'hogbody', back = '#4a2f20', front = '#7a5436' } = {}) =>
  `${quills(14, 165, 345, 1.38, 0.85, back)}${quills(13, 171.9, 338.1, 1.27, 0.85, front)}` +
  '<ellipse cx="34" cy="87" rx="8" ry="5" fill="url(#g-peach)"/><ellipse cx="60" cy="88" rx="8" ry="5" fill="url(#g-peach)"/>' +
  `<ellipse cx="48" cy="60" rx="33" ry="27" fill="url(#g-${body})"/><ellipse cx="34" cy="47" rx="14" ry="8" fill="#fff" fill-opacity=".14" transform="rotate(-25 34 47)"/>` +
  '<circle cx="58" cy="47" r="6.5" fill="#e8bf8d"/><circle cx="58.5" cy="47.5" r="3.5" fill="#f3a7a0"/>' +
  '<ellipse cx="70" cy="66" rx="22" ry="17" fill="url(#g-peach)"/><ellipse cx="82" cy="67" rx="11" ry="9" fill="url(#g-peach)"/>' +
  '<ellipse cx="71" cy="71" rx="5.5" ry="3.2" fill="#ff8aa0" fill-opacity=".5"/>' +
  '<circle cx="73" cy="58" r="3.6" fill="#1f1612"/><circle cx="74.2" cy="56.8" r="1.2" fill="#fff"/>' +
  '<circle cx="91" cy="66" r="4.3" fill="#2b1d18"/><circle cx="89.8" cy="64.6" r="1.2" fill="#fff" fill-opacity=".7"/>' +
  `<path d="M78 74q4.5 3.8 9 0" stroke="#7a4a30" stroke-width="1.8" fill="none" stroke-linecap="round"/>${hat}`;

const spikes = (cx, cy, r, n, len, fill) => Array.from({ length: n }, (_, i) => { const a = Math.PI * (0.55 + 1.35 * i / (n - 1)), d = 0.19; const p = k => `${(cx + Math.cos(a + k) * r).toFixed(1)},${(cy + Math.sin(a + k) * r).toFixed(1)}`; return `<path d="M${p(-d)} L${(cx + Math.cos(a) * (r + len)).toFixed(1)},${(cy + Math.sin(a) * (r + len)).toFixed(1)} L${p(d)}Z" fill="${fill}"/>`; }).join('');
const S = {
  berry: '<g stroke="#a0124f" stroke-width="1.5">' + [[35, 44], [50, 40], [65, 44], [28, 58], [43, 56], [58, 56], [72, 58], [36, 71], [51, 70], [66, 71], [50, 83]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9.5" fill="url(#g-pink)"/><circle cx="${x - 3}" cy="${y - 3}" r="2.4" fill="#fff" fill-opacity=".7" stroke="none"/>`).join('') + '</g><path d="M50 36l-14-12 10 3 4-10 4 10 10-3z" fill="url(#g-green)" stroke="#1f6a2c" stroke-width="2" stroke-linejoin="round"/>',
  apple: '<path d="M50 30c-14-10-34-2-34 22 0 22 16 38 28 38 4 0 4-2 6-2s2 2 6 2c12 0 28-16 28-38 0-24-20-32-34-22z" fill="url(#g-red)" stroke="#8d1520" stroke-width="2.5"/><path d="M50 30q-2-12 6-20" stroke="#5b3d2b" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M56 22q16-14 28-2-12 14-28 2z" fill="url(#g-green)" stroke="#1f6a2c" stroke-width="2"/><ellipse cx="32" cy="48" rx="6" ry="11" fill="#fff" fill-opacity=".45" transform="rotate(18 32 48)"/>',
  mush: '<path d="M38 56h24l4 30c0 4-4 6-16 6s-16-2-16-6z" fill="#f6e6d0" stroke="#a88a62" stroke-width="2.5"/><path d="M8 58C8 28 28 12 50 12s42 16 42 46c0 4-4 5-8 5H16c-4 0-8-1-8-5z" fill="url(#g-red)" stroke="#8d1520" stroke-width="2.5"/><circle cx="30" cy="34" r="7" fill="#fff"/><circle cx="56" cy="26" r="8" fill="#fff"/><circle cx="76" cy="44" r="6" fill="#fff"/><circle cx="42" cy="50" r="4.5" fill="#fff"/>',
  git: '<rect x="18" y="18" width="64" height="64" rx="8" transform="rotate(45 50 50)" fill="url(#g-gitc)" stroke="#8d230f" stroke-width="3"/><g stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none"><path d="M42 36v28M42 52q0-12 16-14"/></g><g fill="#fff"><circle cx="42" cy="34" r="6.5"/><circle cx="42" cy="66" r="6.5"/><circle cx="60" cy="38" r="6.5"/></g>',
  orange: '<circle cx="50" cy="55" r="36" fill="url(#g-orange)" stroke="#b5560b" stroke-width="3"/><path d="M50 19q4-10 12-8-1 9-12 8z" fill="url(#g-green)" stroke="#1f6a2c" stroke-width="2"/><ellipse cx="36" cy="40" rx="8" ry="13" fill="#fff" fill-opacity=".38" transform="rotate(28 36 40)"/><circle cx="40" cy="55" r="3.4" fill="#3a2410"/><circle cx="60" cy="55" r="3.4" fill="#3a2410"/><path d="M38 66q12 12 24 0" stroke="#3a2410" stroke-width="3.5" fill="none" stroke-linecap="round"/>',
  cpp: '<path d="M50 8l36 21v42L50 92 14 71V29z" fill="url(#g-blue)" stroke="#0f2f7a" stroke-width="3.5" stroke-linejoin="round"/><path d="M50 18l27 16v32L50 82 23 66V34z" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="2"/><text x="50" y="62" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="28" fill="#fff" stroke="#0f2f7a" stroke-width="1.2">C++</text>',
  // рыжий ёжик с шестерёнкой на макушке (раньше — «краб-шестерёнка»)
  rust: hedge({ body: 'rhogbody', back: '#8a3410', front: '#c9622a', hat: gearHat }),
  pi: '<path d="M22 20h60v52c0 8-6 12-12 12H30c-6 0-10-4-10-10 0-4 2-7 6-7h4V30c0-6-4-10-8-10z" fill="url(#g-parch)" stroke="#8a6a32" stroke-width="3" stroke-linejoin="round"/><path d="M22 20c-8 0-12 4-12 9s5 8 12 8" fill="#e2c78f" stroke="#8a6a32" stroke-width="3"/><text x="52" y="46" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="25" fill="#5b3fd0">∑</text><text x="52" y="70" text-anchor="middle" font-family="Georgia,serif" font-style="italic" font-weight="700" font-size="25" fill="#7a55e0">π</text>',
  hog: hedge(), king: hedge({ hat: crownHat }),
  wild: '<circle cx="50" cy="50" r="46" fill="url(#g-glow)"/><g stroke="#ffd84a" stroke-width="4" stroke-linecap="round">' + Array.from({ length: 12 }, (_, i) => `<path d="M50 ${i % 2 ? 6 : 2}V${i % 2 ? 16 : 20}" transform="rotate(${i * 30} 50 50)"/>`).join('') + '</g><circle cx="50" cy="50" r="31" fill="url(#g-ball)" stroke="#3b2417" stroke-width="3"/><g fill="#2f1d12">' + Array.from({ length: 16 }, (_, i) => `<path d="M-3 0L0 -9L3 0Z" transform="translate(${(50 + Math.cos(i * 0.3927) * 31).toFixed(1)} ${(50 + Math.sin(i * 0.3927) * 31).toFixed(1)}) rotate(${i * 22.5 + 90})"/>`).join('') + '</g><path d="M30 56q20-18 40 0" stroke="#e8bf8d" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="62" cy="46" r="3" fill="#fff"/><text x="50" y="92" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-size="12" font-weight="900" fill="#fff" stroke="#3b2417" stroke-width="3" paint-order="stroke">WILD</text>',
  scatter: '<path d="M50 6l38 12v28c0 24-16 38-38 48C28 84 12 70 12 46V18z" fill="url(#g-navy)" stroke="#0b1f4a" stroke-width="3.5" stroke-linejoin="round"/><path d="M50 16l28 9v21c0 17-11 28-28 36-17-8-28-19-28-36V25z" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2"/><path d="M50 28l5.5 12 13 1.4-9.8 8.7 2.9 12.9L50 56.2 38.4 63l2.9-12.9-9.8-8.7 13-1.4z" fill="#fff6a0" stroke="#b9911a" stroke-width="2" stroke-linejoin="round"/>',
  bonus: '<path d="M20 44q30-44 60 0" stroke="#8a5a1e" stroke-width="6" fill="none" stroke-linecap="round"/><g>' + [[34, 40], [50, 34], [66, 40], [42, 46], [58, 46]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="url(#g-pink)" stroke="#a0124f" stroke-width="2"/>`).join('') + '</g><path d="M12 48h76l-8 40H20z" fill="url(#g-wick)" stroke="#6b4513" stroke-width="3" stroke-linejoin="round"/><path d="M20 60h60M22 72h56M36 48l-5 40M50 48v40M64 48l5 40" stroke="#6b4513" stroke-opacity=".55" stroke-width="2.5"/>',
};
const capsule = (c1, c2) => `<circle cx="50" cy="50" r="34" fill="${c2}"/><path d="M16 50a34 34 0 0 1 68 0z" fill="${c1}"/><path d="M16 50h68" stroke="#fff" stroke-opacity=".7" stroke-width="3"/><ellipse cx="36" cy="32" rx="8" ry="5" fill="#fff" fill-opacity=".55" transform="rotate(-30 36 32)"/><circle cx="50" cy="50" r="34" fill="none" stroke="#2a2540" stroke-opacity=".5" stroke-width="3"/>`;
const ICONS = {
  'cap-common': capsule('#b7c4d6', '#6b7a90'), 'cap-rare': capsule('#7ec4ff', '#2a6fd0'), 'cap-epic': capsule('#d6a0ff', '#7a35d0'), 'cap-legendary': capsule('#ffe27a', '#e0861a'),
  pointer: '<path d="M50 94L26 40a26 26 0 1 1 48 0z" fill="url(#g-gold)" stroke="#8a5a0a" stroke-width="4" stroke-linejoin="round"/><circle cx="50" cy="34" r="8" fill="#fff" stroke="#8a5a0a" stroke-width="3"/>',
  flame: '<path d="M52 6c4 20 26 28 26 52 0 20-12 34-28 34S22 78 22 60c0-12 6-20 12-26 2 8 6 12 10 12-2-14 0-30 8-40z" fill="url(#g-orange)" stroke="#b5470f" stroke-width="3" stroke-linejoin="round"/><path d="M50 52c3 8 14 12 14 24 0 8-6 14-14 14s-14-6-14-14c0-8 6-12 8-18 2 4 4 6 6 6z" fill="#ffe27a"/>',
};
export const SYMBOL_IDS = Object.keys(S);
export const SPRITE = `<svg id="sl-sprite" width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>${DEFS}</defs>${Object.entries(S).map(([id, body]) => `<symbol id="sl-${id}" viewBox="0 0 100 100"><title>${LABELS[id]}</title>${body}</symbol>`).join('')}${Object.entries(ICONS).map(([id, body]) => `<symbol id="sl-${id}" viewBox="0 0 100 100">${body}</symbol>`).join('')}</svg>`;
export function ensureSprite() { if (typeof document !== 'undefined' && !document.getElementById('sl-sprite')) document.body.insertAdjacentHTML('afterbegin', SPRITE); }
export const sym = (id, size = 64, cls = '') => `<svg class="sl-sym ${cls}" width="${size}" height="${size}" viewBox="0 0 100 100" role="img" aria-label="${LABELS[id] || ''}"><use href="#sl-${id}"/></svg>`;
export const icon = (id, size = 28, cls = '') => `<svg class="sl-ic ${cls}" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true"><use href="#sl-${id}"/></svg>`;
