/*
  Интерактивный плеер для диаграммы `array` с кодом.
  Подключается сам: следит за DOM и монтирует любую <figure class="dgm-array-live">.
  Для печати и PDF живой плеер заменяется на статичный SVG (тот же, что рисовался раньше):
  - обычная печать браузера — правилами @media print ниже;
  - собственный PDF-конвертер конспектов — вызовом printifyDiagrams(root) (см. index.html).
*/
import { parseDiagram, renderArrayFrame } from './index.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const COLORS = ['#5b5fef', '#dd7956', '#42a592', '#b36da3', '#4d87bf', '#db9451', '#9069cf', '#e0485c'];
const CELL_H = 44, HAND_H = 60, PTR_ROW = 18;
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const STYLE = `
.dgm-array-live .dgm-art{container-type:inline-size;}
.dgm-array-live:not(.is-mounted) .arr-live{display:none;}
.dgm-array-live.is-mounted .dgm-print{display:none;}
.arr-live{display:grid;gap:12px;text-align:left;outline:none;font-size:.88rem;color:var(--text);}
.arr-live:focus-visible{outline:2px solid color-mix(in srgb,var(--accent) 55%,transparent);outline-offset:4px;border-radius:12px;}
@container (min-width:760px){.arr-live.has-code{grid-template-columns:minmax(0,1fr) 270px;align-items:start;}}
.arr-main{display:grid;gap:10px;min-width:0;}
.arr-stagewrap{overflow-x:auto;border:1px solid var(--border);border-radius:14px;background:var(--card);}
.arr-stage{position:relative;}
.arr-slot{position:absolute;height:${CELL_H}px;border:2px dashed var(--border);border-radius:10px;box-sizing:border-box;opacity:.55;}
.arr-idx{position:absolute;text-align:center;font-size:11px;color:var(--muted);font-variant-numeric:tabular-nums;}
.arr-chip{position:absolute;left:0;top:0;height:${CELL_H}px;box-sizing:border-box;border:2px solid var(--border);border-radius:10px;background:var(--card);display:flex;align-items:center;justify-content:center;padding:0 4px;font:600 16px ui-monospace,SFMono-Regular,Consolas,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;will-change:transform;}
.arr-chip.is-hand{height:44px;border-style:dashed;border-color:var(--muted);overflow:visible;}
.arr-chip.is-hand .arr-lbl{position:absolute;left:0;right:0;top:-15px;text-align:center;font:600 11px ui-monospace,monospace;color:var(--muted);}
.arr-chip.is-done{border-color:#42a592;background:color-mix(in srgb,#42a592 14%,var(--card));}
.arr-chip.is-read{border-color:#4d87bf;background:color-mix(in srgb,#4d87bf 16%,var(--card));}
.arr-chip.is-cmp{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 16%,var(--card));box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 22%,transparent);}
.arr-chip.is-write{border-color:#42a592;background:color-mix(in srgb,#42a592 22%,var(--card));box-shadow:0 0 0 3px color-mix(in srgb,#42a592 25%,transparent);}
.arr-chip.is-swap{border-color:#dd7956;background:color-mix(in srgb,#dd7956 20%,var(--card));box-shadow:0 0 0 3px color-mix(in srgb,#dd7956 25%,transparent);}
.arr-ptr{position:absolute;left:0;top:0;text-align:center;font:700 12px ui-monospace,monospace;line-height:${PTR_ROW}px;height:${PTR_ROW}px;color:var(--pc);transition:transform .35s ease,opacity .2s;pointer-events:none;}
.arr-ptr.is-off{opacity:0;}
.arr-status{border:1px solid var(--border);border-radius:12px;padding:10px 14px;min-height:66px;background:color-mix(in srgb,var(--accent) 5%,var(--card));display:grid;gap:4px;align-content:center;}
.arr-src{font:12px ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--muted);word-break:break-word;}
.arr-eval{font:600 17px ui-monospace,SFMono-Regular,Consolas,monospace;display:flex;flex-wrap:wrap;align-items:center;gap:8px;}
.arr-eval .op{color:var(--muted);}
.arr-res{font:700 11px system-ui,sans-serif;letter-spacing:.04em;text-transform:uppercase;padding:2px 9px;border-radius:999px;}
.arr-res.is-true{color:#1a9c4a;background:color-mix(in srgb,#22c55e 16%,var(--card));}
.arr-res.is-false{color:#d2485b;background:color-mix(in srgb,#e0485c 13%,var(--card));}
.arr-kind{font:700 11px system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:var(--accent);}
.arr-meta{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;justify-content:space-between;}
.arr-vars{display:flex;flex-wrap:wrap;gap:6px;}
.arr-var{font:12px ui-monospace,monospace;padding:2px 9px;border-radius:999px;border:1px solid var(--border);background:var(--card);}
.arr-var.is-ptr{border-color:var(--pc);color:var(--pc);font-weight:700;}
.arr-stats{font-size:.76rem;color:var(--muted);}
.arr-log{border:1px solid var(--border);border-radius:12px;padding:6px 10px;background:var(--card);font:12px ui-monospace,SFMono-Regular,Consolas,monospace;display:grid;gap:1px;}
.arr-log-row{display:flex;gap:8px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.55;}
.arr-log-row .n{min-width:2.4em;text-align:right;opacity:.7;}
.arr-log-row.is-now{color:var(--text);font-weight:600;}
.arr-log-row .t{color:#1a9c4a;}.arr-log-row .f{color:#d2485b;}
.arr-controls{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;}
.arr-controls button,.arr-controls select{border:1px solid var(--border);background:var(--card);color:var(--text);border-radius:9px;padding:6px 11px;font:inherit;font-size:.85rem;cursor:pointer;min-width:38px;}
.arr-controls button:hover:not(:disabled),.arr-controls select:hover{border-color:var(--accent);}
.arr-controls button:disabled{opacity:.4;cursor:default;}
.arr-controls .arr-play{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:600;min-width:84px;}
.arr-controls input[type=range]{flex:1;min-width:120px;accent-color:var(--accent);}
.arr-count{font-size:.78rem;color:var(--muted);font-variant-numeric:tabular-nums;min-width:72px;text-align:right;}
.arr-code{border:1px solid var(--border);border-radius:12px;overflow:hidden;background:#1e1f29;min-width:0;}
.arr-code-head{font:700 11px system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#9599ab;padding:7px 12px;border-bottom:1px solid rgba(255,255,255,.08);}
.arr-code-body{position:relative;max-height:320px;overflow:auto;padding:6px 0;font:12.5px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace;color:#d7d9e2;}
.arr-line{display:flex;white-space:pre;padding-right:12px;border-left:3px solid transparent;}
.arr-line .ln{flex:none;width:2.6em;text-align:right;padding-right:10px;color:#6b6f82;user-select:none;}
.arr-line.is-current{background:rgba(124,127,251,.26);border-left-color:#7c7ffb;color:#fff;}
@media (prefers-reduced-motion:reduce){.arr-ptr{transition:none;}}
@media print{.dgm-array-live .arr-live{display:none !important;}.dgm-array-live .dgm-print{display:block !important;}}
`;
function ensureStyles() {
  if (document.getElementById('dgm-array-live-style')) return;
  const style = document.createElement('style'); style.id = 'dgm-array-live-style'; style.textContent = STYLE; document.head.appendChild(style);
}

const T = p => `translate(${p.x}px, ${p.y}px)`;
function move(el, from, to, dur, arc = 0) {
  el.style.transform = T(to);
  if (!dur || !el.animate || (from.x === to.x && from.y === to.y)) return;
  const frames = [{ transform: T(from) }];
  if (arc) frames.push({ transform: T({ x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) + arc }), offset: .5 });
  frames.push({ transform: T(to) });
  el.animate(frames, { duration: dur, easing: 'ease-in-out' });
}
const pop = (el, to, dur) => { el.style.transform = T(to); if (dur && el.animate) el.animate([{ opacity: 0, transform: `${T(to)} scale(.6)` }, { opacity: 1, transform: T(to) }], { duration: dur, easing: 'ease-out' }); };
const vanish = (el, dur) => { if (dur && el.animate) el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: dur * .8 }).onfinish = () => el.remove(); else el.remove(); };

/* ---------- подписи операций ---------- */
const OP_TEXT = { '===': '=', '!==': '≠', '!=': '≠', '==': '=', '<=': '≤', '>=': '≥' };
const opText = op => OP_TEXT[op] || op;
function statusHtml(s, index, last) {
  switch (s.kind) {
    case 'start': return '<div class="arr-kind">Начало</div><div class="arr-eval">Исходный массив</div>';
    case 'end': return `<div class="arr-kind">Готово</div><div class="arr-eval">${esc(s.text || 'Программа завершена')}</div>`;
    case 'compare': return `<div class="arr-kind">Сравнение</div><div class="arr-src">${esc(s.src)}</div><div class="arr-eval"><span>${esc(s.lv)}</span><span class="op">${esc(opText(s.op))}</span><span>${esc(s.rv)}</span><span class="arr-res ${s.res ? 'is-true' : 'is-false'}">${s.res ? 'истина' : 'ложь'}</span></div>`;
    case 'swap': return `<div class="arr-kind">Обмен</div><div class="arr-src">${esc(s.src || '')}</div><div class="arr-eval"><span>a[${s.i}]</span><span class="op">↔</span><span>a[${s.j}]</span><span class="op">→</span><span>${esc(s.vi)}, ${esc(s.vj)}</span></div>`;
    case 'write': return `<div class="arr-kind">Запись</div><div class="arr-src">${esc(s.dst)} = ${esc(s.src)}</div><div class="arr-eval"><span>a[${s.i}]</span><span class="op">←</span><span>${esc(s.val)}</span></div>`;
    case 'load': return `<div class="arr-kind">Чтение в переменную</div><div class="arr-src">${esc(s.name)} = ${esc(s.src)}</div><div class="arr-eval"><span>${esc(s.name)}</span><span class="op">=</span><span>${esc(s.val)}</span></div>`;
    case 'pointer': return `<div class="arr-kind">Указатель</div><div class="arr-eval"><span>${esc(s.name)}</span><span class="op">=</span><span>${esc(s.val)}</span></div>`;
    case 'remove': return `<div class="arr-kind">Удаление</div><div class="arr-eval">pop() <span class="op">→</span> ${esc(s.val)}</div>`;
    default: return `<div class="arr-kind">Комментарий</div><div class="arr-eval">${esc(s.text)}</div>`;
  }
}
function briefHtml(s) {
  switch (s.kind) {
    case 'start': return 'начало';
    case 'end': return 'готово';
    case 'compare': return `${esc(s.src)} → ${esc(s.lv)} ${esc(opText(s.op))} ${esc(s.rv)} <span class="${s.res ? 't' : 'f'}">${s.res ? 'истина' : 'ложь'}</span>`;
    case 'swap': return `обмен a[${s.i}] ↔ a[${s.j}]`;
    case 'write': return `${esc(s.dst)} = ${esc(s.val)}`;
    case 'load': return `${esc(s.name)} = ${esc(s.src)} → ${esc(s.val)}`;
    case 'pointer': return `${esc(s.name)} = ${esc(s.val)}`;
    case 'remove': return `pop() → ${esc(s.val)}`;
    default: return esc(s.text);
  }
}

function createPlayer(figure, host, model) {
  const steps = model.steps, last = steps.length - 1, names = model.pointerNames || [];
  const N = Math.max(1, ...steps.map(s => s.vals.length));
  const handNames = [...new Set(steps.flatMap(s => s.hand.map(h => h.name)))];
  const maxStack = Math.max(1, ...steps.map(s => { const count = {}; s.ptr.forEach(p => { count[p.idx] = (count[p.idx] || 0) + 1; }); return Math.max(1, ...Object.values(count)); }));
  const hasHand = handNames.length > 0, ptrRows = Math.min(3, maxStack), hasCode = !model.hideCode;
  let idx = Math.max(0, Math.min(last, Number(figure.dataset.startStep) || 0)), speed = 1, playing = false, timer = 0, lastWidth = 0;
  let cw = 60, padX = 8, cellsY = 0, handH = hasHand ? HAND_H : 0;
  const cellChips = new Map(), handChips = new Map(), ptrEls = new Map();
  const colorOf = name => COLORS[Math.max(0, names.indexOf(name)) % COLORS.length];

  host.classList.toggle('has-code', hasCode);
  host.tabIndex = 0; host.setAttribute('role', 'group'); host.setAttribute('aria-label', model.title || 'Пошаговая демонстрация кода над массивом');
  host.innerHTML = `<div class="arr-main"><div class="arr-stagewrap"><div class="arr-stage"></div></div><div class="arr-status" aria-live="polite"></div><div class="arr-meta"><div class="arr-vars"></div><div class="arr-stats"></div></div><div class="arr-log" aria-hidden="true"></div>
    <div class="arr-controls"><button type="button" data-act="first" title="В начало" aria-label="В начало">⏮</button><button type="button" data-act="prev" title="Шаг назад (←)" aria-label="Шаг назад">‹</button><button type="button" class="arr-play" data-act="play" title="Пуск / пауза (пробел)">▶ Пуск</button><button type="button" data-act="next" title="Шаг вперёд (→)" aria-label="Шаг вперёд">›</button><button type="button" data-act="last" title="В конец" aria-label="В конец">⏭</button>
    <input type="range" min="0" max="${last}" value="${idx}" aria-label="Номер шага"><span class="arr-count"></span>
    <select aria-label="Скорость"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option><option value="4">4×</option></select></div></div>
    ${hasCode ? `<div class="arr-code"><div class="arr-code-head">Код</div><div class="arr-code-body">${model.codeLines.map((line, n) => `<div class="arr-line" data-l="${n + 1}"><span class="ln">${n + 1}</span><span>${esc(line) || ' '}</span></div>`).join('')}</div></div>` : ''}`;
  const $ = sel => host.querySelector(sel);
  const wrap = $('.arr-stagewrap'), stage = $('.arr-stage'), statusEl = $('.arr-status'), varsEl = $('.arr-vars'), statsEl = $('.arr-stats'), logEl = $('.arr-log');
  const slider = $('input[type=range]'), countEl = $('.arr-count'), playBtn = $('[data-act=play]'), codeBody = $('.arr-code-body');
  const lineEls = codeBody ? [...codeBody.querySelectorAll('.arr-line')] : [];

  const X = slot => padX + slot * cw + 3;
  const cellPos = slot => ({ x: X(slot), y: cellsY });
  const handPos = name => ({ x: X(Math.min(Math.max(0, handNames.indexOf(name)), N - 1)), y: 16 });

  function layout() {
    const W = wrap.clientWidth || 600; lastWidth = W;
    cw = Math.max(38, Math.min(76, Math.floor((W - 16) / N))); padX = Math.max(8, Math.floor((W - N * cw) / 2));
    cellsY = handH + ptrRows * PTR_ROW + 8;
    stage.style.cssText = `width:${Math.max(W, padX * 2 + N * cw)}px;height:${cellsY + CELL_H + 22}px;--cw:${cw}px;`;
    cellChips.clear(); handChips.clear(); ptrEls.clear();
    let html = '';
    for (let k = 0; k < N; k++) html += `<div class="arr-slot" style="transform:${T(cellPos(k))};width:${cw - 6}px"></div><div class="arr-idx" style="transform:${T({ x: X(k), y: cellsY + CELL_H + 4 })};width:${cw - 6}px">${k}</div>`;
    stage.innerHTML = html;
    names.forEach(name => { const el = document.createElement('div'); el.className = 'arr-ptr is-off'; el.style.cssText = `--pc:${colorOf(name)};width:${cw - 6}px;transform:${T({ x: X(0), y: handH })}`; el.textContent = `${name} ▼`; stage.appendChild(el); ptrEls.set(name, el); });
  }
  const chipW = () => `${cw - 6}px`;

  function show(to, animate) {
    const s = steps[to], dur = animate && !reduced() ? Math.min(450, Math.round(1100 / speed * .6)) : 0;
    const swapKind = s.kind === 'swap';
    /* ячейки массива */
    const seen = new Set();
    s.ids.forEach((id, slot) => {
      let c = cellChips.get(id); const target = cellPos(slot);
      if (!c) {
        const el = document.createElement('div'); el.className = 'arr-chip'; el.style.width = chipW(); el.textContent = s.vals[slot]; stage.appendChild(el);
        c = { el, slot }; cellChips.set(id, c);
        const hint = (s.born || []).find(b => b.id === id)?.from;
        if (hint && dur && hint.slot !== undefined) { el.style.transform = T(cellPos(hint.slot)); move(el, cellPos(hint.slot), target, dur); }
        else if (hint && dur && hint.hand) move(el, handPos(hint.hand), target, dur);
        else pop(el, target, dur);
      } else if (c.slot !== slot) { move(c.el, cellPos(c.slot), target, dur, swapKind ? (slot > c.slot ? -26 : 26) : 0); c.slot = slot; }
      else c.el.style.transform = T(target);
      seen.add(id);
    });
    for (const [id, c] of [...cellChips]) if (!seen.has(id)) { cellChips.delete(id); vanish(c.el, dur); }
    /* переменные, в которых «лежит» элемент (tmp, key…) */
    const handSeen = new Set();
    s.hand.forEach(h => {
      let c = handChips.get(h.name); const at = handPos(h.name);
      if (!c) { const el = document.createElement('div'); el.className = 'arr-chip is-hand'; el.style.width = chipW(); el.innerHTML = `<span class="arr-lbl">${esc(h.name)}</span><span class="v"></span>`; stage.appendChild(el); c = { el, val: null }; handChips.set(h.name, c); el.style.transform = T(at); }
      const src = s.handBorn?.[h.name];
      if (c.val !== h.val) { c.el.querySelector('.v').textContent = h.val; if (src !== undefined && dur) move(c.el, cellPos(src), at, dur); else if (c.val !== null && dur) pop(c.el, at, dur); }
      c.val = h.val; c.el.style.transform = T(at); handSeen.add(h.name);
    });
    for (const [name, c] of [...handChips]) if (!handSeen.has(name)) { handChips.delete(name); vanish(c.el, dur); }
    /* указатели */
    const vis = new Map(s.ptr.filter(p => p.idx >= 0 && p.idx < s.vals.length).map(p => [p.name, p.idx]));
    names.forEach(name => {
      const el = ptrEls.get(name); if (!el) return;
      if (!vis.has(name)) { el.classList.add('is-off'); return; }
      const slot = vis.get(name), rank = names.filter(o => vis.get(o) === slot && names.indexOf(o) < names.indexOf(name)).length;
      el.classList.remove('is-off'); el.style.transform = T({ x: X(slot), y: handH + Math.max(0, ptrRows - 1 - rank) * PTR_ROW });
    });
    /* подсветка */
    const bySlot = []; s.ids.forEach((id, slot) => { bySlot[slot] = cellChips.get(id)?.el; });
    cellChips.forEach(c => c.el.classList.remove('is-cmp', 'is-write', 'is-swap', 'is-read', 'is-done'));
    (s.done || []).forEach(k => bySlot[k]?.classList.add('is-done'));
    (s.read || []).forEach(k => bySlot[k]?.classList.add('is-read'));
    (s.cmp || []).forEach(k => bySlot[k]?.classList.add('is-cmp'));
    (s.write || []).forEach(k => bySlot[k]?.classList.add('is-write'));
    (s.swap || []).forEach(k => bySlot[k]?.classList.add('is-swap'));
    /* нижняя панель */
    statusEl.innerHTML = statusHtml(s, to, last);
    varsEl.innerHTML = s.vars.map(([n, v]) => `<span class="arr-var${names.includes(n) ? ' is-ptr' : ''}" style="--pc:${colorOf(n)}">${esc(n)} = ${esc(v)}</span>`).join('');
    const { cmp, swp, wr } = s.stats; statsEl.textContent = `Сравнений: ${cmp}${swp ? ` · Обменов: ${swp}` : ''}${wr ? ` · Записей: ${wr}` : ''}`;
    logEl.innerHTML = steps.slice(Math.max(0, to - 4), to + 1).map((st, k, arr) => { const n = Math.max(0, to - 4) + k; return `<div class="arr-log-row${n === to ? ' is-now' : ''}"><span class="n">${n}</span><span>${briefHtml(st)}</span></div>`; }).join('');
    slider.value = to; countEl.textContent = `Шаг ${to} / ${last}`;
    host.querySelector('[data-act=first]').disabled = host.querySelector('[data-act=prev]').disabled = to === 0;
    host.querySelector('[data-act=next]').disabled = host.querySelector('[data-act=last]').disabled = to === last;
    lineEls.forEach(el => el.classList.toggle('is-current', Number(el.dataset.l) === s.line));
    const cur = lineEls[s.line - 1];
    if (cur && codeBody) { const top = cur.offsetTop - codeBody.clientHeight / 2 + cur.offsetHeight / 2; codeBody.scrollTo ? codeBody.scrollTo({ top: Math.max(0, top), behavior: dur ? 'smooth' : 'auto' }) : (codeBody.scrollTop = Math.max(0, top)); }
    idx = to;
  }
  const go = (to, animate) => show(Math.max(0, Math.min(last, to)), animate && Math.abs(to - idx) === 1);

  function stop() { playing = false; clearTimeout(timer); playBtn.textContent = '▶ Пуск'; }
  function schedule() {
    timer = setTimeout(() => {
      if (!figure.isConnected || idx >= last) return stop();
      go(idx + 1, true);
      if (idx >= last) stop(); else schedule();
    }, Math.round(1100 / speed));
  }
  function play() { if (idx >= last) go(0, false); playing = true; playBtn.textContent = '⏸ Пауза'; schedule(); }

  host.addEventListener('click', event => {
    const button = event.target.closest('[data-act]'); if (!button) return;
    const act = button.dataset.act;
    if (act === 'play') return playing ? stop() : play();
    stop();
    if (act === 'first') go(0, false); else if (act === 'last') go(last, false); else if (act === 'prev') go(idx - 1, true); else if (act === 'next') go(idx + 1, true);
  });
  slider.addEventListener('input', () => { stop(); go(Number(slider.value), false); });
  $('select').addEventListener('change', event => { speed = Number(event.target.value); if (playing) { clearTimeout(timer); schedule(); } });
  host.addEventListener('keydown', event => {
    if (event.target.matches('input,select')) return;
    const keys = { ArrowRight: () => { stop(); go(idx + 1, true); }, ArrowLeft: () => { stop(); go(idx - 1, true); }, Home: () => { stop(); go(0, false); }, End: () => { stop(); go(last, false); }, ' ': () => (playing ? stop() : play()) };
    if (keys[event.key]) { event.preventDefault(); keys[event.key](); }
  });
  let frame = 0;
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => { if (Math.abs(wrap.clientWidth - lastWidth) > 4) { layout(); show(idx, false); } }); }).observe(wrap);

  layout(); show(idx, false);
  return { model, get step() { return idx; }, goto: to => go(to, false), stop };
}

export function mountArrayPlayer(figure) {
  if (figure._arrayPlayer) return figure._arrayPlayer;
  if (figure.dataset.print) return null;
  const host = figure.querySelector('.arr-live'); if (!host) return null;
  let model; try { model = parseDiagram('array', figure.dataset.dgmSrc || ''); } catch { return null; }
  if (!model.steps || model.steps.length < 2) return null;
  ensureStyles(); figure.classList.add('is-mounted');
  try { figure._arrayPlayer = createPlayer(figure, host, model); } catch (error) { figure.classList.remove('is-mounted'); console.error(error); return null; }
  return figure._arrayPlayer;
}
export const mountArrayPlayers = (root = document) => root.querySelectorAll('.dgm-array-live:not(.is-mounted)').forEach(mountArrayPlayer);

/** SVG того кадра, который сейчас на экране (для «Копировать SVG» / «PNG» / «SVG») */
export function frameSvg(figure) {
  const player = figure._arrayPlayer;
  if (!player) return figure.querySelector('svg');
  const holder = document.createElement('div'); holder.innerHTML = renderArrayFrame(player.model, player.step);
  return holder.firstElementChild;
}

/** Для PDF: заменяет живые плееры в (клонированном) дереве на статичный SVG — массив выглядит как раньше */
export function printifyDiagrams(root) {
  root.querySelectorAll('.dgm-array-live').forEach(figure => {
    figure.dataset.print = '1'; figure.querySelector('.arr-live')?.remove();
    const svg = figure.querySelector('svg.dgm-print');
    if (svg) { svg.classList.remove('dgm-print'); svg.style.display = 'block'; }
  });
}

if (typeof document !== 'undefined') {
  const start = () => {
    mountArrayPlayers();
    new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
      if (node.nodeType !== 1) return;
      if (node.matches('.dgm-array-live')) mountArrayPlayer(node); else mountArrayPlayers(node);
    }))).observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
}
