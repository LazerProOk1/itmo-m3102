import { base64Utf8, getToken, readRepoFileOptional, saveToken, utf8Base64, writeRepoFileBase64 } from '../github.js';
import { codeFigure, diagramLanguages, parseDiagram, renderDiagram } from './index.js';
import { frameSvg, mountArrayPlayers } from './array-player.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const draftKey = 'm3102-diagram-draft-v1';
const DEFAULT_FOLDER = 'img/diagrams';
const examples = {
  graph: 'graph directed\nlayout: circle\nA -> B : 5\nB -> C : 2 {color: red}\nA -- C : 7',
  plot: 'plot\nx: -5..5 y: -3..3 grid\ny = sin(x) {color: blue, label: "sin x"}\ny = x^2/4 - 1\npoint (1, 2) "A"',
  chart: 'chart bar\ntitle: Баллы по КР\nДискретка: 78\nАлгебра: 91',
  tree: 'tree\nA\n  B\n  C',
  array: 'array\n[5, 2, 9, 1, 7]\npointers: i, j\ncode:\nfor (let i = 0; i < a.length - 1; i++) {\n  for (let j = 0; j < a.length - 1 - i; j++) {\n    if (a[j] > a[j + 1]) {\n      let tmp = a[j];\n      a[j] = a[j + 1];\n      a[j + 1] = tmp;\n    }\n  }\n  done(a.length - 1 - i);\n}',
  diagram: 'diagram\nA: round "Вход"\nB: diamond "Условие"\nC: box "Действие"\nA -> B\nB -> C',
  canvas: 'canvas 400x200\nrect 20 20 120 60 "Вход" fill=#eef\narrow 140 50 -> 220 50\ncircle 260 50 r=30 "q0"\ntext 20 150 "Подпись"',
};
const labels = { graph: 'Граф', plot: 'График', chart: 'Диаграмма данных', tree: 'Дерево', array: 'Массив', diagram: 'Блок-схема', canvas: 'Холст' };
const arrayHelp = '<p>Всё после строки <code>code:</code> выполняется по шагам. Можно: let/const/int, for/while/if, функции, a[i], a.length, <code>swap(a, i, j)</code> или <code>swap(a[i], a[j])</code>, <code>[a[i], a[j]] = [a[j], a[i]]</code>, <code>done(i)</code> / <code>done(от, до)</code> — пометить готовые ячейки, <code>say("текст")</code> — свой комментарий к шагу, Math.floor и т. п.</p><p>Строки перед <code>code:</code>: <code>[значения]</code> — начальный массив; <code>pointers: i, j, lo, hi</code> — какие переменные рисовать стрелками (по умолчанию i, j, k); <code>watch: имя</code> — если массив называется не a; <code>print: first|last|N</code> — какой шаг попадёт в PDF (по умолчанию первый); <code>hidecode</code> — скрыть код. Без <code>code:</code> массив рисуется как раньше: <code>[5, 2, 9] i=1 j=2 highlight: 1 sorted: 0</code>.</p>';
const graphId = /^[\p{L}\p{N}_-]+$/u;
export function importGraphText(raw, format = 'edges') {
  const lines = raw.split(/\r?\n/).map(line => line.trim()).filter(Boolean), edges = [];
  if (!lines.length) throw new Error('Введите список рёбер или матрицу.');
  if (format === 'matrix') {
    const labels = lines.shift().split(/[\s,;]+/);
    if (labels.length > 50 || labels.some(id => !graphId.test(id)) || new Set(labels).size !== labels.length || lines.length !== labels.length) throw new Error('Первая строка — имена вершин; далее нужна квадратная матрица.');
    lines.forEach((line, i) => {
      const values = line.split(/[\s,;]+/);
      if (values.length === labels.length + 1 && values[0] === labels[i]) values.shift();
      if (values.length !== labels.length || values.some(value => !Number.isFinite(Number(value)))) throw new Error(`Строка ${i + 2}: ожидалось ${labels.length} чисел.`);
      values.forEach((value, j) => { if (Number(value)) edges.push(`${labels[i]} -> ${labels[j]} : ${Number(value)}`); });
    });
  } else {
    lines.forEach((line, i) => {
      const parts = line.split(/[\s,;]+/);
      if (parts.length < 2 || parts.length > 3 || !graphId.test(parts[0]) || !graphId.test(parts[1]) || (parts[2] !== undefined && !Number.isFinite(Number(parts[2])))) throw new Error(`Строка ${i + 1}: используйте «A B 5».`);
      edges.push(`${parts[0]} -> ${parts[1]}${parts[2] === undefined ? '' : ` : ${Number(parts[2])}`}`);
    });
  }
  if (edges.length > 500) throw new Error('Допустимо не больше 500 рёбер.');
  return edges.join('\n');
}
let language = 'graph', source = examples.graph, undo = [], redo = [], timer = 0, tool = 'select', selectedNode = '', selectedEdge = -1, edgeStart = '', scale = 1, panX = 0, panY = 0, lastSvg = '';
const editor = () => document.querySelector('#diagram-editor');
function saveDraft() { try { localStorage.setItem(draftKey, JSON.stringify({ language, source })); } catch {} }
function setSource(next, record = true) {
  if (next === source) return;
  if (record) { undo.push(source); if (undo.length > 100) undo.shift(); redo = []; }
  source = next; const input = document.querySelector('#diagram-source'); if (input && input.value !== next) input.value = next;
  saveDraft(); draw();
}
function draw() {
  if (!editor()) return;
  const preview = editor().querySelector('#diagram-preview'), error = editor().querySelector('#diagram-error');
  let errorLine = 0;
  try {
    const result = renderDiagram(language, source); lastSvg = result.svg;
    // Массив с кодом показываем живым плеером (его монтирует array-player.js); статичный SVG остаётся для экспорта и печати
    const live = Boolean(result.model.steps && result.model.steps.length > 1), step = preview.querySelector('.dgm-array-live')?._arrayPlayer?.step || 0;
    preview.innerHTML = live ? `<div class="diagram-image"><figure class="dgm-array-live" data-dgm-lang="array" data-dgm-src="${esc(source)}" data-start-step="${step}"><div class="dgm-art"><div class="arr-live"></div>${result.svg.replace(/^<svg /, '<svg class="dgm-print" ')}</div></figure></div>` : `<div class="diagram-image">${result.svg}</div>`;
    if (live) mountArrayPlayers(preview);
    error.textContent = '';
    applyTransform();
    renderInspector(result.model);
  } catch (failure) {
    lastSvg = ''; preview.innerHTML = '<p class="state">Исправьте текст, чтобы увидеть диаграмму.</p>'; error.textContent = failure.message || 'Ошибка диаграммы'; errorLine = Number(/Строка (\d+)/.exec(error.textContent)?.[1] || 0);
  }
  editor().querySelector('#diagram-lines').innerHTML = Array.from({ length: source.split('\n').length }, (_, i) => `<span class="${i + 1 === errorLine ? 'is-error' : ''}">${i + 1}</span>`).join('\n');
  editor().querySelector('[data-diagram-undo]').disabled = !undo.length;
  editor().querySelector('[data-diagram-redo]').disabled = !redo.length;
}
function renderInspector(model) {
  const slot = editor()?.querySelector('#diagram-inspector'); if (!slot) return;
  if (language === 'graph' && model.edges[selectedEdge]) {
    const edge = model.edges[selectedEdge];
    slot.innerHTML = `<div class="diagram-inspector-head">Ребро ${esc(edge.from)} → ${esc(edge.to)}</div><label>Вес / подпись<input data-edge-weight value="${esc(edge.weight)}"></label><label>Цвет<select data-edge-color>${['purple', 'red', 'blue', 'green', 'orange'].map(color => `<option value="${color}">${color}</option>`).join('')}</select></label><label>Направление<select data-edge-direction><option value="->" ${edge.directed ? 'selected' : ''}>Со стрелкой</option><option value="--" ${edge.directed ? '' : 'selected'}>Без стрелки</option></select></label><button type="button" class="btn2" data-edge-apply>Применить</button>`;
    return;
  }
  if (language === 'graph' && model.nodes.has(selectedNode)) {
    const node = model.nodes.get(selectedNode);
    slot.innerHTML = `<div class="diagram-inspector-head">Вершина ${esc(selectedNode)}</div><label>Подпись<input data-node-label value="${esc(node.label || node.id)}"></label><label>Цвет<select data-node-color>${['purple', 'red', 'blue', 'green', 'orange'].map(color => `<option value="${color}">${color}</option>`).join('')}</select></label><button type="button" class="btn2" data-node-apply>Применить</button>`;
    return;
  }
  if (language === 'diagram' && model.nodes.has(selectedNode)) {
    const node = model.nodes.get(selectedNode);
    slot.innerHTML = `<div class="diagram-inspector-head">Блок ${esc(selectedNode)}</div><label>Подпись<input data-node-label value="${esc(node.label)}"></label><label>Форма<select data-node-shape>${['box', 'round', 'diamond', 'circle', 'db', 'note'].map(shape => `<option value="${shape}" ${shape === node.shape ? 'selected' : ''}>${shape}</option>`).join('')}</select></label><button type="button" class="btn2" data-node-apply>Применить</button>`;
    return;
  }
  if (language === 'plot') { slot.innerHTML = `<div class="diagram-inspector-head">График и функции</div>${[['x0', model.x[0]], ['x1', model.x[1]], ['y0', model.y[0]], ['y1', model.y[1]]].map(([key, value]) => `<label>${key}<input type="number" step="any" data-plot-range="${key}" value="${value}"></label>`).join('')}${model.curves.map((curve, i) => `<label>y = <input data-plot-curve="${i}" value="${esc(curve.expr)}"></label>`).join('')}<p>«Точка» добавляет отметку нажатием на холст.</p>`; return; }
  if (language === 'chart') { slot.innerHTML = `<div class="diagram-inspector-head">Таблица данных</div><label>Тип<select data-chart-type>${[['bar', 'Столбцы'], ['line', 'Линии'], ['pie', 'Круг'], ['scatter', 'Точки']].map(([value, text]) => `<option value="${value}" ${model.type === value ? 'selected' : ''}>${text}</option>`).join('')}</select></label>${model.rows.map((row, i) => `<label>Строка ${i + 1}<input data-chart-row="${i}" value="${esc(row.values.length > 1 ? `${row.label} | ${row.values.join(' | ')}` : `${row.label}: ${row.values[0]}`)}"></label>`).join('')}`; return; }
  if (language === 'array') { slot.innerHTML = `<div class="diagram-inspector-head">Элементы массива</div><div class="diagram-inspector-cells">${model.values.map((value, i) => `<label>${i}<input data-array-cell="${i}" value="${esc(value)}"></label>`).join('')}</div>`; return; }
  if (language === 'tree') { slot.innerHTML = `<div class="diagram-inspector-head">Узлы дерева</div>${model.nodes.map((node, i) => `<label>Уровень ${node.depth}<input data-tree-node="${i}" value="${esc(node.label)}"></label>`).join('')}`; return; }
  if (language === 'canvas') { slot.innerHTML = `<div class="diagram-inspector-head">Фигуры</div><div class="diagram-inspector-cells">${['rect', 'circle', 'ellipse', 'line', 'arrow', 'text'].map(shape => `<button type="button" class="btn2" data-canvas-shape="${shape}">${shape}</button>`).join('')}</div><p>Нажмите фигуру, чтобы добавить её в центр холста.</p>`; return; }
  slot.innerHTML = '<p>Выберите объект на холсте, чтобы изменить его свойства.</p>';
}
function updateStructuredField(target) {
  const lines = source.split('\n');
  if (target.dataset.plotCurve !== undefined) {
    const matches = lines.map((line, i) => /^\s*y\s*=/.test(line) ? i : -1).filter(i => i >= 0), at = matches[Number(target.dataset.plotCurve)];
    if (at !== undefined) lines[at] = `y = ${target.value.trim()}`;
  } else if (target.dataset.plotRange !== undefined) {
    const values = Object.fromEntries([...editor().querySelectorAll('[data-plot-range]')].map(input => [input.dataset.plotRange, Number(input.value)]));
    if (Object.values(values).some(value => !Number.isFinite(value)) || values.x0 >= values.x1 || values.y0 >= values.y1) return;
    const at = lines.findIndex(line => /^\s*x:\s*/.test(line)), grid = parseDiagram('plot', source).grid ? ' grid' : '';
    if (at >= 0) lines[at] = `x: ${values.x0}..${values.x1} y: ${values.y0}..${values.y1}${grid}`;
    else lines.splice(1, 0, `x: ${values.x0}..${values.x1} y: ${values.y0}..${values.y1}${grid}`);
  } else if (target.dataset.chartType !== undefined) {
    const at = lines.findIndex(line => /^\s*chart\b/.test(line));
    if (at >= 0) lines[at] = `chart ${target.value}`;
  } else if (target.dataset.chartRow !== undefined) {
    const matches = lines.map((line, i) => /^(?!title:|caption:|series:|width:|height:).+[:|]/.test(line) ? i : -1).filter(i => i >= 0), at = matches[Number(target.dataset.chartRow)];
    if (at !== undefined) lines[at] = target.value.trim();
  } else if (target.dataset.arrayCell !== undefined) {
    const codeAt = lines.findIndex(line => /^\s*code\s*:/i.test(line)), at = lines.slice(0, codeAt < 0 ? lines.length : codeAt).findIndex(line => /\[[^\]]*\]/.test(line));
    if (at >= 0) { const values = parseDiagram('array', source).values; values[Number(target.dataset.arrayCell)] = target.value.trim(); lines[at] = lines[at].replace(/\[[^\]]*\]/, `[${values.join(', ')}]`); }
  } else if (target.dataset.treeNode !== undefined) {
    const matches = lines.map((line, i) => line.trim() && !/^(tree|title:|caption:|width:|height:|#|\/\/)/.test(line.trim()) ? i : -1).filter(i => i >= 0), at = matches[Number(target.dataset.treeNode)];
    if (at !== undefined) lines[at] = (lines[at].match(/^\s*/)?.[0] || '') + target.value.trim();
  }
  setSource(lines.join('\n'));
}
function applyNodeInspector() {
  const panel = editor()?.querySelector('#diagram-inspector'), label = panel?.querySelector('[data-node-label]')?.value.trim();
  if (!label || !selectedNode) return;
  const lines = source.split('\n');
  if (language === 'graph') {
    const color = panel.querySelector('[data-node-color]').value;
    const at = lines.findIndex(line => new RegExp(`^${selectedNode}(?:\\s+"|\\s*\\{|$)`).test(line.trim()));
    const definition = `${selectedNode} "${label.replace(/"/g, '')}" {color: ${color}}`;
    if (at >= 0) lines[at] = definition; else lines.push(definition);
  } else if (language === 'diagram') {
    const shape = panel.querySelector('[data-node-shape]').value, at = lines.findIndex(line => line.trim().startsWith(`${selectedNode}:`));
    if (at >= 0) { const position = /\s*@\s*-?[\d.]+,\s*-?[\d.]+\s*$/.exec(lines[at])?.[0] || ''; lines[at] = `${selectedNode}: ${shape} "${label.replace(/"/g, '')}"${position}`; }
  }
  setSource(lines.join('\n'));
}
function applyEdgeInspector() {
  const model = parseDiagram('graph', source), edge = model.edges[selectedEdge], panel = editor()?.querySelector('#diagram-inspector');
  if (!edge || !panel) return;
  const lines = source.split('\n'), pattern = new RegExp(`^${edge.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(?:->|--)\\s*${edge.to.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|:|$)`);
  const matches = lines.map((line, i) => pattern.test(line.trim()) ? i : -1).filter(i => i >= 0);
  const earlier = model.edges.slice(0, selectedEdge).filter(other => other.from === edge.from && other.to === edge.to).length, at = matches[earlier];
  if (at === undefined) return;
  const weight = panel.querySelector('[data-edge-weight]').value.trim().replace(/[{}]/g, ''), color = panel.querySelector('[data-edge-color]').value, direction = panel.querySelector('[data-edge-direction]').value;
  lines[at] = `${edge.from} ${direction} ${edge.to}${weight ? ` : ${weight}` : ''} {color: ${color}}`;
  setSource(lines.join('\n'));
}
function applyTransform() { const image = editor()?.querySelector('.diagram-image'); if (image) image.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`; }
function encodedShare() { return utf8Base64(source).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''); }
function currentSvgElement() { const live = editor()?.querySelector('#diagram-preview .dgm-array-live'); return live ? frameSvg(live) : editor()?.querySelector('#diagram-preview svg'); }
function resolvedSvg(element) {
  const clone = element.cloneNode(true), box = clone.viewBox.baseVal;
  clone.setAttribute('width', String(box.width || 640)); clone.setAttribute('height', String(box.height || 360));
  return clone.outerHTML.replace(/var\((--[a-z0-9-]+)\)/g, (_, name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#222222');
}
function downloadBlob(blob, filename) { const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
async function pngBlob(element, background = 'transparent') {
  const value = resolvedSvg(element), box = element.viewBox.baseVal, image = new Image(), url = URL.createObjectURL(new Blob([value], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = url; });
    const canvas = document.createElement('canvas'); canvas.width = box.width * 2; canvas.height = box.height * 2;
    const context = canvas.getContext('2d');
    if (background !== 'transparent') { context.fillStyle = background === 'dark' ? '#11131b' : '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height); }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  } finally { URL.revokeObjectURL(url); }
}
async function exportImage(format, element = currentSvgElement(), background = 'transparent') {
  if (!element) return;
  if (format === 'svg') downloadBlob(new Blob([resolvedSvg(element)], { type: 'image/svg+xml;charset=utf-8' }), 'diagram.svg');
  else { const blob = await pngBlob(element, background); if (blob) downloadBlob(blob, 'diagram.png'); }
}
function scenePoint(event, snap = true) {
  const svg = currentSvgElement(), point = svg.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
  const mapped = point.matrixTransform(svg.getScreenCTM().inverse());
  return { x: snap ? Math.round(mapped.x / 10) * 10 : mapped.x, y: snap ? Math.round(mapped.y / 10) * 10 : mapped.y };
}
export function plotCoordinates(point, model) {
  const width = Math.max(120, Math.min(1600, model.width || 640)), height = Math.max(120, Math.min(1600, model.height || 360));
  const x = model.x[0] + (Math.max(42, Math.min(width - 42, point.x)) - 42) / (width - 84) * (model.x[1] - model.x[0]);
  const y = model.y[1] - (Math.max(42, Math.min(height - 42, point.y)) - 42) / (height - 84) * (model.y[1] - model.y[0]);
  return { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
}
function nextId() {
  const model = parseDiagram(language, source);
  let i = 1; while (model.nodes?.has(`N${i}`)) i++;
  return `N${i}`;
}
function moveNode(id, point) {
  const lines = source.split('\n'), position = `${id} @ ${point.x},${point.y}`;
  if (language === 'graph') {
    const at = lines.findIndex(line => line.trim().startsWith(`${id} @`));
    if (at >= 0) lines[at] = position; else lines.push(position);
  } else if (language === 'diagram') {
    const at = lines.findIndex(line => line.trim().startsWith(`${id}:`));
    if (at >= 0) lines[at] = lines[at].replace(/\s*@\s*-?[\d.]+,\s*-?[\d.]+\s*$/, '') + ` @ ${point.x},${point.y}`;
  }
  setSource(lines.join('\n'));
}
function moveCanvasShape(index, deltaX, deltaY) {
  const lines = source.split('\n'), matches = lines.map((line, i) => /^(rect|circle|ellipse|line|arrow|text|path)\s/.test(line.trim()) ? i : -1).filter(i => i >= 0), at = matches[index];
  if (at === undefined) return;
  const shape = parseDiagram('canvas', source).shapes[index];
  if (shape.type === 'path') return;
  const x = Number(shape.parts[0]) + deltaX, y = Number(shape.parts[1]) + deltaY;
  let line = lines[at].replace(/^(\s*\w+\s+)-?[\d.]+\s+-?[\d.]+/, (_, prefix) => `${prefix}${x} ${y}`);
  if (shape.type === 'line' || shape.type === 'arrow') {
    const oldX = Number(shape.parts[shape.parts[2] === '->' ? 3 : 2]), oldY = Number(shape.parts[shape.parts[2] === '->' ? 4 : 3]);
    line = `${shape.type} ${x} ${y}${shape.type === 'arrow' ? ' ->' : ''} ${oldX + deltaX} ${oldY + deltaY}`;
  }
  lines[at] = line; setSource(lines.join('\n'));
}
function addAt(point) {
  if (language === 'graph') setSource(`${source.trim()}\n${nextId()} @ ${point.x},${point.y}`);
  if (language === 'diagram') setSource(`${source.trim()}\n${nextId()}: box "Новый блок" @ ${point.x},${point.y}`);
  if (language === 'plot') { const value = plotCoordinates(point, parseDiagram('plot', source)); setSource(`${source.trim()}\npoint (${value.x}, ${value.y}) "P"`); }
  if (language === 'canvas') setSource(`${source.trim()}\nrect ${point.x} ${point.y} 100 55 "Блок"`);
}
function deleteSelection() {
  if (language === 'graph' && selectedEdge >= 0) {
    const edge = parseDiagram('graph', source).edges[selectedEdge];
    if (edge) { let seen = 0; const earlier = parseDiagram('graph', source).edges.slice(0, selectedEdge).filter(item => item.from === edge.from && item.to === edge.to).length; setSource(source.split('\n').filter(line => { const matches = line.trim().startsWith(`${edge.from} -> ${edge.to}`) || line.trim().startsWith(`${edge.from} -- ${edge.to}`); return !matches || seen++ !== earlier; }).join('\n')); }
    selectedEdge = -1; return;
  }
  if (!selectedNode || !['graph', 'diagram'].includes(language)) return;
  const id = selectedNode;
  setSource(source.split('\n').filter(line => !line.trim().startsWith(`${id} @`) && !line.trim().startsWith(`${id}:`) && !new RegExp(`^${id}\\s*(?:->|--)|(?:->|--)\\s*${id}(?:\\s|$)`).test(line) && line.trim() !== id).join('\n'));
  selectedNode = '';
}
function addByType(type) {
  if (type === 'graph') { tool = 'add'; return; }
  if (type === 'diagram') { tool = 'add'; return; }
  if (type === 'plot') { const expression = prompt('Введите y = f(x):', 'x^2'); if (expression) setSource(`${source.trim()}\ny = ${expression}`); return; }
  if (type === 'chart') { const row = prompt('Введите «Название: число»:', 'Новый предмет: 50'); if (row) setSource(`${source.trim()}\n${row}`); return; }
  if (type === 'tree') { const label = prompt('Подпись узла:', 'Новый'); if (label) setSource(`${source.trim()}\n  ${label}`); return; }
  if (type === 'array') { const value = prompt('Значение элемента:', '0'); if (value == null) return; const codeAt = source.search(/^\s*code\s*:/im), head = codeAt < 0 ? source : source.slice(0, codeAt); setSource(head.replace(/\[([^\]]*)\]/, (_, items) => `[${items.trim() ? items + ', ' : ''}${value}]`) + (codeAt < 0 ? '' : source.slice(codeAt))); return; }
  if (type === 'canvas') { tool = 'add'; }
}
async function saveToRepo(form) {
  const status = form.querySelector('#diagram-save-status'), element = currentSvgElement();
  if (!element) { status.textContent = 'Сначала исправьте диаграмму.'; return; }
  const token = form.elements.token.value.trim(); if (token) saveToken(token, form.elements.remember.checked);
  if (!getToken()) { status.textContent = 'Укажите GitHub токен с правом Contents: Read and write.'; return; }
  const folder = form.elements.folder.value.trim().replace(/\/+$/, ''), name = form.elements.filename.value.trim(), format = form.elements.format.value;
  if (!/^[\p{L}\p{N} _/-]+$/u.test(folder) || folder.split('/').some(part => !part || part === '..' || part === '.') || !/^[\p{L}\p{N}_-]+$/u.test(name)) { status.textContent = 'Проверьте папку и имя файла.'; return; }
  const path = `${folder}/${name}.${format}`;
  try {
    status.textContent = 'Проверяем файл на GitHub…';
    const existing = await readRepoFileOptional(path);
    if (existing && !confirm('Файл уже существует. Перезаписать?')) return;
    let encoded = format === 'svg' ? utf8Base64(resolvedSvg(element)) : '';
    if (format === 'png') { const blob = await pngBlob(element, form.elements.background.value); encoded = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.readAsDataURL(blob); }); }
    status.textContent = 'Сохраняем изображение…';
    await writeRepoFileBase64(path, encoded, `Добавить диаграмму ${name}.${format}`, existing?.sha);
    // Ссылка от корня репозитория: из конспекта в любой папке она указывает на один и тот же файл
    const markdown = `![${name}](/${path.split('/').map(encodeURIComponent).join('/')})`;
    try { await navigator.clipboard.writeText(markdown); status.textContent = `Сохранено: ${path}. Markdown-ссылка скопирована.`; }
    catch { status.textContent = `Сохранено: ${path}. Ссылка: ${markdown}`; }
  } catch (error) { status.textContent = error.message || 'Не удалось сохранить изображение.'; }
}
export function renderDiagramEditor() {
  let fromLink = null;
  try { const query = new URLSearchParams(location.hash.split('?')[1] || ''); if (query.has('src')) fromLink = { language: query.get('lang'), source: base64Utf8(query.get('src').replace(/-/g, '+').replace(/_/g, '/')) }; } catch { /* Неизвестная ссылка. */ }
  try { const saved = JSON.parse(localStorage.getItem(draftKey) || 'null'); if (saved && diagramLanguages().includes(saved.language)) { language = saved.language; source = saved.source; } } catch {}
  if (fromLink && diagramLanguages().includes(fromLink.language) && fromLink.source.length < 12000) { language = fromLink.language; source = fromLink.source; }
  document.querySelector('#content').innerHTML = `<section class="diagram-page" id="diagram-editor"><div class="intro diagram-intro"><span class="sched-eyebrow">ВИЗУАЛЬНАЯ ЛАБОРАТОРИЯ · М3102</span><h1>Диаграммы</h1><p class="sub">Соберите граф, функцию или схему и вставьте её в конспект.</p></div><div class="diagram-toolbar"><label>Тип <select id="diagram-language">${diagramLanguages().map(lang => `<option value="${lang}" ${language === lang ? 'selected' : ''}>${labels[lang]}</option>`).join('')}</select></label><div class="diagram-template-picker">${diagramLanguages().map(lang => `<button type="button" data-diagram-template="${lang}">${labels[lang]}</button>`).join('')}</div></div><div class="diagram-tools"><button class="btn2" data-diagram-tool="select" aria-pressed="true">Выбрать</button><button class="btn2" data-diagram-add>＋ Добавить</button><button class="btn2" data-diagram-tool="edge">Соединить</button>${language === 'graph' ? '<button class="btn2" data-diagram-import>Импорт</button>' : ''}${language === 'plot' ? '<button class="btn2" data-diagram-tool="add">Точка</button>' : ''}<button class="btn2" data-diagram-delete>Удалить</button><button class="btn2" data-diagram-layout>Авто-раскладка</button><button class="btn2" data-diagram-undo>↶ Отменить</button><button class="btn2" data-diagram-redo>↷ Повторить</button><button class="btn2" data-diagram-zoom="in">＋</button><button class="btn2" data-diagram-zoom="out">−</button><button class="btn2" data-diagram-zoom="reset">100%</button></div><div class="diagram-workspace"><section class="diagram-canvas"><div class="diagram-panel-head"><span>Визуальный холст</span><span id="diagram-tool-label">Перетащите вершину или выберите инструмент</span></div><div id="diagram-preview" class="diagram-preview"></div><div id="diagram-inspector" class="diagram-inspector"></div></section><section class="diagram-source"><div class="diagram-panel-head"><span>Исходный текст</span><button data-diagram-copy-md>Копировать Markdown</button></div><div class="diagram-source-wrap"><pre id="diagram-lines" aria-hidden="true"></pre><textarea id="diagram-source" spellcheck="false" aria-label="Текст диаграммы">${esc(source)}</textarea></div><p id="diagram-error" class="diagram-error" role="alert"></p></section></div><div class="diagram-tools"><button class="btn2" data-diagram-copy-svg>Копировать SVG</button><button class="btn2" data-diagram-export="svg">Скачать SVG</button><button class="btn2" data-diagram-export="png">Скачать PNG</button><button class="btn2" data-diagram-share>Скопировать ссылку</button><button class="btn2 btn-primary" data-diagram-save>Сохранить в репозиторий</button></div><div class="diagram-help"><details><summary>Синтаксис и примеры</summary><p>В начале укажите тип: graph, plot, chart, tree, array, diagram или canvas. Поддержаны title: и caption:.</p><pre>${esc(examples[language])}</pre>${language === 'array' ? arrayHelp : ''}</details><p>Черновик хранится в браузере. На холсте: колесо — масштаб, пробел и перетаскивание — панорама, перетаскивание вершины — позиция, Ctrl/⌘+Z — отмена.</p></div></section>`;
  draw();
}
export function installDiagramEditor() {
  document.body.insertAdjacentHTML('beforeend', `<dialog id="diagram-save-dialog" class="app-dialog"><form id="diagram-save-form"><div class="dialog-head"><h2>Сохранить диаграмму</h2><button type="button" data-close-dialog aria-label="Закрыть">×</button></div><label class="sched-field">Папка в репозитории<input name="folder" required value="${DEFAULT_FOLDER}"></label><label class="sched-field">Имя файла<input name="filename" required value="diagram"></label><label class="sched-field">Формат<select name="format"><option value="svg">SVG</option><option value="png">PNG</option></select></label><label class="sched-field">Фон PNG<select name="background"><option value="transparent">Прозрачный</option><option value="white">Белый</option><option value="dark">Тёмный</option></select></label><label class="sched-field">Fine-grained PAT<input type="password" name="token" autocomplete="off" placeholder="Если токен ещё не сохранён"></label><label class="sched-checkbox"><input type="checkbox" name="remember"> Запомнить токен на этом устройстве</label><p class="dialog-hint">Токену нужен доступ к этому репозиторию с правом Contents: Read and write.</p><p class="diagram-save-status" id="diagram-save-status" aria-live="polite"></p><div class="dialog-actions"><button type="button" class="btn2" data-close-dialog>Отмена</button><button type="submit" class="btn2 btn-primary">Сохранить</button></div></form></dialog>`);
  document.body.insertAdjacentHTML('beforeend', `<dialog id="diagram-import-dialog" class="app-dialog"><form id="diagram-import-form"><div class="dialog-head"><h2>Импорт графа</h2><button type="button" data-close-dialog aria-label="Закрыть">×</button></div><label class="sched-field">Формат<select name="format"><option value="edges">Список рёбер: A B 5</option><option value="matrix">Матрица смежности</option></select></label><label class="sched-field">Данные<textarea name="data" rows="8" placeholder="A B 5&#10;B C 2" required></textarea></label><p class="dialog-hint">Матрица: первая строка — имена вершин, затем по одной строке чисел. Ноль означает отсутствие ребра.</p><p id="diagram-import-error" class="form-error" role="alert"></p><div class="dialog-actions"><button type="button" class="btn2" data-close-dialog>Отмена</button><button type="submit" class="btn2 btn-primary">Добавить в граф</button></div></form></dialog>`);
  document.addEventListener('input', event => { if (event.target.id !== 'diagram-source') return; clearTimeout(timer); const next = event.target.value; timer = setTimeout(() => setSource(next), 170); });
  document.addEventListener('change', event => { if (event.target.id === 'diagram-language') { language = event.target.value; source = examples[language]; undo = []; redo = []; selectedNode = ''; saveDraft(); renderDiagramEditor(); } else if (event.target.closest('#diagram-inspector') && event.target.matches('[data-plot-curve],[data-plot-range],[data-chart-type],[data-chart-row],[data-array-cell],[data-tree-node]')) updateStructuredField(event.target); });
  document.addEventListener('click', async event => {
    const button = event.target.closest('button'); if (!button || !editor()) return;
    if (button.dataset.diagramTemplate) { language = button.dataset.diagramTemplate; source = examples[language]; undo = []; redo = []; saveDraft(); renderDiagramEditor(); return; }
    if (button.dataset.diagramTool) { tool = button.dataset.diagramTool; editor().querySelectorAll('[data-diagram-tool]').forEach(item => item.setAttribute('aria-pressed', String(item.dataset.diagramTool === tool))); editor().querySelector('#diagram-tool-label').textContent = tool === 'edge' ? 'Соедините две вершины' : tool === 'add' ? 'Нажмите на холст' : 'Выберите и переместите вершину'; return; }
    if (button.dataset.diagramAdd !== undefined) return addByType(language);
    if (button.dataset.diagramImport !== undefined) return document.querySelector('#diagram-import-dialog').showModal();
    if (button.dataset.diagramDelete !== undefined) return deleteSelection();
    if (button.dataset.diagramLayout !== undefined && language === 'graph') return setSource(source.replace(/^layout:\s*\w+$/m, 'layout: circle'));
    if (button.dataset.diagramUndo !== undefined && undo.length) { redo.push(source); setSource(undo.pop(), false); return; }
    if (button.dataset.diagramRedo !== undefined && redo.length) { undo.push(source); setSource(redo.pop(), false); return; }
    if (button.dataset.diagramZoom) { scale = button.dataset.diagramZoom === 'reset' ? 1 : Math.max(.35, Math.min(3, scale * (button.dataset.diagramZoom === 'in' ? 1.2 : .83))); if (button.dataset.diagramZoom === 'reset') panX = panY = 0; applyTransform(); return; }
    if (button.dataset.diagramCopyMd !== undefined) return navigator.clipboard.writeText(`\`\`\`${language}\n${source.trim()}\n\`\`\``);
    if (button.dataset.diagramCopySvg !== undefined && currentSvgElement()) return navigator.clipboard.writeText(resolvedSvg(currentSvgElement()));
    if (button.dataset.diagramExport) return exportImage(button.dataset.diagramExport);
    if (button.dataset.diagramShare !== undefined) return navigator.clipboard.writeText(`${location.origin}${location.pathname}#/diagrams?lang=${language}&src=${encodedShare()}`).then(() => { button.textContent = 'Ссылка скопирована'; });
    if (button.dataset.diagramSave !== undefined) return document.querySelector('#diagram-save-dialog').showModal();
    if (button.dataset.nodeApply !== undefined) return applyNodeInspector();
    if (button.dataset.edgeApply !== undefined) return applyEdgeInspector();
    if (button.dataset.canvasShape) { const shape = button.dataset.canvasShape, command = { rect: 'rect 100 70 120 60 "Блок"', circle: 'circle 180 100 r=30 "Узел"', ellipse: 'ellipse 180 100 60 30 "Овал"', line: 'line 100 100 250 100', arrow: 'arrow 100 100 -> 250 100', text: 'text 100 100 "Подпись"' }[shape]; return setSource(`${source.trim()}\n${command}`); }
  });
  document.addEventListener('submit', event => {
    if (event.target.id === 'diagram-save-form') { event.preventDefault(); saveToRepo(event.target); }
    if (event.target.id === 'diagram-import-form') { event.preventDefault(); try { setSource(`${source.trim()}\n${importGraphText(event.target.elements.data.value, event.target.elements.format.value)}`); event.target.closest('dialog').close(); } catch (error) { event.target.querySelector('#diagram-import-error').textContent = error.message; } }
  });
  let drag = null, space = false;
  document.addEventListener('keydown', event => {
    if (!editor()) return;
    if (event.code === 'Space' && !/^(TEXTAREA|INPUT)$/.test(document.activeElement?.tagName)) { space = true; event.preventDefault(); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && document.activeElement?.id !== 'diagram-source') { event.preventDefault(); editor().querySelector(event.shiftKey ? '[data-diagram-redo]' : '[data-diagram-undo]')?.click(); }
    if ((event.key === 'Delete' || event.key === 'Backspace') && document.activeElement?.id !== 'diagram-source') deleteSelection();
  });
  document.addEventListener('keyup', event => { if (event.code === 'Space') space = false; });
  document.addEventListener('wheel', event => { if (!event.target.closest('#diagram-preview') || event.target.closest('.arr-live')) return; event.preventDefault(); scale = Math.max(.35, Math.min(3, scale * (event.deltaY < 0 ? 1.1 : .9))); applyTransform(); }, { passive: false });
  document.addEventListener('pointerdown', event => {
    if (!event.target.closest('#diagram-preview svg')) return;
    const node = event.target.closest('[data-dgm-node]');
    if (space) { drag = { pan: true, x: event.clientX, y: event.clientY, oldX: panX, oldY: panY }; return; }
    if (node) {
      selectedNode = node.dataset.dgmNode; selectedEdge = -1;
      renderInspector(parseDiagram(language, source));
      if (tool === 'edge') { if (!edgeStart) { edgeStart = selectedNode; drag = { edgeFrom: selectedNode, x: event.clientX, y: event.clientY }; } else { setSource(`${source.trim()}\n${edgeStart} -> ${selectedNode}`); edgeStart = ''; } return; }
      drag = { node: selectedNode, x: event.clientX, y: event.clientY };
      return;
    }
    const edge = event.target.closest('[data-dgm-edge]');
    if (edge) { selectedEdge = Number(edge.dataset.dgmEdge); selectedNode = ''; renderInspector(parseDiagram(language, source)); return; }
    const shape = event.target.closest('[data-dgm-shape]');
    if (shape && language === 'canvas') { drag = { shape: Number(shape.dataset.dgmShape), point: scenePoint(event), x: event.clientX, y: event.clientY }; return; }
    if (tool === 'add') { addAt(scenePoint(event, language !== 'plot')); tool = 'select'; }
  });
  document.addEventListener('pointermove', event => { if (drag?.pan) { panX = drag.oldX + event.clientX - drag.x; panY = drag.oldY + event.clientY - drag.y; applyTransform(); } });
  document.addEventListener('pointerup', event => { if (drag?.edgeFrom && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 5) { const to = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-dgm-node]')?.dataset.dgmNode; if (to) { setSource(`${source.trim()}\n${drag.edgeFrom} -> ${to}`); edgeStart = ''; } } if (drag?.node && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 5 && currentSvgElement()) moveNode(drag.node, scenePoint(event)); if (drag?.shape !== undefined && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 5 && currentSvgElement()) { const point = scenePoint(event); moveCanvasShape(drag.shape, point.x - drag.point.x, point.y - drag.point.y); } drag = null; });
}

export function bindNoteDiagrams(container) {
  mountArrayPlayers(container);
  container.addEventListener('click', async event => {
    const figure = event.target.closest('.dgm'); if (!figure) return;
    const live = figure.classList.contains('dgm-array-live'), image = live ? frameSvg(figure) : figure.querySelector('svg'); if (!image) return;
    if (event.target.closest('[data-dgm-copy]')) return navigator.clipboard.writeText(resolvedSvg(image));
    const save = event.target.closest('[data-dgm-save]'); if (save) return exportImage(save.dataset.dgmSave, image);
    if (event.target.closest('[data-dgm-edit]')) { const src = utf8Base64(figure.dataset.dgmSrc).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''); location.hash = `#/diagrams?lang=${figure.dataset.dgmLang}&src=${src}`; return; }
    if (!live && event.target.closest('.dgm-art')) { const box = document.createElement('div'); box.className = 'img-lightbox'; box.append(image.cloneNode(true)); box.onclick = () => box.remove(); document.body.append(box); }
  });
}
