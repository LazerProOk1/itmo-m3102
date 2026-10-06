/**
 * Разбор и вычисление формул графиков без eval: + - * / ^, скобки, неявное умножение (2x, 3(x+1)),
 * константы pi, e, переменные x и t, функции sin, cos, sqrt, log2, min… — как в DSL сайта группы.
 */
export type Expression = (vars: Record<string, number>) => number;

const FUNCTIONS: Record<string, (...args: number[]) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  abs: Math.abs,
  exp: Math.exp,
  ln: Math.log,
  log: Math.log,
  log2: Math.log2,
  log10: Math.log10,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  sign: Math.sign,
  min: Math.min,
  max: Math.max,
};

const CONSTANTS: Record<string, number> = { pi: Math.PI, π: Math.PI, e: Math.E };

type Token = { type: 'num'; value: number } | { type: 'id'; value: string } | { type: 'op'; value: string };

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  const text = source.replace(/·|×/g, '*').replace(/−/g, '-');
  let i = 0;
  while (i < text.length) {
    const char = text[i]!;
    if (/\s/.test(char)) {
      i++;
    } else if (/[\d.]/.test(char)) {
      const match = /^\d*\.?\d+(?:e[+-]?\d+)?/i.exec(text.slice(i)) ?? /^\d+\.?/.exec(text.slice(i));
      if (!match) throw new Error(`Не число: «${text.slice(i, i + 6)}»`);
      tokens.push({ type: 'num', value: Number(match[0]) });
      i += match[0].length;
    } else if (/[a-zA-Zπ_]/.test(char)) {
      const match = /^[a-zA-Zπ_][a-zA-Z0-9_]*/.exec(text.slice(i))!;
      tokens.push({ type: 'id', value: match[0] });
      i += match[0].length;
    } else if ('+-*/^(),'.includes(char)) {
      tokens.push({ type: 'op', value: char });
      i++;
    } else {
      throw new Error(`Непонятный символ «${char}»`);
    }
  }
  return tokens;
}

export function compileExpression(source: string): Expression {
  const tokens = tokenize(source);
  let position = 0;
  const peek = () => tokens[position];
  const isOp = (value: string) => peek()?.type === 'op' && peek()!.value === value;
  const expect = (value: string) => {
    if (!isOp(value)) throw new Error(`Ожидалось «${value}» в «${source}»`);
    position++;
  };

  function expression(): Expression {
    let left = term();
    while (isOp('+') || isOp('-')) {
      const op = tokens[position++]!.value;
      const right = term();
      const a = left;
      left = op === '+' ? (v) => a(v) + right(v) : (v) => a(v) - right(v);
    }
    return left;
  }

  // Неявное умножение: следующий токен — число, имя или «(»
  const startsFactor = () => {
    const token = peek();
    return token !== undefined && (token.type !== 'op' || token.value === '(');
  };

  function term(): Expression {
    let left = unary();
    for (;;) {
      if (isOp('*') || isOp('/')) {
        const op = tokens[position++]!.value;
        const right = unary();
        const a = left;
        left = op === '*' ? (v) => a(v) * right(v) : (v) => a(v) / right(v);
      } else if (startsFactor()) {
        const right = power();
        const a = left;
        left = (v) => a(v) * right(v);
      } else {
        return left;
      }
    }
  }

  // -x^2 = -(x^2): минус слабее степени
  function unary(): Expression {
    if (isOp('-')) {
      position++;
      const inner = unary();
      return (v) => -inner(v);
    }
    if (isOp('+')) {
      position++;
      return unary();
    }
    return power();
  }

  function power(): Expression {
    const base = primary();
    if (isOp('^')) {
      position++;
      const exponent = unary();
      return (v) => base(v) ** exponent(v);
    }
    return base;
  }

  function primary(): Expression {
    const token = tokens[position++];
    if (!token) throw new Error(`Формула обрывается: «${source}»`);
    if (token.type === 'num') return () => token.value;
    if (token.type === 'op' && token.value === '(') {
      const inner = expression();
      expect(')');
      return inner;
    }
    if (token.type === 'id') {
      const fn = FUNCTIONS[token.value];
      if (fn && isOp('(')) {
        position++;
        const args: Expression[] = [];
        if (!isOp(')')) {
          args.push(expression());
          while (isOp(',')) {
            position++;
            args.push(expression());
          }
        }
        expect(')');
        return (v) => fn(...args.map((arg) => arg(v)));
      }
      if (token.value in CONSTANTS) return () => CONSTANTS[token.value]!;
      const name = token.value;
      return (v) => {
        if (!(name in v)) throw new Error(`Неизвестная переменная «${name}»`);
        return v[name]!;
      };
    }
    throw new Error(`Неожиданное «${token.value}» в «${source}»`);
  }

  const compiled = expression();
  if (position < tokens.length) throw new Error(`Лишнее в формуле: «${source}»`);
  return compiled;
}
