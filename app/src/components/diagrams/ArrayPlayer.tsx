import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { cn } from '../../lib/cn';
import type { ArrayStep } from './arrayCode.js';
import type { ArrayModel } from './TreeArrayChart';
import styles from './ArrayPlayer.module.css';

/** Цвета указателей — по порядку в pointers: */
const POINTER_COLORS = ['var(--d-blue)', 'var(--d-orange)', 'var(--d-green)', 'var(--d-purple)', 'var(--d-red)', 'var(--d-gray)'];
const CELL_H = 44;
const PTR_ROW = 18;
const SPEEDS = [0.5, 1, 2, 4];

const OP: Record<string, string> = { '===': '=', '==': '=', '!==': '≠', '!=': '≠', '<=': '≤', '>=': '≥' };
const op = (value: string | undefined) => (value ? (OP[value] ?? value) : '');

/** Что произошло на шаге — словами, как на сайте группы */
function describe(step: ArrayStep): { kind: string; detail: string; result?: boolean } {
  const a = step.an ?? 'a';
  switch (step.kind) {
    case 'start':
      return { kind: 'Начало', detail: 'Исходный массив' };
    case 'end':
      return { kind: 'Готово', detail: step.text ?? 'Программа завершена' };
    case 'compare':
      return { kind: 'Сравнение', detail: `${step.src} → ${step.lv} ${op(step.op)} ${step.rv}`, result: step.res };
    case 'swap':
      return { kind: 'Обмен', detail: `${a}[${step.i}] ↔ ${a}[${step.j}] → ${step.vi}, ${step.vj}` };
    case 'write':
      return { kind: 'Запись', detail: `${step.dst} = ${step.src} → ${a}[${step.i}] ← ${step.val}` };
    case 'load':
      return { kind: 'Чтение в переменную', detail: `${step.name} = ${step.src} → ${step.val}` };
    case 'alloc':
      return { kind: 'Новый массив', detail: `${step.text} · ${step.len} эл.` };
    case 'fill':
      return { kind: 'Заполнение', detail: `${step.text} ← ${step.val}` };
    case 'pointer':
      return { kind: 'Указатель', detail: `${step.name} = ${step.val}` };
    case 'remove':
      return { kind: 'Удаление', detail: `pop() → ${step.val}` };
    default:
      return { kind: 'Комментарий', detail: step.text ?? '' };
  }
}

interface Row {
  key: string;
  kind: 'main' | 'buf' | 'tmp';
  vals: string[];
  ids: number[];
}

const rowsOf = (step: ArrayStep, watch: string): Row[] => [
  { key: watch, kind: 'main', vals: step.vals, ids: step.ids },
  ...(step.x ?? []).map((row) => ({ ...row, kind: row.kind })),
];

/**
 * Пошаговая демонстрация кода над массивом (```array с `code:`): ячейки-«фишки» переезжают при обмене,
 * указатели двигаются, внизу — что сделал шаг, переменные и строка кода. Шаги считает интерпретатор группы
 * (arrayCode.js) заранее, здесь только показ. Клавиши: ← → — шаг, Home/End, пробел — пуск/пауза.
 */
export function ArrayPlayer({ model }: { model: ArrayModel }) {
  const steps = model.steps!;
  const last = steps.length - 1;
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [width, setWidth] = useState(600);
  const stageRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLDivElement>(null);
  const step = steps[index]!;

  // Все строки, что встречаются за показ, — места под них резервируются заранее, чтобы ничего не прыгало
  const rowKeys = [model.watch, ...new Set(steps.flatMap((s) => (s.x ?? []).map((row) => row.key)))];
  const rowLength = (key: string) => Math.max(1, ...steps.map((s) => rowsOf(s, model.watch).find((row) => row.key === key)?.vals.length ?? 0));
  const columns = Math.max(...rowKeys.map(rowLength));
  const multi = rowKeys.length > 1;
  const gutter = multi ? 56 : 0;
  const cell = Math.max(36, Math.min(64, Math.floor((width - gutter) / columns)));
  // Сколько указателей может встать на одну ячейку — столько «этажей» над строкой
  const lanes = (key: string) =>
    Math.min(
      3,
      Math.max(
        key === model.watch ? 1 : 0,
        ...steps.map((s) => {
          const count = new Map<number, number>();
          for (const pointer of s.ptr) if ((pointer.arr ?? model.watch) === key) count.set(pointer.idx, (count.get(pointer.idx) ?? 0) + 1);
          return Math.max(0, ...count.values());
        }),
      ),
    );
  let y = 0;
  const rowTop = new Map<string, { pointers: number; cells: number }>();
  for (const key of rowKeys) {
    rowTop.set(key, { pointers: y, cells: y + lanes(key) * PTR_ROW + 6 });
    y += lanes(key) * PTR_ROW + 6 + CELL_H + 26;
  }
  const x = (slot: number) => gutter + slot * cell;

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const observer = new ResizeObserver(() => setWidth(stage.clientWidth));
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!playing) return undefined;
    if (index >= last) {
      setPlaying(false);
      return undefined;
    }
    const timer = setTimeout(() => setIndex((current) => Math.min(last, current + 1)), 1100 / speed);
    return () => clearTimeout(timer);
  }, [playing, index, last, speed]);

  // Текущая строка кода — в середину окна кода
  useEffect(() => {
    const body = codeRef.current;
    const line = body?.querySelector<HTMLElement>(`[data-line="${step.line}"]`);
    if (body && line) body.scrollTo?.({ top: Math.max(0, line.offsetTop - body.clientHeight / 2 + line.offsetHeight / 2) });
  }, [step.line]);

  const go = (to: number) => {
    setPlaying(false);
    setIndex(Math.max(0, Math.min(last, to)));
  };
  const togglePlay = () => {
    if (!playing && index >= last) setIndex(0);
    setPlaying((value) => !value);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).matches('input, select')) return;
    const actions: Record<string, () => void> = {
      ArrowRight: () => go(index + 1),
      ArrowLeft: () => go(index - 1),
      Home: () => go(0),
      End: () => go(last),
      ' ': togglePlay,
    };
    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  };

  const colorOf = (name: string) => POINTER_COLORS[Math.max(0, model.pointerNames.indexOf(name)) % POINTER_COLORS.length]!;
  const marksOf = (row: Row, kind: 'cmp' | 'write' | 'swap' | 'read') => (row.kind === 'main' ? step[kind] : step.marks?.[row.key]?.[kind]) ?? [];
  const rows = rowsOf(step, model.watch);
  const said = describe(step);

  return (
    <div
      className={cn(styles.player, !model.hideCode && styles.withCode)}
      data-pdf-hide
      tabIndex={0}
      role="group"
      aria-label="Пошаговая демонстрация кода"
      onKeyDown={onKeyDown}
    >
      <div className={styles.main}>
        <div ref={stageRef} className={styles.stageWrap}>
          <div className={styles.stage} style={{ width: gutter + columns * cell, height: y, '--cell': `${cell}px` } as CSSProperties}>
            {rowKeys.map((key) => {
              const top = rowTop.get(key)!;
              const present = rows.some((row) => row.key === key);
              const kind = key === model.watch ? 'main' : (rows.find((row) => row.key === key)?.kind ?? 'tmp');
              return (
                <div key={key} className={cn(styles.row, !present && styles.rowOff)}>
                  {multi && (
                    <div className={styles.rowLabel} style={{ top: top.cells + 10 }}>
                      {key}
                      {kind !== 'main' && <small>{kind === 'buf' ? 'буфер' : 'врем.'}</small>}
                    </div>
                  )}
                  {Array.from({ length: rowLength(key) }, (_, slot) => (
                    <div key={slot}>
                      <div className={styles.slot} style={{ transform: `translate(${x(slot)}px, ${top.cells}px)` }} />
                      <div className={styles.index} style={{ transform: `translate(${x(slot)}px, ${top.cells + CELL_H + 4}px)` }}>
                        {slot}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}

            {/* Фишки ячеек: ключ — id значения, поэтому при обмене фишка переезжает, а не перерисовывается */}
            {rows.flatMap((row) =>
              row.ids.map((id, slot) => {
                const highlight = marksOf(row, 'swap').includes(slot)
                  ? styles.isSwap
                  : marksOf(row, 'write').includes(slot)
                    ? styles.isWrite
                    : marksOf(row, 'cmp').includes(slot)
                      ? styles.isCmp
                      : marksOf(row, 'read').includes(slot)
                        ? styles.isRead
                        : row.kind === 'main' && step.done.includes(slot)
                          ? styles.isDone
                          : undefined;
                const value = row.vals[slot]!;
                return (
                  <div
                    key={id}
                    className={cn(styles.chip, highlight, value === '·' && styles.isEmpty)}
                    style={{ transform: `translate(${x(slot)}px, ${rowTop.get(row.key)!.cells}px)` }}
                  >
                    {value}
                  </div>
                );
              }),
            )}

            {model.pointerNames.map((name) => {
              const pointer = step.ptr.find((item) => item.name === name);
              const row = pointer && rows.find((item) => item.key === (pointer.arr ?? model.watch));
              const visible = pointer && row && pointer.idx >= 0 && pointer.idx < row.vals.length;
              const key = pointer?.arr ?? model.watch;
              // Несколько указателей на одной ячейке — друг над другом
              const rank = visible
                ? step.ptr.filter(
                    (other) =>
                      (other.arr ?? model.watch) === key &&
                      other.idx === pointer.idx &&
                      model.pointerNames.indexOf(other.name) < model.pointerNames.indexOf(name),
                  ).length
                : 0;
              const top = rowTop.get(key);
              return (
                <div
                  key={name}
                  className={cn(styles.pointer, !visible && styles.pointerOff)}
                  style={
                    {
                      '--pc': colorOf(name),
                      transform:
                        visible && top
                          ? `translate(${x(pointer.idx)}px, ${top.pointers + Math.max(0, lanes(key) - 1 - rank) * PTR_ROW}px)`
                          : undefined,
                    } as CSSProperties
                  }
                >
                  {name} ▾
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.status} aria-live="polite">
          <span className={styles.kind}>{said.kind}</span>
          <span className={styles.detail}>{said.detail}</span>
          {said.result !== undefined && (
            <span className={cn(styles.result, said.result ? styles.true : styles.false)}>{said.result ? 'истина' : 'ложь'}</span>
          )}
        </div>

        <div className={styles.meta}>
          <div className={styles.vars}>
            {[
              ...step.vars,
              ...step.hand.filter((hand) => !step.vars.some(([name]) => name === hand.name)).map((hand) => [hand.name, hand.val] as [string, string]),
            ].map(([name, value]) => (
              <span
                key={name}
                className={cn(styles.var, model.pointerNames.includes(name) && styles.varPointer)}
                style={{ '--pc': colorOf(name) } as CSSProperties}
              >
                {name} = {value}
              </span>
            ))}
          </div>
          <span className={styles.stats}>
            Сравнений: {step.stats.cmp}
            {step.stats.swp > 0 && ` · Обменов: ${step.stats.swp}`}
            {step.stats.wr > 0 && ` · Записей: ${step.stats.wr}`}
          </span>
        </div>

        <div className={styles.controls}>
          <button type="button" aria-label="В начало" disabled={index === 0} onClick={() => go(0)}>
            <ChevronFirst size={16} aria-hidden />
          </button>
          <button type="button" aria-label="Шаг назад" disabled={index === 0} onClick={() => go(index - 1)}>
            <ChevronLeft size={16} aria-hidden />
          </button>
          <button type="button" className={styles.play} onClick={togglePlay}>
            {playing ? <Pause size={14} aria-hidden /> : <Play size={14} aria-hidden />}
            {playing ? 'Пауза' : 'Пуск'}
          </button>
          <button type="button" aria-label="Шаг вперёд" disabled={index === last} onClick={() => go(index + 1)}>
            <ChevronRight size={16} aria-hidden />
          </button>
          <button type="button" aria-label="В конец" disabled={index === last} onClick={() => go(last)}>
            <ChevronLast size={16} aria-hidden />
          </button>
          <input type="range" min={0} max={last} value={index} aria-label="Номер шага" onChange={(event) => go(Number(event.target.value))} />
          <span className={styles.count}>
            {index} / {last}
          </span>
          <select aria-label="Скорость" value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>
            {SPEEDS.map((value) => (
              <option key={value} value={value}>
                {value}×
              </option>
            ))}
          </select>
        </div>
      </div>

      {!model.hideCode && (
        <div className={styles.code}>
          <div className={styles.codeHead}>Код</div>
          <div ref={codeRef} className={styles.codeBody}>
            {model.codeLines!.map((line, number) => (
              <div key={number} data-line={number + 1} className={cn(styles.codeLine, step.line === number + 1 && styles.current)}>
                <span className={styles.lineNumber}>{number + 1}</span>
                <span>{line || ' '}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
