import { Check, Copy, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { DiagramBlock, isDiagramLanguage, type DiagramLanguage } from '../../components/diagrams/DiagramBlock';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { storageKey } from '../../lib/storage';
import { DIAGRAM_TYPES } from './templates';
import styles from './DiagramEditorPage.module.css';

const DRAFT_KEY = storageKey('diagram-draft');

interface Draft {
  lang: DiagramLanguage;
  sources: Partial<Record<DiagramLanguage, string>>;
}

const template = (lang: DiagramLanguage) => DIAGRAM_TYPES.find((type) => type.value === lang)!.template;

function loadDraft(): Draft {
  try {
    const raw = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') as Draft | null;
    if (raw && isDiagramLanguage(raw.lang)) return raw;
  } catch {
    // нет хранилища или битый черновик — начнём с шаблона
  }
  return { lang: 'graph', sources: {} };
}

/**
 * Конструктор диаграмм для конспектов: текст слева, картинка справа сразу же. Готовое — «Копировать
 * Markdown» и вставить в конспект, или скачать SVG/PNG. «Редактировать» под диаграммой конспекта
 * открывает её здесь. Черновик (свой у каждого типа) хранится в браузере.
 */
export function DiagramEditorPage() {
  const location = useLocation();
  const [draft, setDraft] = useState<Draft>(() => {
    const incoming = location.state as { lang?: string; source?: string } | null;
    const saved = loadDraft();
    if (incoming?.lang && isDiagramLanguage(incoming.lang) && incoming.source) {
      return { lang: incoming.lang, sources: { ...saved.sources, [incoming.lang]: incoming.source } };
    }
    return saved;
  });
  const [copied, setCopied] = useState(false);
  const source = draft.sources[draft.lang] ?? template(draft.lang);
  const type = DIAGRAM_TYPES.find((item) => item.value === draft.lang)!;

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // без хранилища черновик просто не переживёт перезагрузку
    }
  }, [draft]);

  const setSource = (value: string) => setDraft((current) => ({ ...current, sources: { ...current.sources, [current.lang]: value } }));
  const markdown = `\`\`\`${draft.lang}\n${source.trimEnd()}\n\`\`\``;

  return (
    <>
      <PageHeader title="Диаграммы" subtitle="Соберите граф, функцию или схему и вставьте её в конспект." />

      <SegmentedControl
        label="Тип диаграммы"
        options={DIAGRAM_TYPES.map(({ value, label }) => ({ value, label }))}
        value={draft.lang}
        onChange={(lang) => setDraft((current) => ({ ...current, lang }))}
      />

      <div className={styles.layout}>
        <section className={styles.editor}>
          <div className={styles.editorHead}>
            <span>Исходный текст</span>
            <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => setSource(type.template)}>
              Шаблон
            </Button>
          </div>
          <textarea
            className={styles.textarea}
            value={source}
            onChange={(event) => setSource(event.target.value)}
            spellCheck={false}
            aria-label="Исходный текст диаграммы"
          />
          <p className={styles.hint}>{type.hint}</p>
        </section>

        <section className={styles.preview} aria-label="Предпросмотр">
          {source.trim() ? <DiagramBlock lang={draft.lang} source={source} editable={false} /> : <p className={styles.empty}>Пусто — начните с шаблона.</p>}
          <div className={styles.actions}>
            <Button
              variant="primary"
              icon={copied ? Check : Copy}
              onClick={() =>
                void navigator.clipboard.writeText(markdown).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                })
              }
            >
              {copied ? 'Скопировано' : 'Копировать Markdown'}
            </Button>
          </div>
          <pre className={styles.markdown}>
            <code>{markdown}</code>
          </pre>
        </section>
      </div>
    </>
  );
}
