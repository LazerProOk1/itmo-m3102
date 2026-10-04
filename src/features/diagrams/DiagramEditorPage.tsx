import {
  Check,
  Copy,
  Import,
  LayoutGrid,
  Link2,
  Minus,
  MousePointer2,
  Plus,
  Redo2,
  RotateCcw,
  Spline,
  SquarePlus,
  Trash2,
  Undo2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import { DiagramBlock, diagramError, isDiagramLanguage, type DiagramLanguage } from '../../components/diagrams/DiagramBlock';
import { parseGraph } from '../../components/diagrams/Graph';
import { splitLines } from '../../components/diagrams/parse';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { cn } from '../../lib/cn';
import { storageKey } from '../../lib/storage';
import { DiagramInspector, type Selection } from './DiagramInspector';
import {
  addNode,
  clearPositions,
  connect,
  decodeShare,
  deleteCanvasShape,
  deleteEdge,
  deleteNode,
  encodeShare,
  importGraph,
  moveCanvasShape,
  moveNode,
  type Point,
} from './diagramEdits';
import { DIAGRAM_TYPES } from './templates';
import styles from './DiagramEditorPage.module.css';

const DRAFT_KEY = storageKey('diagram-draft');

interface Draft {
  lang: DiagramLanguage;
  sources: Partial<Record<DiagramLanguage, string>>;
}

type Tool = 'select' | 'add' | 'connect';

const template = (lang: DiagramLanguage) => DIAGRAM_TYPES.find((type) => type.value === lang)!.template;
const snap = (value: number) => Math.round(value / 10) * 10;

function loadDraft(): Draft {
  try {
    const raw = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') as Draft | null;
    if (raw && isDiagramLanguage(raw.lang)) return raw;
  } catch {
    // нет хранилища или битый черновик — начнём с шаблона
  }
  return { lang: 'graph', sources: {} };
}

/** Перетаскивание на холсте: вершина, фигура холста, соединение или сдвиг всего холста */
type Drag =
  | { kind: 'node'; id: string; start: Point; element: SVGGElement; moved: boolean }
  | { kind: 'shape'; index: number; start: Point; element: SVGGElement; moved: boolean }
  | { kind: 'connect'; from: string }
  | { kind: 'pan'; x: number; y: number; panX: number; panY: number };

/**
 * Конструктор диаграмм: холст, где вершины перетаскиваются, добавляются и соединяются мышью, и исходный текст —
 * одно и то же: любое действие на холсте — правка текста (diagramEdits.ts), а правка текста сразу перерисовывает
 * холст. Отмена и повтор, масштаб, импорт графа из списка рёбер или матрицы, ссылка на диаграмму (#/diagrams?lang=…&src=…).
 * «Редактировать» под диаграммой конспекта открывает её здесь. Черновик (свой у каждого типа) хранится в браузере.
 */
export function DiagramEditorPage() {
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const [draft, setDraft] = useState<Draft>(() => {
    const saved = loadDraft();
    const incoming = location.state as { lang?: string; source?: string } | null;
    if (incoming?.lang && isDiagramLanguage(incoming.lang) && incoming.source)
      return { lang: incoming.lang, sources: { ...saved.sources, [incoming.lang]: incoming.source } };
    // Ссылка на диаграмму: #/diagrams?lang=graph&src=base64url
    const lang = params.get('lang') ?? '';
    const src = params.get('src');
    if (src && isDiagramLanguage(lang)) {
      try {
        const source = decodeShare(src);
        if (source.length < 12000) return { lang, sources: { ...saved.sources, [lang]: source } };
      } catch {
        // битая ссылка — откроем черновик
      }
    }
    return saved;
  });
  const [history, setHistory] = useState<{ undo: string[]; redo: string[]; at: number }>({ undo: [], redo: [], at: 0 });
  const [tool, setTool] = useState<Tool>('select');
  const [selection, setSelection] = useState<Selection>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const [copied, setCopied] = useState<'' | 'markdown' | 'link'>('');
  const [importOpen, setImportOpen] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const gutterRef = useRef<HTMLPreElement>(null);
  const dragRef = useRef<Drag | null>(null);

  const lang = draft.lang;
  const source = draft.sources[lang] ?? template(lang);
  const type = DIAGRAM_TYPES.find((item) => item.value === lang)!;
  const graphLike = lang === 'graph' || lang === 'diagram';
  const canAdd = graphLike || lang === 'canvas';

  // Ссылку из адреса прочитали — убираем, чтобы перезагрузка не затирала правки
  useEffect(() => {
    if (params.has('src')) setParams({}, { replace: true });
  }, [params, setParams]);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // без хранилища черновик просто не переживёт перезагрузку
    }
  }, [draft]);

  const error = useMemo(() => (source.trim() ? diagramError(lang, source) : undefined), [lang, source]);
  const errorLine = Number(/Строка (\d+)/.exec(error ?? '')?.[1] ?? 0);

  /**
   * Новый текст. Действия на холсте — отдельный шаг отмены; набор текста — шаг на паузу в наборе (0,7 с),
   * а не на каждую букву
   */
  const setSource = useCallback(
    (next: string, typing = false) => {
      if (next === source) return;
      setHistory((current) => {
        const now = Date.now();
        const merge = typing && now - current.at < 700;
        return { undo: merge ? current.undo : [...current.undo.slice(-99), source], redo: [], at: typing ? now : 0 };
      });
      setDraft((current) => ({ ...current, sources: { ...current.sources, [current.lang]: next } }));
    },
    [source],
  );

  const undo = () => {
    const previous = history.undo.at(-1);
    if (previous === undefined) return;
    setHistory({ undo: history.undo.slice(0, -1), redo: [...history.redo, source], at: 0 });
    setDraft((current) => ({ ...current, sources: { ...current.sources, [current.lang]: previous } }));
  };
  const redo = () => {
    const next = history.redo.at(-1);
    if (next === undefined) return;
    setHistory({ undo: [...history.undo, source], redo: history.redo.slice(0, -1), at: 0 });
    setDraft((current) => ({ ...current, sources: { ...current.sources, [current.lang]: next } }));
  };

  const switchLang = (next: DiagramLanguage) => {
    setDraft((current) => ({ ...current, lang: next }));
    setHistory({ undo: [], redo: [], at: 0 });
    setSelection(null);
    setTool('select');
    setView({ scale: 1, x: 0, y: 0 });
  };

  const deleteSelection = () => {
    if (!selection) return;
    if ('node' in selection && graphLike) setSource(deleteNode(source, lang, selection.node));
    else if ('edge' in selection) setSource(deleteEdge(source, selection.edge));
    else if ('shape' in selection) setSource(deleteCanvasShape(source, selection.shape));
    setSelection(null);
  };

  // Ctrl+Z / Ctrl+Shift+Z, Delete и Esc — когда фокус не в поле ввода (там свои отмена и удаление)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as Element | null)?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && (key === 'z' || key === 'y' || key === 'я' || key === 'н')) {
        event.preventDefault();
        if (event.shiftKey || key === 'y' || key === 'н') redo();
        else undo();
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && selection) {
        event.preventDefault();
        deleteSelection();
      } else if (event.key === 'Escape') {
        setSelection(null);
        setConnectFrom(null);
        setTool('select');
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  // Выбранное на холсте — обводкой (классом на элементе SVG: сам рисунок про выбор ничего не знает)
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.querySelectorAll(`.${styles.selected}`).forEach((element) => element.classList.remove(styles.selected!));
    const target = !selection
      ? null
      : 'node' in selection
        ? stage.querySelector(`[data-dgm-node="${CSS.escape(selection.node)}"]`)
        : 'edge' in selection
          ? stage.querySelector(`[data-dgm-edge="${selection.edge}"]`)
          : stage.querySelector(`[data-dgm-shape="${selection.shape}"]`);
    target?.classList.add(styles.selected!);
    if (connectFrom) stage.querySelector(`[data-dgm-node="${CSS.escape(connectFrom)}"]`)?.classList.add(styles.selected!);
  });

  /** Точка указателя в координатах рисунка (viewBox), с учётом масштаба и сдвига холста */
  const toDiagram = (event: { clientX: number; clientY: number }): Point | null => {
    const svg = stageRef.current?.querySelector<SVGSVGElement>('svg[role="img"]');
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return null;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const mapped = point.matrixTransform(matrix.inverse());
    return { x: mapped.x, y: mapped.y };
  };

  const graphModel = () => {
    try {
      return graphLike ? parseGraph(splitLines(source, lang), lang) : null;
    } catch {
      return null;
    }
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as Element;
    const node = target.closest<SVGGElement>('[data-dgm-node]');
    const edge = target.closest<SVGGElement>('[data-dgm-edge]');
    const shape = target.closest<SVGGElement>('[data-dgm-shape]');
    const point = toDiagram(event);

    if (node && graphLike) {
      const id = node.dataset.dgmNode!;
      if (tool === 'connect') {
        if (connectFrom && connectFrom !== id) {
          setSource(connect(source, connectFrom, id));
          setConnectFrom(null);
        } else {
          setConnectFrom(id);
          dragRef.current = { kind: 'connect', from: id };
        }
        return;
      }
      setSelection({ node: id });
      if (point) dragRef.current = { kind: 'node', id, start: point, element: node, moved: false };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (edge && graphLike) {
      setSelection({ edge: Number(edge.dataset.dgmEdge) });
      return;
    }
    if (shape && lang === 'canvas' && tool === 'select') {
      setSelection({ shape: Number(shape.dataset.dgmShape) });
      if (point) dragRef.current = { kind: 'shape', index: Number(shape.dataset.dgmShape), start: point, element: shape, moved: false };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (tool === 'add' && canAdd && point) {
      const ids = graphModel()?.nodes.map((item) => item.id) ?? [];
      setSource(addNode(source, lang as 'graph' | 'diagram' | 'canvas', { x: snap(point.x), y: snap(point.y) }, ids));
      setTool('select');
      return;
    }
    // Пустое место: снять выбор и двигать холст
    setSelection(null);
    setConnectFrom(null);
    dragRef.current = { kind: 'pan', x: event.clientX, y: event.clientY, panX: view.x, panY: view.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.kind === 'pan') {
      setView((current) => ({ ...current, x: drag.panX + event.clientX - drag.x, y: drag.panY + event.clientY - drag.y }));
      return;
    }
    if (drag.kind === 'node' || drag.kind === 'shape') {
      const point = toDiagram(event);
      if (!point) return;
      const [dx, dy] = [point.x - drag.start.x, point.y - drag.start.y];
      if (Math.hypot(dx, dy) > 3) drag.moved = true;
      // Пока тянут — сдвигаем сам элемент SVG, текст правим один раз в конце
      if (drag.moved) drag.element.style.transform = `translate(${dx}px, ${dy}px)`;
    }
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    if (drag.kind === 'connect') {
      const over = document.elementFromPoint(event.clientX, event.clientY)?.closest<SVGGElement>('[data-dgm-node]')?.dataset.dgmNode;
      if (over && over !== drag.from) {
        setSource(connect(source, drag.from, over));
        setConnectFrom(null);
      }
      return;
    }
    if ((drag.kind !== 'node' && drag.kind !== 'shape') || !drag.moved) return;
    const point = toDiagram(event);
    drag.element.style.transform = '';
    if (!point) return;
    const [dx, dy] = [point.x - drag.start.x, point.y - drag.start.y];
    if (drag.kind === 'shape') {
      setSource(moveCanvasShape(source, drag.index, snap(dx), snap(dy)));
      return;
    }
    const model = graphModel();
    const node = model?.nodes.find((item) => item.id === drag.id);
    if (!model || !node) return;
    const positions = new Map(model.nodes.map((item) => [item.id, { x: item.x!, y: item.y! }]));
    setSource(moveNode(source, lang as 'graph' | 'diagram', drag.id, { x: snap(node.x! + dx), y: snap(node.y! + dy) }, positions));
  };

  // Ctrl + колесо — масштаб. Обработчик обычный, не пассивный: иначе браузер увеличит всю страницу
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setView((current) => ({ ...current, scale: Math.max(0.35, Math.min(3, current.scale * (event.deltaY < 0 ? 1.1 : 0.9))) }));
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, []);

  const zoom = (factor: number | 'reset') =>
    setView((current) =>
      factor === 'reset' ? { scale: 1, x: 0, y: 0 } : { ...current, scale: Math.max(0.35, Math.min(3, current.scale * factor)) },
    );

  const markdown = `\`\`\`${lang}\n${source.trimEnd()}\n\`\`\``;
  const copy = (kind: 'markdown' | 'link') => {
    const text =
      kind === 'markdown' ? markdown : `${window.location.origin}${window.location.pathname}#/diagrams?lang=${lang}&src=${encodeShare(source)}`;
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(kind);
      setTimeout(() => setCopied(''), 1500);
    });
  };

  const lineCount = source.split('\n').length;
  const toolHint =
    tool === 'add'
      ? 'Нажмите на холст — там появится новая вершина'
      : tool === 'connect'
        ? connectFrom
          ? `Теперь вершину, куда провести ребро из ${connectFrom}`
          : 'Нажмите вершину, затем вторую — или протяните от одной к другой'
        : canAdd
          ? 'Перетащите вершину или фигуру · пустое место — двигать холст · Ctrl + колесо — масштаб'
          : 'Пустое место — двигать холст · Ctrl + колесо — масштаб';

  return (
    <>
      <PageHeader
        title="Диаграммы"
        subtitle="Соберите граф, функцию или схему и вставьте её в конспект."
        actions={
          <>
            <Button variant="ghost" icon={copied === 'link' ? Check : Link2} onClick={() => copy('link')}>
              {copied === 'link' ? 'Ссылка скопирована' : 'Ссылка'}
            </Button>
            <Button variant="primary" icon={copied === 'markdown' ? Check : Copy} onClick={() => copy('markdown')}>
              {copied === 'markdown' ? 'Скопировано' : 'Копировать Markdown'}
            </Button>
          </>
        }
      />

      <SegmentedControl
        label="Тип диаграммы"
        options={DIAGRAM_TYPES.map(({ value, label }) => ({ value, label }))}
        value={lang}
        onChange={switchLang}
      />

      <div className={styles.toolbar} role="toolbar" aria-label="Инструменты холста">
        <div className={styles.toolGroup}>
          <ToolButton icon={MousePointer2} label="Выбрать" active={tool === 'select'} onClick={() => setTool('select')} />
          {canAdd && <ToolButton icon={SquarePlus} label="Добавить" active={tool === 'add'} onClick={() => setTool('add')} />}
          {graphLike && <ToolButton icon={Spline} label="Соединить" active={tool === 'connect'} onClick={() => setTool('connect')} />}
          {(graphLike || lang === 'canvas') && <ToolButton icon={Trash2} label="Удалить" disabled={!selection} onClick={deleteSelection} />}
          {graphLike && <ToolButton icon={LayoutGrid} label="Авто-раскладка" onClick={() => setSource(clearPositions(source))} />}
          {lang === 'graph' && <ToolButton icon={Import} label="Импорт" onClick={() => setImportOpen(true)} />}
        </div>
        <div className={styles.toolGroup}>
          <ToolButton icon={Undo2} label="Отменить" title="Отменить (Ctrl+Z)" disabled={!history.undo.length} onClick={undo} />
          <ToolButton icon={Redo2} label="Повторить" title="Повторить (Ctrl+Shift+Z)" disabled={!history.redo.length} onClick={redo} />
        </div>
        <div className={styles.toolGroup}>
          <ToolButton icon={Minus} label="Уменьшить" iconOnly onClick={() => zoom(0.83)} />
          <button type="button" className={styles.zoomValue} onClick={() => zoom('reset')} title="Вернуть 100%">
            {Math.round(view.scale * 100)}%
          </button>
          <ToolButton icon={Plus} label="Увеличить" iconOnly onClick={() => zoom(1.2)} />
        </div>
      </div>

      <div className={styles.workspace}>
        <section className={styles.canvasPanel} aria-label="Холст">
          <p className={styles.toolHint}>{toolHint}</p>
          <div
            ref={stageRef}
            className={cn(styles.stage, tool === 'add' && styles.adding, tool === 'connect' && styles.connecting)}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => (dragRef.current = null)}
          >
            <div className={styles.viewport} style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}>
              {source.trim() ? (
                <DiagramBlock lang={lang} source={source} editable={false} />
              ) : (
                <p className={styles.empty}>Пусто — начните с шаблона.</p>
              )}
            </div>
          </div>
        </section>

        <aside className={styles.side}>
          <section className={styles.editor}>
            <div className={styles.editorHead}>
              <span>Исходный текст</span>
              <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => setSource(type.template)}>
                Шаблон
              </Button>
            </div>
            <div className={cn(styles.sourceWrap, error && styles.sourceInvalid)}>
              <pre ref={gutterRef} className={styles.gutter} aria-hidden>
                {Array.from({ length: lineCount }, (_, index) => (
                  <span key={index} className={cn(index + 1 === errorLine && styles.errorLine)}>
                    {index + 1}
                    {'\n'}
                  </span>
                ))}
              </pre>
              <textarea
                className={styles.textarea}
                value={source}
                onChange={(event) => setSource(event.target.value, true)}
                onScroll={(event) => {
                  if (gutterRef.current) gutterRef.current.scrollTop = event.currentTarget.scrollTop;
                }}
                spellCheck={false}
                aria-label="Исходный текст диаграммы"
                aria-invalid={Boolean(error)}
              />
            </div>
            {error ? (
              <p className={styles.error} role="alert">
                {error}
              </p>
            ) : (
              <p className={styles.hint}>{type.hint}</p>
            )}
          </section>

          <DiagramInspector lang={lang} source={source} selection={selection} onChange={(next) => setSource(next)} />
        </aside>
      </div>

      <ImportGraphDialog open={importOpen} onClose={() => setImportOpen(false)} onImport={(edges) => setSource(`${source.trimEnd()}\n${edges}`)} />
    </>
  );
}

function ToolButton({
  icon: Icon,
  label,
  active,
  iconOnly,
  title,
  ...rest
}: {
  icon: typeof Plus;
  label: string;
  active?: boolean;
  iconOnly?: boolean;
  title?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(styles.tool, active && styles.toolActive)}
      aria-pressed={active}
      aria-label={iconOnly ? label : undefined}
      title={title ?? label}
      {...rest}
    >
      <Icon size={15} strokeWidth={1.9} aria-hidden />
      {!iconOnly && <span>{label}</span>}
    </button>
  );
}

/** Импорт графа: список рёбер «A B 5» или матрица смежности — рёбра дописываются в текст */
function ImportGraphDialog({ open, onClose, onImport }: { open: boolean; onClose: () => void; onImport: (edges: string) => void }) {
  const [format, setFormat] = useState<'edges' | 'matrix'>('edges');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const submit = () => {
    try {
      onImport(importGraph(text, format));
      setText('');
      setError('');
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Не получилось прочитать граф.');
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Импорт графа"
      description={
        format === 'edges'
          ? 'По ребру в строке: откуда, куда и вес (необязательно).'
          : 'Первая строка — имена вершин, дальше квадратная матрица; 0 — нет ребра.'
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" onClick={submit} disabled={!text.trim()}>
            Добавить в граф
          </Button>
        </>
      }
    >
      <div className={styles.importBody}>
        <SegmentedControl
          label="Формат"
          options={[
            { value: 'edges', label: 'Список рёбер' },
            { value: 'matrix', label: 'Матрица смежности' },
          ]}
          value={format}
          onChange={setFormat}
        />
        <textarea
          className={styles.textarea}
          rows={8}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={format === 'edges' ? 'A B 5\nB C 2' : 'A B C\n0 1 0\n0 0 3\n2 0 0'}
          aria-label="Данные графа"
        />
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
