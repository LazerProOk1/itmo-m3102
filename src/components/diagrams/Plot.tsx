import { useId } from 'react';
import { compileExpression, type Expression } from './expression';
import { resolveColor, takeOptions, unquote, type DiagramLines, type DrawOptions } from './parse';
import styles from './Diagrams.module.css';

type Range = [number, number];

type PlotItem =
  | { kind: 'function'; fn: Expression; options: DrawOptions; color: string }
  | { kind: 'vline'; x: number; options: DrawOptions; color: string }
  | { kind: 'parametric'; fx: Expression; fy: Expression; range: Range; options: DrawOptions; color: string }
  | { kind: 'point'; x: number; y: number; label: string }
  | { kind: 'area'; top: Expression; bottom: Expression; range: Range }
  | { kind: 'tangent'; fn: Expression; at: number; color: string };

export interface PlotModel {
  x: Range;
  y: Range;
  grid: boolean;
  items: PlotItem[];
}

const num = (value: string) => {
  const result = compileExpression(value)({});
  if (!Number.isFinite(result)) throw new Error(`Не число: «${value}»`);
  return result;
};

/** Разбор `plot`: x: a..b y: c..d grid, y = …, x = c, (fx, fy) t: a..b, point, area, tangent */
export function parsePlot({ body }: DiagramLines): PlotModel {
  const model: PlotModel = { x: [-5, 5], y: [-5, 5], grid: false, items: [] };
  let colorIndex = 0;
  const nextColor = (name?: string) => resolveColor(name, name ? 0 : colorIndex++);

  for (const { text, line } of body) {
    try {
      const range = /^x:\s*(\S+?)\.\.(\S+)(?:\s+y:\s*(\S+?)\.\.(\S+))?(\s+grid)?\s*$/.exec(text);
      if (range) {
        model.x = [num(range[1]!), num(range[2]!)];
        if (range[3]) model.y = [num(range[3]), num(range[4]!)];
        model.grid = Boolean(range[5]);
        continue;
      }
      const yRange = /^y:\s*(\S+?)\.\.(\S+)(\s+grid)?$/.exec(text);
      if (yRange) {
        model.y = [num(yRange[1]!), num(yRange[2]!)];
        if (yRange[3]) model.grid = true;
        continue;
      }
      if (text === 'grid') {
        model.grid = true;
        continue;
      }

      const point = /^point\s*\(([^,]+),([^)]+)\)\s*(.*)$/.exec(text);
      if (point) {
        model.items.push({ kind: 'point', x: num(point[1]!), y: num(point[2]!), label: unquote(point[3] ?? '') });
        continue;
      }

      const area = /^area\s+between\s+y\s*=\s*(.+?)\s+and\s+y\s*=\s*(.+?)\s+from\s+(\S+)\s+to\s+(\S+)$/.exec(text);
      if (area) {
        model.items.push({ kind: 'area', top: compileExpression(area[1]!), bottom: compileExpression(area[2]!), range: [num(area[3]!), num(area[4]!)] });
        continue;
      }
      const areaUnder = /^area\s+y\s*=\s*(.+?)\s+from\s+(\S+)\s+to\s+(\S+)$/.exec(text);
      if (areaUnder) {
        model.items.push({ kind: 'area', top: compileExpression(areaUnder[1]!), bottom: () => 0, range: [num(areaUnder[2]!), num(areaUnder[3]!)] });
        continue;
      }

      const tangent = /^tangent\s+y\s*=\s*(.+?)\s+at\s+(\S+)$/.exec(text);
      if (tangent) {
        model.items.push({ kind: 'tangent', fn: compileExpression(tangent[1]!), at: num(tangent[2]!), color: 'var(--d-gray)' });
        continue;
      }

      const { rest, options } = takeOptions(text);

      const parametric = /^\((.+)\)\s*t:\s*(\S+?)\.\.(\S+)$/.exec(rest);
      if (parametric) {
        const [fx, fy] = splitTopLevel(parametric[1]!);
        if (fx === undefined || fy === undefined) throw new Error('Нужно (x(t), y(t))');
        model.items.push({
          kind: 'parametric',
          fx: compileExpression(fx),
          fy: compileExpression(fy),
          range: [num(parametric[2]!), num(parametric[3]!)],
          options,
          color: nextColor(options.color),
        });
        continue;
      }

      const fn = /^y\s*=\s*(.+)$/.exec(rest);
      if (fn) {
        model.items.push({ kind: 'function', fn: compileExpression(fn[1]!), options, color: nextColor(options.color) });
        continue;
      }
      const vline = /^x\s*=\s*(.+)$/.exec(rest);
      if (vline) {
        model.items.push({ kind: 'vline', x: num(vline[1]!), options, color: resolveColor(options.color ?? 'gray') });
        continue;
      }
      throw new Error('непонятная команда');
    } catch (error) {
      throw new Error(`Строка ${line}: ${error instanceof Error ? error.message : error}`);
    }
  }
  if (model.x[0] >= model.x[1] || model.y[0] >= model.y[1]) throw new Error('Диапазон осей пустой');
  return model;
}

/** "cos(t), sin(t)" → ["cos(t)", "sin(t)"] — запятая только на верхнем уровне скобок */
function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of text) {
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else current += char;
  }
  parts.push(current.trim());
  return parts;
}

/** «Красивый» шаг делений: 1, 2, 5 × 10^k, чтобы делений было 5–10 */
export function niceStep(span: number, target = 8): number {
  const raw = span / target;
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  return (unit < 1.5 ? 1 : unit < 3 ? 2 : unit < 7 ? 5 : 10) * power;
}

function ticks([from, to]: Range): number[] {
  const step = niceStep(to - from);
  const result: number[] = [];
  for (let value = Math.ceil(from / step) * step; value <= to + step * 1e-9; value += step) result.push(Math.abs(value) < step * 1e-9 ? 0 : value);
  return result;
}

const formatTick = (value: number) => {
  const abs = Math.abs(value);
  if (abs >= 10000) return value.toExponential(0).replace('e+', 'e');
  return String(Math.round(value * 1000) / 1000);
};

const SAMPLES = 480;

export function PlotView({ model, width = 640, height = 360 }: { model: PlotModel; width?: number; height?: number }) {
  const clipId = `plot-${useId().replace(/[^a-z0-9]/gi, '')}`;
  const margin = { top: 14, right: 16, bottom: 30, left: 48 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const [x0, x1] = model.x;
  const [y0, y1] = model.y;
  const sx = (x: number) => margin.left + ((x - x0) / (x1 - x0)) * innerW;
  const sy = (y: number) => margin.top + innerH - ((y - y0) / (y1 - y0)) * innerH;
  const ySpan = y1 - y0;
  const fits = (y: number) => Number.isFinite(y) && y > y0 - ySpan * 4 && y < y1 + ySpan * 4;

  /** Путь функции с разрывами там, где она не определена или улетает (1/x около нуля) */
  function sampled(points: [number, number][]): string {
    let path = '';
    let pen = false;
    for (const [x, y] of points) {
      if (!Number.isFinite(x) || !fits(y)) {
        pen = false;
        continue;
      }
      path += `${pen ? 'L' : 'M'}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`;
      pen = true;
    }
    return path;
  }

  const safe = (fn: Expression, vars: Record<string, number>) => {
    try {
      return fn(vars);
    } catch {
      return NaN;
    }
  };

  const xs = Array.from({ length: SAMPLES + 1 }, (_, i) => x0 + ((x1 - x0) * i) / SAMPLES);
  const axisY = y0 <= 0 && y1 >= 0 ? sy(0) : sy(y0);
  const axisX = x0 <= 0 && x1 >= 0 ? sx(0) : sx(x0);
  const legend = model.items.filter(
    (item): item is Extract<PlotItem, { options: DrawOptions }> => 'options' in item && Boolean(item.options.label) && item.kind !== 'vline',
  );

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={styles.svg} role="img">
      <defs>
        <clipPath id={clipId}>
          <rect x={margin.left} y={margin.top} width={innerW} height={innerH} />
        </clipPath>
      </defs>

      {/* Сетка и подписи делений */}
      {ticks(model.x).map((value) => (
        <g key={`x${value}`}>
          {model.grid && <line className={styles.grid} x1={sx(value)} x2={sx(value)} y1={margin.top} y2={margin.top + innerH} />}
          <text className={styles.tick} x={sx(value)} y={margin.top + innerH + 18} textAnchor="middle">
            {formatTick(value)}
          </text>
        </g>
      ))}
      {ticks(model.y).map((value) => (
        <g key={`y${value}`}>
          {model.grid && <line className={styles.grid} x1={margin.left} x2={margin.left + innerW} y1={sy(value)} y2={sy(value)} />}
          <text className={styles.tick} x={margin.left - 8} y={sy(value) + 4} textAnchor="end">
            {formatTick(value)}
          </text>
        </g>
      ))}
      <line className={styles.axis} x1={margin.left} x2={margin.left + innerW} y1={axisY} y2={axisY} />
      <line className={styles.axis} x1={axisX} x2={axisX} y1={margin.top} y2={margin.top + innerH} />

      <g clipPath={`url(#${clipId})`}>
        {model.items.map((item, index) => {
          if (item.kind === 'area') {
            const from = Math.max(item.range[0], x0);
            const to = Math.min(item.range[1], x1);
            const steps = 160;
            const top: string[] = [];
            const bottom: string[] = [];
            for (let i = 0; i <= steps; i++) {
              const x = from + ((to - from) * i) / steps;
              const t = safe(item.top, { x });
              const b = safe(item.bottom, { x });
              if (!Number.isFinite(t) || !Number.isFinite(b)) continue;
              top.push(`${sx(x).toFixed(1)},${sy(t).toFixed(1)}`);
              bottom.unshift(`${sx(x).toFixed(1)},${sy(b).toFixed(1)}`);
            }
            return <polygon key={index} className={styles.area} points={[...top, ...bottom].join(' ')} />;
          }
          if (item.kind === 'function') {
            const d = sampled(xs.map((x) => [x, safe(item.fn, { x })]));
            return <path key={index} className={styles.curve} d={d} stroke={item.color} strokeDasharray={item.options.dashed ? '6 5' : undefined} />;
          }
          if (item.kind === 'parametric') {
            const [t0, t1] = item.range;
            const points = Array.from({ length: SAMPLES + 1 }, (_, i): [number, number] => {
              const t = t0 + ((t1 - t0) * i) / SAMPLES;
              return [safe(item.fx, { t }), safe(item.fy, { t })];
            });
            return <path key={index} className={styles.curve} d={sampled(points)} stroke={item.color} strokeDasharray={item.options.dashed ? '6 5' : undefined} />;
          }
          if (item.kind === 'vline') {
            return (
              <g key={index}>
                <line className={styles.curve} x1={sx(item.x)} x2={sx(item.x)} y1={margin.top} y2={margin.top + innerH} stroke={item.color} strokeDasharray={item.options.dashed ? '6 5' : undefined} />
                {item.options.label && (
                  <text className={styles.pointLabel} x={sx(item.x) + 6} y={margin.top + 14}>
                    {item.options.label}
                  </text>
                )}
              </g>
            );
          }
          if (item.kind === 'tangent') {
            const h = (x1 - x0) / 1e4;
            const slope = (safe(item.fn, { x: item.at + h }) - safe(item.fn, { x: item.at - h })) / (2 * h);
            const y = safe(item.fn, { x: item.at });
            const d = sampled(xs.map((x) => [x, y + slope * (x - item.at)]));
            return <path key={index} className={styles.curve} d={d} stroke={item.color} strokeDasharray="6 5" />;
          }
          return null;
        })}
      </g>

      {/* Точки — поверх, без обрезки, чтобы подписи у края не пропадали */}
      {model.items.map((item, index) =>
        item.kind === 'point' ? (
          <g key={`p${index}`}>
            <circle className={styles.point} cx={sx(item.x)} cy={sy(item.y)} r={4} />
            {item.label && (
              <text
                className={styles.pointLabel}
                x={sx(item.x) + (sx(item.x) > width - 120 ? -8 : 8)}
                y={sy(item.y) - 8}
                textAnchor={sx(item.x) > width - 120 ? 'end' : 'start'}
              >
                {item.label}
              </text>
            )}
          </g>
        ) : null,
      )}

      {legend.length > 0 && (
        <g transform={`translate(${margin.left + 10}, ${margin.top + 10})`}>
          <rect className={styles.legendBox} width={Math.max(...legend.map((item) => item.options.label!.length)) * 6.6 + 40} height={legend.length * 18 + 8} rx={6} />
          {legend.map((item, index) => (
            <g key={index} transform={`translate(10, ${index * 18 + 16})`}>
              <line x1={0} x2={18} y1={-4} y2={-4} stroke={item.color} strokeWidth={2.4} strokeDasharray={item.options.dashed ? '4 3' : undefined} />
              <text className={styles.legendText} x={26} y={0}>
                {item.options.label}
              </text>
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}
