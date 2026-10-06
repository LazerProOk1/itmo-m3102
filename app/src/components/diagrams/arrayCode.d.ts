/** Шаг пошагового выполнения кода над массивом (интерпретатор сайта группы, arrayCode.js) */
export interface ArrayStep {
  kind: 'start' | 'end' | 'compare' | 'swap' | 'write' | 'load' | 'alloc' | 'fill' | 'pointer' | 'remove' | 'note' | string;
  /** Строка кода (с 1), 0 — вне кода */
  line: number;
  /** Основной массив: значения и id «фишек» ячеек (id переезжает вместе со значением при обмене) */
  vals: string[];
  ids: number[];
  ptr: { name: string; idx: number; arr?: string }[];
  /** Переменные, в которые «взят» элемент (tmp = a[j]) */
  hand: { name: string; val: string }[];
  /** Буферы и временные массивы, видимые на этом шаге */
  x?: { key: string; kind: 'buf' | 'tmp'; vals: string[]; ids: number[] }[];
  vars: [string, string][];
  done: number[];
  stats: { cmp: number; swp: number; wr: number };
  cmp?: number[];
  write?: number[];
  swap?: number[];
  read?: number[];
  marks?: Record<string, Partial<Record<'cmp' | 'write' | 'swap' | 'read', number[]>>>;
  // Подписи операции — зависят от kind
  text?: string;
  src?: string;
  lv?: string;
  rv?: string;
  op?: string;
  res?: boolean;
  an?: string;
  i?: number;
  j?: number;
  vi?: string;
  vj?: string;
  val?: string;
  dst?: string;
  name?: string;
  len?: number;
}

export function runArrayProgram(
  code: string,
  options?: { base?: number; watch?: string; pointers?: string[]; buffers?: string[]; initial?: (string | number)[] },
): { steps: ArrayStep[]; codeLines: string[] };

export function fmtVal(value: unknown): string;
