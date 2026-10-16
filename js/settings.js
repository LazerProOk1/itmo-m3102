import { ic } from './icons.js';
import { applyTheme, applyRadius, getTheme, getRadius, drawAppearance, chooseAppearance, APPEARANCE_HTML } from './appearance.js';

const KEY = 'm3102-settings-v1';
const FONTS = [
  { id: 'noto', name: 'Noto Sans', var: '--ff-noto', note: 'По умолчанию' },
  { id: 'liberation', name: 'Liberation Sans', var: '--ff-liberation', note: 'Системный; если его нет — Arimo (метрически такой же)' },
  { id: 'ubuntu', name: 'Ubuntu Sans', var: '--ff-ubuntu', note: 'Подгружается из Google Fonts' },
  { id: 'urw', name: 'URW Gothic', var: '--ff-urw', note: 'Загружается из папки fonts/ (запасной вариант — системный)' },
];
// Сами цвета лежат в css/settings.css (--pal-<id>-a / -b); здесь только список и названия
const PALETTES = [
  { id: 'purple', name: 'Фиолетовая' },
  { id: 'orange', name: 'Оранжевая' },
  { id: 'green', name: 'Зелёная' },
  { id: 'blue', name: 'Синяя' },
  { id: 'cyan', name: 'Светлый циан' },
  { id: 'gold', name: 'Золото' },
  { id: 'neon', name: 'Неон' },
  { id: 'aurora', name: 'Аврора' },
];
const DEFAULT_PALETTE = 'purple';
const BASE_PALETTES = ['purple', 'orange', 'green', 'blue', 'cyan'];
// палитры из капсул слотов видны, когда выпали (или выбраны прямо сейчас)
const paletteVisible = (id, current) => { if (BASE_PALETTES.includes(id) || id === current) return true; try { return Boolean(JSON.parse(localStorage.getItem('m3102-slots-v1')).album['pal:' + id]); } catch { return false; } };
const SAMPLE = 'Съешь же ещё этих мягких французских булок, да выпей чаю. <b>0123456789</b>';

const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const write = patch => { try { localStorage.setItem(KEY, JSON.stringify({ ...read(), ...patch })); } catch { /* Приватный режим. */ } };

export const getFont = () => { const id = read().font; return FONTS.some(f => f.id === id) ? id : 'noto'; };
export function applyFont(id) { document.documentElement.dataset.font = id; }
export function setFont(id) {
  if (!FONTS.some(f => f.id === id)) return;
  write({ font: id }); applyFont(id);
}

export const getPalette = () => { const id = read().palette; return PALETTES.some(p => p.id === id) ? id : DEFAULT_PALETTE; };
// У исходной (фиолетовой) темы атрибута нет — так её стили остаются ровно такими, как были
export function applyPalette(id) {
  const root = document.documentElement;
  if (id === DEFAULT_PALETTE) root.removeAttribute('data-palette'); else root.dataset.palette = id;
}
let animTimer = 0;
export function setPalette(id) {
  if (!PALETTES.some(p => p.id === id) || id === getPalette()) return;
  write({ palette: id });
  // Плавность включается только на время смены темы (см. .palette-anim в css/settings.css)
  const root = document.documentElement;
  root.classList.add('palette-anim');
  clearTimeout(animTimer); animTimer = setTimeout(() => root.classList.remove('palette-anim'), 800);
  applyPalette(id);
}

export const installSettings = () => { applyFont(getFont()); applyPalette(getPalette()); applyTheme(getTheme()); applyRadius(getRadius()); };

export function renderSettingsPage() {
  const content = document.querySelector('#content');
  const draw = () => {
    const font = getFont(), palette = getPalette();
    content.querySelector('.palette-options').innerHTML = PALETTES.filter(p => paletteVisible(p.id, palette)).map(p => `<button type="button" class="palette-option" role="radio" aria-checked="${p.id === palette}" data-palette="${p.id}">
      <span class="palette-swatch" style="background:linear-gradient(135deg,var(--pal-${p.id}-a),var(--pal-${p.id}-b))">${ic('check', 20)}</span>${p.name}</button>`).join('');
    drawAppearance(content);
    content.querySelector('.font-options').innerHTML = FONTS.map(f => `<button type="button" class="font-option" role="radio" aria-checked="${f.id === font}" data-font="${f.id}" style="font-family:var(${f.var})">
      <span class="font-option-head"><span class="font-option-name">${f.name}</span><span class="font-option-tick" aria-hidden="true">${ic('check', 14)}</span></span>
      <span class="font-option-sample">${SAMPLE}</span>
      <span class="font-option-meta">${f.note}</span></button>`).join('');
  };
  content.innerHTML = `<section class="settings-page"><div class="intro"><span class="sched-eyebrow">ВНЕШНИЙ ВИД · М3102</span><h1>Настройки</h1><p class="sub">Параметры хранятся в этом браузере и не влияют на остальную группу.</p></div>
    <section class="dash-panel settings-group"><div class="panel-head"><h2>Цвета сайта</h2></div>
      <p class="settings-note">Меняет акцентный цвет, фон и подсветку. Светлая или тёмная тема выбирается ниже.</p>
      <div class="palette-options" role="radiogroup" aria-label="Цветовая тема"></div></section>
    ${APPEARANCE_HTML}<section class="dash-panel settings-group"><div class="panel-head"><h2>Шрифт сайта</h2></div>
      <p class="settings-note">Применяется ко всему сайту и к PDF, которые вы формируете из конспектов.</p>
      <div class="font-options" role="radiogroup" aria-label="Шрифт сайта"></div></section></section>`;
  content.querySelector('.settings-page').onclick = event => {
    // Именно button[...]: у <html> тоже есть data-font / data-palette, и голый closest() находил его
    const pal = event.target.closest('button[data-palette]'), font = event.target.closest('button[data-font]'), opt = event.target.closest('button[data-theme-opt],button[data-radius-opt]');
    if (pal) setPalette(pal.dataset.palette); else if (opt) chooseAppearance(opt); else if (font) setFont(font.dataset.font); else return;
    draw();
  };
  draw();
}
