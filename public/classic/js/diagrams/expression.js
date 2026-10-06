const functions = Object.freeze({ sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan, sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, exp: Math.exp, ln: Math.log, log: Math.log10, log2: Math.log2, sqrt: Math.sqrt, abs: Math.abs, floor: Math.floor, ceil: Math.ceil, sign: Math.sign, min: Math.min, max: Math.max });
const binary = { '+': (a, b) => a + b, '-': (a, b) => a - b, '*': (a, b) => a * b, '/': (a, b) => a / b, '^': (a, b) => a ** b };
const precedence = { '+': 10, '-': 10, '*': 20, '/': 20, '^': 30 };

export function parseExpression(source) {
  const raw = String(source).replace(/\s+/g, '');
  if (raw.length > 300) throw new Error('Слишком длинное выражение');
  const tokens = raw.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[a-zA-Z][a-zA-Z0-9]*|[()+\-*/^,]/g) || [];
  if (tokens.join('') !== raw || !tokens.length) throw new Error('Недопустимый символ в выражении');
  let index = 0;
  const peek = () => tokens[index];
  const take = () => tokens[index++];
  const startsAtom = token => token && (/^(?:\d|\.)/.test(token) || /^[a-z]/i.test(token) || token === '(');
  function expression(min = 0, depth = 0) {
    if (depth > 32) throw new Error('Слишком сложное выражение');
    const token = take();
    let left;
    if (token === '+' || token === '-') {
      const value = expression(25, depth + 1);
      left = scope => token === '-' ? -value(scope) : value(scope);
    } else if (token === '(') {
      left = expression(0, depth + 1);
      if (take() !== ')') throw new Error('Не закрыта скобка');
    } else if (/^(?:\d|\.)/.test(token || '')) {
      const number = Number(token);
      left = () => number;
    } else if (token === 'x' || token === 't' || token === 'y') {
      left = scope => scope[token] ?? 0;
    } else if (token === 'pi' || token === 'e') {
      left = () => token === 'pi' ? Math.PI : Math.E;
    } else if (functions[token] && peek() === '(') {
      take();
      const args = [];
      if (peek() !== ')') { do { args.push(expression(0, depth + 1)); } while (peek() === ',' && take()); }
      if (take() !== ')') throw new Error('Не закрыта скобка функции');
      if ((!['min', 'max'].includes(token) && args.length !== 1) || !args.length) throw new Error(`Неверное число аргументов: ${token}`);
      left = scope => functions[token](...args.map(arg => arg(scope)));
    } else throw new Error(`Неизвестное имя или число: ${token || 'конец строки'}`);
    while (true) {
      let operator = peek(), implicit = false;
      if (startsAtom(operator)) { operator = '*'; implicit = true; }
      const priority = precedence[operator];
      if (!priority || priority < min) break;
      if (!implicit) take();
      const right = expression(priority + (operator === '^' ? 0 : 1), depth + 1);
      const previous = left;
      left = scope => binary[operator](previous(scope), right(scope));
    }
    return left;
  }
  const fn = expression();
  if (index !== tokens.length) throw new Error(`Лишний символ: ${peek()}`);
  return scope => { const value = fn(scope || {}); return Number.isFinite(value) ? value : NaN; };
}
