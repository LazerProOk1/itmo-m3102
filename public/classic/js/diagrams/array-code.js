/*
  Безопасный интерпретатор маленького JS/C-подобного языка для диаграммы `array`.
  Никакого eval / new Function: код разбирается в AST и выполняется вручную, поэтому
  конспект не может добраться ни до window, ни до localStorage (там лежит GitHub-токен).

  Результат — список «шагов». Шаг = снимок массива, указателей, переменных и подпись операции
  (сравнение, запись, обмен, загрузка в переменную, сдвиг указателя, say(...)).
  Это чистая функция: работает и в браузере, и в Node.

  Несколько массивов:
  - основной массив (watch, по умолчанию `a`) рисуется всегда;
  - буферы — массивы из строки `buffers: buf, tmp`: появляются при создании и остаются на экране до конца;
  - временные — любые другие массивы, лежащие в переменных (`let left = a.slice(l, m)`, параметры функций):
    видны, пока их переменная в области видимости, потом исчезают.
  Создавать массивы можно так: `[]`, `[1, 2]`, `new Array(n)`, `Array(n).fill(0)`, `a.slice(l, r)`, C-style `int buf[n];`.
  Указатель можно привязать к массиву: `pointers: i, l, k@buf` (по умолчанию указатель живёт на основном массиве).
*/

const MAX_TICKS = 300000, MAX_STEPS = 500, MAX_DEPTH = 200, MAX_CODE = 8000, MAX_LEN = 200;
const TYPES = new Set(['let', 'const', 'var', 'int', 'long', 'short', 'double', 'float', 'auto', 'number', 'bool', 'boolean', 'string', 'char', 'unsigned', 'size_t', 'void']);
const OPS3 = ['===', '!==', '>>>'];
const OPS2 = ['==', '!=', '<=', '>=', '&&', '||', '++', '--', '+=', '-=', '*=', '/=', '%=', '**', '<<', '>>'];
const PREC = { '||': 1, '&&': 2, '|': 3, '^': 4, '&': 5, '==': 6, '!=': 6, '===': 6, '!==': 6, '<': 7, '>': 7, '<=': 7, '>=': 7, '<<': 8, '>>': 8, '>>>': 8, '+': 9, '-': 9, '*': 10, '/': 10, '%': 10, '**': 11 };
const CMP = new Set(['<', '>', '<=', '>=', '==', '!=', '===', '!==']);
const ASSIGN = new Set(['=', '+=', '-=', '*=', '/=', '%=']);
const MATH = { floor: Math.floor, ceil: Math.ceil, round: Math.round, trunc: Math.trunc, abs: Math.abs, sqrt: Math.sqrt, min: Math.min, max: Math.max, pow: Math.pow, sign: Math.sign, log2: Math.log2 };
const LITERALS = { true: true, false: false, null: null, undefined: undefined, NaN: NaN, Infinity: Infinity };

class StepLimit extends Error {}

export function fmtVal(v) {
  if (v === undefined) return '·';
  if (v === null) return 'null';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Math.round(v * 1000) / 1000);
  if (Array.isArray(v)) return '[…]';
  if (typeof v === 'object') return '{…}';
  return String(v);
}

/* ---------- лексер ---------- */
function tokenize(code, fail) {
  const tokens = [], num = /(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/iy, id = /[A-Za-z_$\u0400-\u04FF][\w$\u0400-\u04FF]*/uy;
  let i = 0, line = 1, nl = false;
  const push = (type, value, start) => { tokens.push({ type, value, line, nl, start, end: i }); nl = false; };
  while (i < code.length) {
    const ch = code[i];
    if (ch === '\n') { line++; nl = true; i++; continue; }
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '/' && code[i + 1] === '/') { while (i < code.length && code[i] !== '\n') i++; continue; }
    if (ch === '/' && code[i + 1] === '*') { const end = code.indexOf('*/', i + 2), stop = end < 0 ? code.length : end + 2; for (const c of code.slice(i, stop)) if (c === '\n') { line++; nl = true; } i = stop; continue; }
    const start = i;
    num.lastIndex = i; id.lastIndex = i;
    let m;
    if ((ch >= '0' && ch <= '9') || (ch === '.' && /\d/.test(code[i + 1] || ''))) { m = num.exec(code); i += m[0].length; push('num', Number(m[0]), start); continue; }
    if ((m = id.exec(code))) { i += m[0].length; push('id', m[0], start); continue; }
    if (ch === '"' || ch === "'") {
      let value = ''; i++;
      while (i < code.length && code[i] !== ch) { if (code[i] === '\n') fail(line, 'строка не закрыта'); if (code[i] === '\\') { i++; value += ({ n: '\n', t: '\t' })[code[i]] ?? code[i]; } else value += code[i]; i++; }
      if (code[i] !== ch) fail(line, 'строка не закрыта');
      i++; push('str', value, start); continue;
    }
    const three = code.slice(i, i + 3), two = code.slice(i, i + 2);
    if (OPS3.includes(three)) { i += 3; push('op', three, start); continue; }
    if (OPS2.includes(two)) { i += 2; push('op', two, start); continue; }
    if ('+-*/%=<>!&|^~?:;,.()[]{}'.includes(ch)) { i++; push('op', ch, start); continue; }
    fail(line, `недопустимый символ «${ch}»`);
  }
  tokens.push({ type: 'eof', value: '', line, nl: true, start: code.length, end: code.length });
  return tokens;
}

/* ---------- парсер ---------- */
class Parser {
  constructor(tokens, fail) { this.t = tokens; this.p = 0; this.fail = fail; }
  get tok() { return this.t[this.p]; }
  next() { return this.t[this.p++]; }
  isOp(v, k = this.tok) { return k.type === 'op' && k.value === v; }
  isKw(v, k = this.tok) { return k.type === 'id' && k.value === v; }
  accept(v) { if (this.isOp(v)) { this.p++; return true; } return false; }
  expect(v) { if (!this.accept(v)) this.fail(this.tok.line, `ожидалось «${v}»${this.tok.type === 'eof' ? '' : `, найдено «${this.tok.value}»`}`); }
  program() { const body = []; while (this.tok.type !== 'eof') body.push(this.statement()); return body; }
  endStatement() { this.accept(';'); }
  block() { const line = this.tok.line; this.expect('{'); const body = []; while (!this.isOp('}')) { if (this.tok.type === 'eof') this.fail(line, 'не закрыта скобка «{»'); body.push(this.statement()); } this.next(); return { t: 'block', body, line }; }
  declStart() { let q = this.p; if (!(this.tok.type === 'id' && TYPES.has(this.tok.value))) return false; while (this.t[q].type === 'id' && TYPES.has(this.t[q].value)) q++; return this.t[q].type === 'id' && !TYPES.has(this.t[q].value); }
  skipTypes() { while (this.tok.type === 'id' && TYPES.has(this.tok.value)) this.p++; }
  declaration() {
    const line = this.tok.line; this.skipTypes(); const decls = [];
    do { const name = this.next(); if (name.type !== 'id') this.fail(name.line, 'ожидалось имя переменной'); let init = null; if (this.isOp('[')) { this.p++; const size = this.expression(), close = this.tok; this.expect(']'); init = { t: 'alloc', size, line: name.line, start: name.start, end: close.end }; } if (this.accept('=')) init = this.assignment(); decls.push({ name: name.value, init, line: name.line }); } while (this.accept(','));
    return { t: 'var', decls, line };
  }
  funcDecl() {
    const line = this.tok.line;
    if (this.isKw('function')) this.p++; else this.skipTypes();
    const name = this.next(); if (name.type !== 'id') this.fail(name.line, 'ожидалось имя функции');
    this.expect('('); const params = [];
    while (!this.isOp(')')) { this.skipTypes(); this.accept('&'); this.accept('*'); const p = this.next(); if (p.type !== 'id') this.fail(p.line, 'ожидалось имя параметра'); params.push(p.value); if (this.accept('[')) this.expect(']'); if (!this.accept(',')) break; }
    this.expect(')');
    return { t: 'func', name: name.value, params, body: this.block(), line };
  }
  statement() {
    const k = this.tok, line = k.line;
    if (this.isOp('{')) return this.block();
    if (this.accept(';')) return { t: 'empty', line };
    if (k.type === 'id') {
      switch (k.value) {
        case 'if': { this.p++; this.expect('('); const test = this.expression(); this.expect(')'); const then = this.statement(); let other = null; if (this.isKw('else')) { this.p++; other = this.statement(); } return { t: 'if', test, then, other, line }; }
        case 'while': { this.p++; this.expect('('); const test = this.expression(); this.expect(')'); return { t: 'while', test, body: this.statement(), line }; }
        case 'do': { this.p++; const body = this.statement(); if (!this.isKw('while')) this.fail(this.tok.line, 'ожидалось while'); this.p++; this.expect('('); const test = this.expression(); this.expect(')'); this.endStatement(); return { t: 'do', test, body, line }; }
        case 'for': {
          this.p++; this.expect('('); let init = null, test = null, update = null;
          if (!this.isOp(';')) init = this.declStart() ? this.declaration() : { t: 'expr', expr: this.sequence(), line };
          this.expect(';'); if (!this.isOp(';')) test = this.expression(); this.expect(';'); if (!this.isOp(')')) update = this.sequence(); this.expect(')');
          return { t: 'for', init, test, update, body: this.statement(), line };
        }
        case 'break': this.p++; this.endStatement(); return { t: 'break', line };
        case 'continue': this.p++; this.endStatement(); return { t: 'continue', line };
        case 'return': { this.p++; let value = null; if (!this.isOp(';') && !this.isOp('}') && !this.tok.nl && this.tok.type !== 'eof') value = this.expression(); this.endStatement(); return { t: 'return', value, line }; }
        case 'function': return this.funcDecl();
      }
      if (this.declStart()) {
        let q = this.p; while (this.t[q].type === 'id' && TYPES.has(this.t[q].value)) q++;
        if (this.isOp('(', this.t[q + 1])) return this.funcDecl();
        const d = this.declaration(); this.endStatement(); return d;
      }
    }
    const expr = this.sequence(); this.endStatement();
    return { t: 'expr', expr, line };
  }
  sequence() { const first = this.expression(); if (!this.isOp(',')) return first; const items = [first]; while (this.accept(',')) items.push(this.expression()); return { t: 'seq', items, line: first.line, start: first.start, end: items.at(-1).end }; }
  expression() { return this.assignment(); }
  lvalue(node) { if (node.t !== 'id' && node.t !== 'idx') this.fail(node.line, 'слева от «=» ожидалась переменная или элемент массива'); return node; }
  assignment() {
    const first = this.tok;
    if (this.isOp('[')) { // [a[i], a[j]] = [a[j], a[i]]
      let depth = 0, q = this.p;
      for (; this.t[q].type !== 'eof'; q++) { if (this.isOp('[', this.t[q])) depth++; else if (this.isOp(']', this.t[q]) && --depth === 0) break; }
      if (this.isOp('=', this.t[q + 1])) {
        this.p++; const targets = [];
        while (!this.isOp(']')) { targets.push(this.lvalue(this.conditional())); if (!this.accept(',')) break; }
        this.expect(']'); this.expect('=');
        const value = this.assignment();
        return { t: 'destr', targets, value, line: first.line, start: first.start, end: value.end };
      }
    }
    const left = this.conditional();
    if (this.tok.type === 'op' && ASSIGN.has(this.tok.value)) {
      const op = this.next().value; this.lvalue(left); const value = this.assignment();
      return { t: 'asg', op, target: left, value, line: left.line, start: left.start, end: value.end };
    }
    return left;
  }
  conditional() {
    const test = this.binary(1);
    if (!this.accept('?')) return test;
    const a = this.assignment(); this.expect(':'); const b = this.assignment();
    return { t: 'cond', test, a, b, line: test.line, start: test.start, end: b.end };
  }
  binary(min) {
    let left = this.unary();
    for (;;) {
      const k = this.tok, prec = k.type === 'op' ? PREC[k.value] : 0;
      if (!prec || prec < min) return left;
      this.p++;
      const right = this.binary(k.value === '**' ? prec : prec + 1);
      left = { t: k.value === '&&' || k.value === '||' ? 'log' : 'bin', op: k.value, l: left, r: right, line: left.line, start: left.start, end: right.end };
    }
  }
  unary() {
    const k = this.tok;
    if (this.isKw('new')) { this.p++; const node = this.postfix(); return { ...node, start: k.start }; }
    if (k.type === 'op' && ['!', '-', '+', '~'].includes(k.value)) { this.p++; const arg = this.unary(); return { t: 'un', op: k.value, arg, line: k.line, start: k.start, end: arg.end }; }
    if (k.type === 'op' && (k.value === '++' || k.value === '--')) { this.p++; const target = this.lvalue(this.unary()); return { t: 'upd', op: k.value, target, line: k.line, start: k.start, end: target.end }; }
    let node = this.postfix();
    if (this.tok.type === 'op' && (this.tok.value === '++' || this.tok.value === '--') && !this.tok.nl) { const op = this.next(); this.lvalue(node); node = { t: 'upd', op: op.value, target: node, line: node.line, start: node.start, end: op.end }; }
    return node;
  }
  postfix() {
    let node = this.primary();
    for (;;) {
      if (this.isOp('(')) { this.p++; const args = []; while (!this.isOp(')')) { args.push(this.assignment()); if (!this.accept(',')) break; } const close = this.tok; this.expect(')'); node = { t: 'call', callee: node, args, line: node.line, start: node.start, end: close.end }; }
      else if (this.isOp('[') && !this.tok.nl) { this.p++; const index = this.expression(); const close = this.tok; this.expect(']'); node = { t: 'idx', obj: node, index, line: node.line, start: node.start, end: close.end }; }
      else if (this.isOp('.')) { this.p++; const name = this.next(); if (name.type !== 'id') this.fail(name.line, 'ожидалось имя свойства'); node = { t: 'mem', obj: node, prop: name.value, line: node.line, start: node.start, end: name.end }; }
      else return node;
    }
  }
  primary() {
    const k = this.next(), base = { line: k.line, start: k.start, end: k.end };
    if (k.type === 'num' || k.type === 'str') return { t: 'lit', v: k.value, ...base };
    if (k.type === 'id') return k.value in LITERALS ? { t: 'lit', v: LITERALS[k.value], ...base } : { t: 'id', name: k.value, ...base };
    if (this.isOp('(', k)) { const e = this.expression(); this.expect(')'); return e; }
    if (this.isOp('[', k)) { const items = []; while (!this.isOp(']')) { items.push(this.assignment()); if (!this.accept(',')) break; } const close = this.tok; this.expect(']'); return { t: 'arr', items, line: k.line, start: k.start, end: close.end }; }
    this.fail(k.line, k.type === 'eof' ? 'неожиданный конец кода' : `неожиданный символ «${k.value}»`);
  }
}

/* ---------- исполнитель ---------- */
class Scope {
  constructor(parent) { this.vars = new Map(); this.parent = parent; }
  find(name) { for (let s = this; s; s = s.parent) if (s.vars.has(name)) return s.vars.get(name); return null; }
}
const BREAK = { t: 'break' }, CONTINUE = { t: 'continue' };

class Machine {
  constructor(code, { base, watch, pointers, buffers = [] }) {
    this.code = code; this.base = base; this.watchName = watch;
    this.ptrTarget = {}; this.pointerNames = pointers.map(spec => { const [name, to] = spec.split('@'); if (to) this.ptrTarget[name] = to; return name; });
    this.bufferNames = buffers;
    this.names = new Map(); this.rank = new Map(); this.cells = new Map(); this.origin = new Map(); this.shown = new Set(); this.keep = new Map();
    this.global = new Scope(null); this.scope = this.global;
    this.arr = null; this.ids = []; this.nextId = 1; this.done = new Set();
    this.steps = []; this.ticks = 0; this.depth = 0; this.header = 0; this.cmpDepth = 0; this.reads = []; this.lastRead = null;
    this.stats = { cmp: 0, swp: 0, wr: 0 };
  }
  fail(line, msg) { throw new Error(`Строка ${this.base + (line || 1)}: ${msg}`); }
  tick(line) { if (++this.ticks > MAX_TICKS) this.fail(line, 'код выполняется слишком долго (возможен бесконечный цикл)'); }
  text(node) { return this.code.slice(node.start, node.end).replace(/\s+/g, ' '); }
  lookup(name, line) { const b = this.scope.find(name); if (!b) this.fail(line, `неизвестное имя «${name}»`); return b; }

  /* снимок состояния */
  snapshot(kind, line, extra) {
    const ptr = [];
    for (const name of this.pointerNames) { const b = this.scope.find(name); if (b && Number.isInteger(b.v)) { const to = this.ptrTarget[name]; ptr.push(to && to !== this.watchName ? { name, idx: b.v, arr: to } : { name, idx: b.v }); } }
    const chain = []; for (let s = this.scope; s; s = s.parent) chain.unshift(s);
    const vars = new Map(), hand = [];
    for (const s of chain) for (const [name, b] of s.vars) {
      if (Array.isArray(b.v) || typeof b.v === 'function' || (b.v && typeof b.v === 'object')) { vars.delete(name); continue; }
      vars.set(name, b); if (b.hand) { const at = hand.findIndex(h => h.name === name); if (at >= 0) hand.splice(at, 1); hand.push({ name, val: fmtVal(b.v) }); } else { const at = hand.findIndex(h => h.name === name); if (at >= 0) hand.splice(at, 1); }
    }
    const x = this.arr ? this.live().map(l => ({ key: l.key, kind: l.kind, vals: l.arr.map(fmtVal), ids: this.idsOf(l.arr).slice() })) : [];
    return { kind, line: line || 0, vals: this.arr ? this.arr.map(fmtVal) : [], ids: this.ids.slice(), ptr, hand, ...(x.length ? { x } : {}), vars: [...vars].slice(-10).map(([n, b]) => [n, fmtVal(b.v)]), done: [...this.done].sort((a, b) => a - b), stats: { ...this.stats }, ...extra };
  }
  /* ---------- вспомогательные массивы: буферы и временные ---------- */
  // id «фишек» ячеек вспомогательного массива (у основного массива они лежат в this.ids)
  idsOf(arr) {
    if (arr === this.arr) return this.ids;
    let ids = this.cells.get(arr); if (!ids) this.cells.set(arr, ids = []);
    while (ids.length < arr.length) ids.push(this.nextId++);
    ids.length = arr.length;
    return ids;
  }
  newId(arr, i) { const id = this.nextId++; this.idsOf(arr)[i] = id; return id; }
  // массивы, которые сейчас видны: переменные из текущей цепочки областей видимости + буферы из buffers:
  live() {
    const out = [], seen = new Set([this.arr]), used = new Set([this.watchName]), hidden = new Set();
    const add = (name, arr) => {
      if (!Array.isArray(arr) || seen.has(arr)) return; seen.add(arr);
      let key = this.names.get(arr) || name; while (used.has(key)) key += '′'; used.add(key);
      out.push({ key, arr, kind: this.keep.get(key) === arr ? 'buf' : 'tmp' });
    };
    for (let s = this.scope; s; s = s.parent) for (const [name, b] of s.vars) { if (hidden.has(name)) continue; hidden.add(name); add(name, b.v); }
    for (const [, arr] of this.keep) add('', arr);
    return out.sort((p, q) => (this.rank.get(p.arr) ?? 1e9) - (this.rank.get(q.arr) ?? 1e9));
  }
  // имя строки массива на схеме (null — массив не отображается)
  where(arr) { if (!Array.isArray(arr)) return null; if (arr === this.arr) return this.watchName; return this.live().find(l => l.arr === arr)?.key ?? null; }
  // если node — только что прочитанный a[i] (из любого отображаемого массива), вернёт { key, idx }
  readOf(node) {
    const r = node && node.t === 'idx' && this.lastRead; if (!r || r.node !== node) return null;
    const key = this.where(r.arr); return key == null ? null : { key, idx: r.idx };
  }
  // подсветка ячеек: основной массив — в поле kind, остальные — в marks[имя][kind]
  hl(kind, pts) {
    const main = [], rest = {};
    for (const { key, i } of pts) {
      if (key === this.watchName) { if (!main.includes(i)) main.push(i); }
      else { const list = ((rest[key] ||= {})[kind] ||= []); if (!list.includes(i)) list.push(i); }
    }
    return { [kind]: main, ...(Object.keys(rest).length ? { marks: rest } : {}) };
  }
  // массив попал в переменную: запоминаем имя и, если он новый, показываем шаг «создан массив»
  register(name, arr, valueNode, node) {
    if (!Array.isArray(arr) || arr === this.arr) return;
    if (!this.names.has(arr)) { this.names.set(arr, name); this.rank.set(arr, this.rank.size); }
    if (this.bufferNames.includes(name)) { this.names.set(arr, name); this.keep.set(name, arr); }
    if (this.shown.has(arr) || this.header || this.silent) return;
    this.shown.add(arr);
    const key = this.where(arr); if (key == null) return;
    const src = this.origin.get(arr), from = src ? this.where(src.src) : null, ids = this.idsOf(arr);
    this.emit('alloc', node, { an: key, len: arr.length, text: valueNode ? this.text(valueNode) : `${key}[${arr.length}]`, born: ids.map((id, k) => ({ id, row: key, from: from != null ? { arr: from, slot: src.start + k } : null })) });
  }

  emit(kind, node, extra = {}) {
    if (this.silent || !this.arr) return;
    if (this.steps.length >= MAX_STEPS) throw new StepLimit();
    this.steps.push(this.snapshot(kind, node?.line, extra));
  }
  adopt(arr, node) {
    if (!Array.isArray(arr)) return;
    if (arr.length > MAX_LEN) this.fail(node?.line, `массив слишком длинный (максимум ${MAX_LEN})`);
    const first = !this.arr; this.arr = arr; this.ids = arr.map(() => this.nextId++); this.done.clear();
    if (first || !this.steps.length) this.steps.push(this.snapshot('start', 0, {})); else this.emit('note', node, { text: 'Новый массив' });
  }

  /* выполнение */
  run(program) {
    for (const st of program) if (st.t === 'func') this.global.vars.set(st.name, { v: { fn: st, scope: this.global } });
    try { for (const st of program) { const c = this.exec(st); if (c) break; } }
    catch (e) { if (!(e instanceof StepLimit)) throw e; this.limited = true; }
    this.scope = this.global;
    if (!this.arr) throw new Error(`Не найден массив «${this.watchName}»: задайте [значения] в начале блока или объявите его в коде (let ${this.watchName} = [...])`);
    this.silent = false;
    this.steps.push(this.snapshot('end', 0, this.limited ? { text: `Достигнут предел в ${MAX_STEPS} шагов — дальше шаги не записываются` } : {}));
  }
  truthy(v) { return Boolean(v); }
  exec(n) {
    this.tick(n.line);
    switch (n.t) {
      case 'empty': case 'func': return;
      case 'expr': this.ev(n.expr); return;
      case 'var': for (const d of n.decls) { const v = d.init ? this.ev(d.init) : undefined; this.bind(d.name, v, d.init, d, true); } return;
      case 'block': {
        const outer = this.scope; this.scope = new Scope(outer);
        try { for (const st of n.body) { const c = this.exec(st); if (c) return c; } } finally { this.scope = outer; }
        return;
      }
      case 'if': { if (this.truthy(this.ev(n.test))) return this.exec(n.then); if (n.other) return this.exec(n.other); return; }
      case 'while': case 'do': {
        if (n.t === 'do') { const c = this.exec(n.body); if (c && c.t === 'break') return; if (c && c.t !== 'continue') return c; }
        while (this.truthy(this.ev(n.test))) { const c = this.exec(n.body); if (c) { if (c.t === 'break') break; if (c.t !== 'continue') return c; } this.tick(n.line); }
        return;
      }
      case 'for': {
        const outer = this.scope; this.scope = new Scope(outer);
        try {
          this.header++; if (n.init) this.exec(n.init); this.header--;
          while (!n.test || this.truthy(this.ev(n.test))) {
            const c = this.exec(n.body); if (c) { if (c.t === 'break') break; if (c.t !== 'continue') return c; }
            this.header++; if (n.update) this.ev(n.update); this.header--; this.tick(n.line);
          }
        } finally { this.scope = outer; }
        return;
      }
      case 'break': return BREAK;
      case 'continue': return CONTINUE;
      case 'return': return { t: 'return', value: n.value ? this.ev(n.value) : undefined };
    }
    this.fail(n.line, 'неподдерживаемая конструкция');
  }

  /* чтение элемента отслеживаемого массива */
  bind(name, v, valueNode, node, declare) {
    let b = declare ? null : this.lookup(name, node.line);
    const prev = b ? b.v : undefined, rd = this.readOf(valueNode), elem = Boolean(rd);
    const carried = valueNode && valueNode.t === 'id' ? this.scope.find(valueNode.name)?.hand : false;
    if (!b) { b = { v, hand: false }; this.scope.vars.set(name, b); } else b.v = v;
    b.hand = Boolean(elem || carried);
    if (name === this.watchName && Array.isArray(v) && v !== this.arr) this.adopt(v, node);
    this.register(name, v, valueNode, node);
    if (this.header) return;
    if (elem) this.emit('load', node, { name, val: fmtVal(v), src: this.text(valueNode), an: rd.key, ...this.hl('read', [{ key: rd.key, i: rd.idx }]), handBorn: { [name]: { arr: rd.key, slot: rd.idx } } });
    else if (this.pointerNames.includes(name) && v !== prev && Number.isInteger(v)) this.emit('pointer', node, { name, val: fmtVal(v) });
  }
  store(arrNode, arr, i, v, valueNode, node) {
    if (!Array.isArray(arr)) this.fail(node.line, 'индексация не массива');
    if (!Number.isInteger(i) || i < 0 || i > arr.length || i >= MAX_LEN * 50) this.fail(node.line, `индекс ${fmtVal(i)} вне массива (длина ${arr.length})`);
    arr[i] = v;
    const key = this.where(arr); if (key == null) return;
    const rd = this.readOf(valueNode); let from = null;
    if (rd) from = { arr: rd.key, slot: rd.idx };
    else if (valueNode && valueNode.t === 'id' && this.scope.find(valueNode.name)?.hand) from = { hand: valueNode.name };
    const id = this.newId(arr, i);
    this.stats.wr++;
    this.emit('write', node, { an: key, i, val: fmtVal(v), dst: arrNode ? this.text(arrNode) : `${key}[${i}]`, src: valueNode ? this.text(valueNode) : '', ...this.hl('write', [{ key, i }]), born: [{ id, row: key, from }] });
  }
  assignTo(target, v, valueNode, node) {
    if (target.t === 'id') return this.bind(target.name, v, valueNode, node, false);
    const arr = this.ev(target.obj), i = this.ev(target.index);
    this.store(target, arr, i, v, valueNode, node);
  }
  swapCells(arr, i, j, node, label) {
    if (!Array.isArray(arr) || !Number.isInteger(i) || !Number.isInteger(j) || i < 0 || j < 0 || i >= arr.length || j >= arr.length) this.fail(node.line, 'swap: индекс вне массива');
    if (i === j) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    const key = this.where(arr); if (key == null) return;
    const ids = this.idsOf(arr); [ids[i], ids[j]] = [ids[j], ids[i]];
    this.stats.swp++;
    this.emit('swap', node, { an: key, i, j, vi: fmtVal(arr[i]), vj: fmtVal(arr[j]), ...this.hl('swap', [{ key, i }, { key, i: j }]), src: label });
  }

  ev(n) {
    this.tick(n.line);
    switch (n.t) {
      case 'lit': return n.v;
      case 'alloc': { const len = this.ev(n.size); if (!Number.isInteger(len) || len < 0 || len > MAX_LEN) this.fail(n.line, `длина массива — целое число от 0 до ${MAX_LEN}`); return new Array(len).fill(undefined); }
      case 'id': return this.lookup(n.name, n.line).v;
      case 'arr': { const out = n.items.map(x => this.ev(x)); if (out.length > 10000) this.fail(n.line, 'слишком большой массив'); return out; }
      case 'idx': {
        const arr = this.ev(n.obj), i = this.ev(n.index);
        if (!Array.isArray(arr) && typeof arr !== 'string') this.fail(n.line, 'индексация не массива');
        if (Array.isArray(arr) && Number.isInteger(i) && i >= 0 && i < arr.length) { this.lastRead = { node: n, arr, idx: i }; if (this.cmpDepth) this.reads.push({ arr, i }); }
        return arr[i];
      }
      case 'mem': {
        const o = this.ev(n.obj);
        if (n.prop === 'length' && (Array.isArray(o) || typeof o === 'string')) return o.length;
        this.fail(n.line, `неподдерживаемое свойство «${n.prop}»`);
      }
      case 'un': { const v = this.ev(n.arg); return n.op === '!' ? !v : n.op === '-' ? -v : n.op === '+' ? +v : ~v; }
      case 'cond': return this.truthy(this.ev(n.test)) ? this.ev(n.a) : this.ev(n.b);
      case 'log': { const l = this.ev(n.l); return n.op === '&&' ? (l ? this.ev(n.r) : l) : (l ? l : this.ev(n.r)); }
      case 'seq': { let v; for (const x of n.items) v = this.ev(x); return v; }
      case 'bin': {
        if (!CMP.has(n.op)) return this.binop(n.op, this.ev(n.l), this.ev(n.r), n);
        const mark = this.reads.length; this.cmpDepth++;
        const l = this.ev(n.l), r = this.ev(n.r); this.cmpDepth--;
        const res = this.binop(n.op, l, r, n), raw = this.reads.splice(mark);
        if (raw.length && !this.silent) {
          const mine = raw.map(x => ({ key: this.where(x.arr), i: x.i })).filter(x => x.key != null);
          if (mine.length) { this.stats.cmp++; this.emit('compare', n, { src: this.text(n), op: n.op, lv: fmtVal(l), rv: fmtVal(r), res, ...this.hl('cmp', mine) }); }
        }
        return res;
      }
      case 'upd': {
        const cur = this.ev(n.target), v = n.op === '++' ? cur + 1 : cur - 1;
        this.assignTo(n.target, v, null, n);
        return n.prefixValue ? v : cur;
      }
      case 'asg': {
        let v;
        if (n.op === '=') v = this.ev(n.value);
        else { const cur = this.ev(n.target), rhs = this.ev(n.value); v = this.binop(n.op.slice(0, -1), cur, rhs, n); }
        this.assignTo(n.target, v, n.op === '=' ? n.value : null, n);
        return v;
      }
      case 'destr': return this.destructure(n);
      case 'call': return this.call(n);
    }
    this.fail(n.line, 'неподдерживаемое выражение');
  }
  binop(op, l, r, n) {
    switch (op) {
      case '+': return l + r; case '-': return l - r; case '*': return l * r; case '/': return l / r; case '%': return l % r; case '**': return l ** r;
      case '<': return l < r; case '>': return l > r; case '<=': return l <= r; case '>=': return l >= r;
      case '==': return l == r; case '!=': return l != r; case '===': return l === r; case '!==': return l !== r; // eslint-disable-line eqeqeq
      case '&': return l & r; case '|': return l | r; case '^': return l ^ r; case '<<': return l << r; case '>>': return l >> r; case '>>>': return l >>> r;
    }
    this.fail(n?.line, `неизвестный оператор ${op}`);
  }
  destructure(n) {
    if (n.value.t !== 'arr' || n.value.items.length !== n.targets.length) this.fail(n.line, 'справа ожидался массив той же длины, например [a[j], a[i]]');
    const vals = [], srcs = [];
    for (const it of n.value.items) { vals.push(this.ev(it)); srcs.push(this.readOf(it)); }
    const dest = n.targets.map(t => t.t === 'idx' ? { arr: this.ev(t.obj), i: this.ev(t.index) } : null);
    const key = dest[0] ? this.where(dest[0].arr) : null;
    if (dest.length === 2 && key != null && dest[1] && dest[1].arr === dest[0].arr && srcs[0]?.key === key && srcs[1]?.key === key && srcs[0].idx === dest[1].i && srcs[1].idx === dest[0].i) {
      return this.swapCells(dest[0].arr, dest[0].i, dest[1].i, n, this.text(n)), undefined;
    }
    n.targets.forEach((t, k) => this.assignTo(t, vals[k], n.value.items[k], n));
  }
  call(n) {
    const c = n.callee, args = n.args;
    let name = c.t === 'id' ? c.name : null, obj = null;
    if (c.t === 'mem') {
      if (c.obj.t === 'id' && (c.obj.name === 'Math' || c.obj.name === 'std')) name = c.prop;
      else { obj = this.ev(c.obj); name = c.prop; }
    }
    if (obj !== null) return this.method(obj, name, n);
    const b = c.t === 'id' ? this.scope.find(name) : null;
    if (b && b.v && b.v.fn) return this.callUser(b.v, args.map(a => this.ev(a)), n);
    if (name === 'swap') {
      if (args.length === 3) return this.swapCells(this.ev(args[0]), this.ev(args[1]), this.ev(args[2]), n, this.text(n)), undefined;
      if (args.length === 2 && args[0].t === 'idx' && args[1].t === 'idx') { const x = this.ev(args[0].obj), i = this.ev(args[0].index), y = this.ev(args[1].obj), j = this.ev(args[1].index); if (x !== y) this.fail(n.line, 'swap: элементы из разных массивов'); return this.swapCells(x, i, j, n, this.text(n)), undefined; }
      this.fail(n.line, 'swap(a, i, j) или swap(a[i], a[j])');
    }
    const vals = args.map(a => this.ev(a));
    switch (name) {
      case 'Array': {
        if (vals.length !== 1 || typeof vals[0] !== 'number') return [...vals];
        if (!Number.isInteger(vals[0]) || vals[0] < 0 || vals[0] > MAX_LEN) this.fail(n.line, `Array(n): длина — целое число от 0 до ${MAX_LEN}`);
        return new Array(vals[0]).fill(undefined);
      }
      case 'len': case 'size': return vals[0].length;
      case 'done': {
        const lo = vals[0], hi = vals.length > 1 ? vals[1] : vals[0];
        if (!Number.isInteger(lo) || !Number.isInteger(hi)) this.fail(n.line, 'done(i) или done(от, до) — целые индексы');
        for (let k = Math.max(0, lo); k <= Math.min(hi, (this.arr?.length ?? 0) - 1); k++) this.done.add(k);
        return;
      }
      case 'undone': this.done.clear(); return;
      case 'say': case 'print': this.emit('note', n, { text: vals.map(fmtVal).join(' ') }); return;
    }
    if (MATH[name] && !b) return MATH[name](...vals);
    this.fail(n.line, `неизвестная функция «${name}»`);
  }
  method(obj, name, n) {
    const vals = n.args.map(a => this.ev(a));
    if (!Array.isArray(obj) && typeof obj !== 'string') this.fail(n.line, `у значения нет метода «${name}»`);
    if (name === 'size' && Array.isArray(obj)) return obj.length;
    if (name === 'push' && Array.isArray(obj)) {
      if (obj.length >= MAX_LEN * 50) this.fail(n.line, 'слишком большой массив');
      obj.push(vals[0]);
      const key = this.where(obj);
      if (key != null) {
        const at = obj.length - 1, id = this.newId(obj, at), rd = this.readOf(n.args[0]); this.stats.wr++;
        this.emit('write', n, { an: key, i: at, val: fmtVal(vals[0]), dst: `${this.text(n.callee.obj)}[${at}]`, src: this.text(n.args[0] || n), ...this.hl('write', [{ key, i: at }]), born: [{ id, row: key, from: rd ? { arr: rd.key, slot: rd.idx } : null }] });
      }
      return obj.length;
    }
    if (name === 'pop' && Array.isArray(obj)) {
      const v = obj.pop(), key = this.where(obj);
      if (key != null) { if (obj === this.arr) this.ids.pop(); this.emit('remove', n, { an: key, val: fmtVal(v), i: obj.length }); }
      return v;
    }
    if (name === 'fill' && Array.isArray(obj)) {
      obj.fill(...vals);
      const key = this.where(obj);
      if (key != null) {
        const norm = (x, d) => x === undefined ? d : x < 0 ? Math.max(0, obj.length + x) : Math.min(x, obj.length), lo = norm(vals[1], 0), hi = norm(vals[2], obj.length), pts = [], born = [];
        for (let k = lo; k < hi; k++) { pts.push({ key, i: k }); born.push({ id: this.newId(obj, k), row: key, from: null }); }
        this.stats.wr += born.length;
        this.emit('fill', n, { an: key, val: fmtVal(vals[0]), text: this.text(n), ...this.hl('write', pts), born });
      }
      return obj;
    }
    if (name === 'slice') {
      const r = obj.slice(vals[0], vals[1]);
      if (Array.isArray(obj)) {
        if (r.length > MAX_LEN) this.fail(n.line, `массив слишком длинный (максимум ${MAX_LEN})`);
        let st = vals[0] ?? 0; if (st < 0) st = Math.max(0, obj.length + st);
        this.origin.set(r, { src: obj, start: st });
      }
      return r;
    }
    if (name === 'indexOf') return obj.indexOf(vals[0]);
    this.fail(n.line, `метод «${name}» не поддерживается`);
  }
  callUser(f, args, n) {
    if (++this.depth > MAX_DEPTH) this.fail(n.line, 'слишком глубокая рекурсия');
    const saved = this.scope, scope = new Scope(f.scope);
    f.fn.params.forEach((p, k) => scope.vars.set(p, { v: args[k], hand: false }));
    this.scope = scope;
    f.fn.params.forEach((p, k) => this.register(p, args[k], null, n));
    try { for (const st of f.fn.body.body) { const c = this.exec(st); if (c && c.t === 'return') return c.value; if (c) break; } }
    finally { this.scope = saved; this.depth--; }
  }
}

/* Постфиксные ++/-- возвращают старое значение, префиксные — новое */
const markPrefix = node => { if (!node || typeof node !== 'object') return; if (Array.isArray(node)) return node.forEach(markPrefix); if (node.t === 'upd') node.prefixValue = node.start < node.target.start; for (const v of Object.values(node)) if (v && typeof v === 'object') markPrefix(v); };

/**
 * @param {string} code      текст программы
 * @param {object} opts      base — число строк перед кодом (для сообщений об ошибках), watch — имя массива,
 *                           pointers — имена переменных-указателей (`k@buf` — указатель на массив buf),
 *                           buffers — имена массивов-буферов, initial — начальные значения основного массива
 */
export function runArrayProgram(code, { base = 0, watch = 'a', pointers = ['i', 'j', 'k'], buffers = [], initial = [] } = {}) {
  if (code.length > MAX_CODE) throw new Error(`Слишком длинный код (максимум ${MAX_CODE} символов)`);
  const fail = (line, msg) => { throw new Error(`Строка ${base + line}: ${msg}`); };
  const program = new Parser(tokenize(code, fail), fail).program();
  markPrefix(program);
  const m = new Machine(code, { base, watch, pointers, buffers });
  if (initial.length) { const arr = [...initial]; m.global.vars.set(watch, { v: arr, hand: false }); m.adopt(arr, null); }
  m.run(program);
  return { steps: m.steps, codeLines: code.split('\n') };
}
