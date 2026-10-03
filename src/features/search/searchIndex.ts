import { FileText, NotebookText } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SECTIONS, type Section } from '../../app/navigation';
import { M3102_STUDENTS } from '../../data/m3102';
import { COLLECTION_LABELS, rawUrl } from '../../services/githubContent';
import { useGroupStore } from '../group/groupStore';
import { useHomeworkStore } from '../homework/homeworkStore';
import { MATERIAL_TYPES } from '../materials/labels';
import { useLectureNotesStore } from '../materials/lectureNotesStore';
import { useMaterialsStore } from '../materials/materialsStore';
import { useNotesStore } from '../notes/notesStore';
import { useSubjectsStore } from '../subjects/subjectsStore';
import { formatTaskMeta } from '../tasks/labels';
import { useTasksStore } from '../tasks/tasksStore';

export interface SearchResult {
  id: string;
  title: string;
  meta?: string;
  icon: LucideIcon;
  /** Куда перейти при выборе */
  path: string;
  /** Длинный текст (конспект, ДЗ) — ищется тоже, в выдаче показывается кусок вокруг совпадения */
  body?: string;
}

export interface SearchGroup {
  label: string;
  results: SearchResult[];
}

const RESULTS_PER_GROUP = 4;
const NOTE_RESULTS = 8;
const SNIPPET_RADIUS = 48;

/** Регистр и «ё» не важны: «ежик» находит «Ёжик» */
export const normalize = (value: string) => value.toLowerCase().replace(/ё/g, 'е');

const TEX_SYMBOLS: Record<string, string> = {
  le: '≤',
  leq: '≤',
  ge: '≥',
  geq: '≥',
  ne: '≠',
  neq: '≠',
  in: '∈',
  notin: '∉',
  forall: '∀',
  exists: '∃',
  land: '∧',
  lor: '∨',
  neg: '¬',
  to: '→',
  infty: '∞',
  cdot: '·',
  times: '×',
  subset: '⊂',
  subseteq: '⊆',
  cup: '∪',
  cap: '∩',
  emptyset: '∅',
  varnothing: '∅',
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  varepsilon: 'ε',
  epsilon: 'ε',
  pi: 'π',
  Omega: 'Ω',
  Theta: 'Θ',
  langle: '⟨',
  rangle: '⟩',
  quad: ' ',
  qquad: ' ',
};

/** LaTeX → примерно читаемый текст: \mathbb{R} → R, \le → ≤, прочие команды выбрасываются */
function texToText(tex: string): string {
  return tex
    .replace(/\\(?:mathbb|mathrm|mathbf|mathcal|text|operatorname)\{([^}]*)\}/g, '$1')
    .replace(/\\([a-zA-Z]+)/g, (_, name: string) => TEX_SYMBOLS[name] ?? ' ')
    .replace(/[{}]/g, '');
}

/** Markdown/LaTeX → читаемый текст для поиска и сниппетов */
export function plainText(markdown: string): string {
  return (
    markdown
      // Код ищется, а схемы и тесты — нет: там служебный синтаксис (языки — как в Markdown.tsx и DiagramBlock)
      .replace(/```(\w*)[^\n]*\n?([\s\S]*?)```/g, (_, lang: string, code: string) =>
        /^(mermaid|quiz|graph|plot|chart|tree|array|diagram)$/.test(lang) ? ' ' : ` ${code} `,
      )
      .replace(/\$\$?([^$]*)\$\$?/g, (_, tex: string) => texToText(tex))
      .replace(/^:::.*$/gm, ' ')
      .replace(/!?\[\[([^\]|]+)(?:\\?\|([^\]]+))?\]\]/g, (_, target: string, label?: string) => label ?? target)
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/^>\s*\[![^\]]+\][+-]?/gm, '')
      .replace(/[#>*_`|~\\]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/** Кусок текста вокруг первого совпадения: «…предикат P(x) истинен…». normalized — normalize(text), если уже посчитан */
export function snippet(text: string, query: string, normalized = normalize(text)): string | undefined {
  const index = normalized.indexOf(query);
  if (index === -1) return undefined;
  const start = Math.max(0, index - SNIPPET_RADIUS);
  const end = Math.min(text.length, index + query.length + SNIPPET_RADIUS);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}

const PAGES: Section[] = [
  SECTIONS.today,
  SECTIONS.schedule,
  SECTIONS.homework,
  SECTIONS.deadlines,
  SECTIONS.materials,
  { label: 'Полезные ссылки', path: '/links', icon: SECTIONS.materials.icon },
  { label: 'Файлы группы', path: '/files', icon: SECTIONS.materials.icon },
  SECTIONS.students,
  SECTIONS.memes,
  SECTIONS.calendar,
  SECTIONS.tasks,
  SECTIONS.subjects,
  SECTIONS.notes,
  SECTIONS.settings,
];

/**
 * Текст PDF-конспектов группы: его вытаскивает робот репозитория группы (pdftotext) в
 * data/search-index.json — { files: [путь], sections: [[номер файла, заголовок, текст]] }.
 * Файл большой (~1.6 МБ), поэтому грузится при первом открытии поиска и живёт только в памяти.
 */
const pdfText = new Map<string, string>();
let pdfIndexLoad: Promise<void> | null = null;

/** Тексты PDF-конспектов группы по пути файла — для выгрузки предмета «Для ИИ» */
export async function loadPdfTexts(): Promise<ReadonlyMap<string, string>> {
  await loadPdfIndex();
  return pdfText;
}

export function loadPdfIndex(): Promise<void> {
  pdfIndexLoad ??= fetch(rawUrl('group', 'data/search-index.json'))
    .then((response) => (response.ok ? response.json() : null))
    .then((raw: { files?: string[]; sections?: [number, string, string][] } | null) => {
      if (!raw?.files || !Array.isArray(raw.sections)) return;
      for (const [file, heading, text] of raw.sections) {
        const path = raw.files[file];
        if (!path?.toLowerCase().endsWith('.pdf')) continue;
        pdfText.set(path, `${pdfText.get(path) ?? ''} ${heading} ${text}`);
      }
    })
    .catch(() => {
      pdfIndexLoad = null; // попробуем снова при следующем открытии
    });
  return pdfIndexLoad;
}

interface IndexedResult extends SearchResult {
  /** Заранее приведённые к поиску строки — чтобы не считать их на каждую букву запроса */
  key: string;
  bodyKey?: string;
}

let index: { inputs: unknown[]; groups: { label: string; results: IndexedResult[] }[] } | null = null;

/**
 * Индекс поиска: тексты конспектов (≈1 МБ) переводятся в простой текст один раз и пересобираются, только когда
 * поменялись данные (новый массив в store) или пришёл текст PDF.
 */
function indexedGroups() {
  const inputs = [
    useSubjectsStore.getState().subjects,
    useTasksStore.getState().tasks,
    useMaterialsStore.getState().materials,
    useLectureNotesStore.getState().lectureNotes,
    useNotesStore.getState().notes,
    useGroupStore.getState().deadlines,
    useGroupStore.getState().links,
    useHomeworkStore.getState().items,
    pdfText.size,
  ];
  if (index?.inputs.every((value, i) => value === inputs[i])) return index.groups;
  const groups = buildGroups().map((group) => ({
    label: group.label,
    results: group.results.map((result) => ({
      ...result,
      key: normalize(`${result.title}\n${result.meta ?? ''}`),
      bodyKey: result.body && normalize(result.body),
    })),
  }));
  index = { inputs, groups };
  return groups;
}

function buildGroups(): SearchGroup[] {
  const subjects = useSubjectsStore.getState().subjects;
  const tasks = useTasksStore.getState().tasks;
  const materials = useMaterialsStore.getState().materials;
  const lectureNotes = useLectureNotesStore.getState().lectureNotes;
  const notes = useNotesStore.getState().notes;
  const { deadlines, links } = useGroupStore.getState();
  const homework = useHomeworkStore.getState().items;
  const subjectName = (id: string | undefined) => subjects.find((subject) => subject.id === id)?.name;

  return [
    {
      label: 'Разделы',
      results: PAGES.map((page) => ({ id: page.path, title: page.label, icon: page.icon, path: page.path })),
    },
    {
      label: 'Конспекты',
      results: lectureNotes
        .filter((note) => !note.archived)
        .map((note) => ({
          id: note.id,
          title: note.lectureNumber ? `${note.lectureNumber}. ${note.title}` : note.title,
          meta: [subjectName(note.subjectId), COLLECTION_LABELS[note.collection ?? 'group']].filter(Boolean).join(' · '),
          icon: note.contentType === 'markdown' ? NotebookText : FileText,
          path: `/materials/notes/${note.id}`,
          body:
            note.contentType === 'markdown'
              ? plainText(note.content)
              : note.sourceRef && (note.collection ?? 'group') === 'group'
                ? pdfText.get(note.sourceRef)
                : undefined,
        })),
    },
    {
      label: 'Домашнее задание',
      results: homework.map((item) => ({
        id: item.id,
        title: item.subject,
        meta: item.due ? `до ${item.due.split('-').reverse().join('.')}` : 'без срока',
        icon: SECTIONS.homework.icon,
        path: SECTIONS.homework.path,
        body: plainText(item.text),
      })),
    },
    {
      label: 'Дедлайны',
      results: deadlines.map((item) => ({
        id: `deadline:${item.id}`,
        title: item.name,
        meta: item.note,
        icon: SECTIONS.deadlines.icon,
        path: SECTIONS.deadlines.path,
      })),
    },
    {
      label: 'Предметы',
      results: subjects.map((subject) => ({
        id: subject.id,
        title: subject.name,
        meta: subject.teacherPrimary,
        icon: SECTIONS.subjects.icon,
        path: `${SECTIONS.subjects.path}/${subject.id}`,
      })),
    },
    {
      label: 'Ссылки',
      results: links.map((link) => ({
        id: link.url,
        title: link.title,
        meta: [link.subject, link.description].filter(Boolean).join(' · '),
        icon: SECTIONS.materials.icon,
        path: '/links',
      })),
    },
    {
      label: 'Материалы',
      results: materials.map((material) => ({
        id: material.id,
        title: material.name,
        meta: subjectName(material.subjectId),
        icon: MATERIAL_TYPES[material.type].icon,
        path: SECTIONS.materials.path,
      })),
    },
    {
      label: 'Студенты',
      results: M3102_STUDENTS.map((student) => ({
        id: student.github,
        title: student.name,
        meta: `@${student.github}${student.role ? ` · ${student.role}` : ''}`,
        icon: SECTIONS.students.icon,
        path: SECTIONS.students.path,
      })),
    },
    {
      label: 'Учебный план',
      results: tasks.map((task) => ({
        id: task.id,
        title: task.title,
        meta: formatTaskMeta(subjectName(task.subjectId), task.type),
        icon: SECTIONS.tasks.icon,
        path: SECTIONS.tasks.path,
      })),
    },
    {
      label: 'Заметки',
      results: notes.map((note) => ({
        id: note.id,
        title: note.title,
        meta: subjectName(note.subjectId),
        icon: SECTIONS.notes.icon,
        path: SECTIONS.notes.path,
        body: note.content,
      })),
    },
  ];
}

/**
 * Ищет по названию, подписи и полному тексту (конспекты, ДЗ, заметки). Совпадения в названии —
 * выше; если нашлось только в тексте, подписью становится кусок текста вокруг совпадения.
 */
export function search(query: string): SearchGroup[] {
  const q = normalize(query.trim());
  if (!q) return [];

  return indexedGroups()
    .map((group) => {
      const byTitle: SearchResult[] = [];
      const byBody: SearchResult[] = [];
      for (const { key, bodyKey, ...result } of group.results) {
        if (key.includes(q)) {
          byTitle.push(result);
        } else if (result.body && bodyKey) {
          const found = snippet(result.body, q, bodyKey);
          if (found) byBody.push({ ...result, meta: found });
        }
      }
      const limit = group.label === 'Конспекты' ? NOTE_RESULTS : RESULTS_PER_GROUP;
      return { label: group.label, results: [...byTitle, ...byBody].slice(0, limit) };
    })
    .filter((group) => group.results.length > 0);
}
