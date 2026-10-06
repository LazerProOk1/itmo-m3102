import { resolveSubjectFolder, STREAM_SUBJECT_FOLDERS } from '../data/m3102';
import { useLectureNotesStore } from '../features/materials/lectureNotesStore';
import { useMaterialsStore } from '../features/materials/materialsStore';
import { useSubjectInfoStore } from '../features/subjects/subjectInfoStore';
import { useTasksStore } from '../features/tasks/tasksStore';
import { parseDeadlines, parseLinks, useGroupStore, type RepoFile } from '../features/group/groupStore';
import { parseHomework, useHomeworkStore } from '../features/homework/homeworkStore';
import { githubError, githubFetch } from './github';
import { parseGroupSchedule, type GroupSchedule } from './groupSchedule';
import { quizPageToMarkdown } from '../components/quiz/parseQuiz';
import { useScheduleStore } from '../features/schedule/scheduleStore';
import { useSemesterSettingsStore } from '../features/settings/semesterSettingsStore';
import { storageKey } from '../lib/storage';
import type { LectureNote, Material, MaterialCategory, MaterialType, SubjectInfo } from '../types/models';

/**
 * Контент из двух публичных репозиториев:
 *
 * group — RedstoneLord/itmo-m3102 (он же сайт группы на GitHub Pages):
 *   Конспекты/{Полное_имя_предмета}/{Лекция_N|Практика_N|Доп_Материалы}/файл.md|pdf|docx|html
 *   Материалы/{Предмет}/…, Лабораторные/{Предмет}/…, Записи лекций/{Предмет}/…, Дедлайны/deadlines.json,
 *   data/homework.json — общее ДЗ группы, data/links.json — полезные ссылки
 *
 * Описания курсов (баллы, преподаватели) лежат у нас: `src/data/courseInfo/{Предмет}.md` — скопированы
 *   из Kefirleos/itmo-vault (Obsidian-хранилище 1 потока), сайт больше не обращается к тому репозиторию.
 *   Конспекты потока на сайте не показываются (решение владельца 05.10.2026).
 *
 * Список файлов — по 1 запросу к GitHub API на репозиторий (лимит 60/час без токена), сами файлы —
 * с raw.githubusercontent.com (CORS открыт, лимита нет). Записи имеют id "gh:{путь}".
 */
export const REPOS = {
  group: { name: 'RedstoneLord/itmo-m3102', branch: 'master' },
} as const;

/** Откуда описания приехали — id и sourceRef записей остаются прежними, чтобы сохранённые не задвоились */
const COURSE_INFO_FOLDER = 'Конспекты/1 семестр/Поток 1/';

const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/');

/**
 * Адрес файла репозитория группы для показа (PDF, картинки, аудио). Раньше это был GitHub Pages репозитория — он раздавал
 * весь репозиторий; теперь Pages публикует только готовый сайт (`app/site`), и конспектов там нет (404). Берём
 * raw.githubusercontent.com: CORS открыт, лимита нет. Минус: html-файл показывается там как текст, а не страницей.
 */
export function fileUrl(path: string): string {
  return rawUrl('group', path);
}

/** Оригинал конспекта на GitHub — для кнопки «Оригинал» на странице чтения */
export function noteSourceUrl(note: Pick<LectureNote, 'sourceRef'>): string | undefined {
  if (!note.sourceRef) return undefined;
  return `https://github.com/${REPOS.group.name}/blob/${REPOS.group.branch}/${encodePath(note.sourceRef)}`;
}

export function rawUrl(repo: keyof typeof REPOS, path: string): string {
  return `https://raw.githubusercontent.com/${REPOS[repo].name}/${REPOS[repo].branch}/${encodePath(path)}`;
}

/**
 * Куда переехал файл группы: робот репозитория переименовывает файлы (пробелы → «_») и пишет
 * data/old-paths.json { "старый путь": "новый путь" }. Нужен, чтобы старые ссылки на конспекты не ломались.
 */
let movedPaths: Promise<Record<string, string>> | null = null;
export async function findMovedPath(path: string): Promise<string | undefined> {
  movedPaths ??= fetch(rawUrl('group', 'data/old-paths.json'))
    .then((response) => (response.ok ? response.json() : {}))
    .catch(() => ({}));
  const map = await movedPaths;
  // Цепочка переименований: a → b → c (с защитой от петли)
  let current = path.normalize('NFC');
  for (let step = 0; step < 10 && map[current]; step++) current = map[current]!.normalize('NFC');
  return current === path.normalize('NFC') ? undefined : current;
}

const MATERIAL_SECTIONS: Record<string, { category: MaterialCategory; label: string }> = {
  Материалы: { category: 'literature', label: '' },
  Лабораторные: { category: 'assignments', label: '' },
  'Записи лекций': { category: 'other', label: 'Запись лекции — ' },
};

export interface SyncSummary {
  /** Конспектов группы */
  group: number;
  subjectInfo: number;
  materials: number;
  deadlines: number;
  homework: number;
  links: number;
  /** Регулярных пар в расписании группы */
  schedule: number;
}

const extension = (name: string) => name.slice(name.lastIndexOf('.') + 1).toLowerCase();
const stem = (name: string) => name.slice(0, name.lastIndexOf('.'));
const prettify = (name: string) => stem(name).replace(/_/g, ' ').trim();

/** "Лекция_2-3" → "Лекция 2-3", "Доп_Материалы" → "Доп Материалы"; старый формат "1 прак" → "Практика 1" */
export function parseLessonFolder(folder: string): string {
  const name = folder.replace(/_/g, ' ').trim();
  const match = name.match(/^(\d+(?:-\d+)?)\s*(.*)$/u);
  if (!match) return name;
  const kind = match[2]!.toLowerCase();
  const label = kind.startsWith('лек') ? 'Лекция' : kind.startsWith('прак') ? 'Практика' : match[2]!;
  return `${label} ${match[1]}`;
}

/** YAML-шапка `--- main: true ---` в начале конспекта (служебная, для индекса лекций группы) */
export function stripFrontMatter(text: string): string {
  const match = /^﻿?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  if (!match) return text;
  const lines = match[1]!.split(/\r?\n/).filter((line) => line.trim());
  return lines.length && lines.every((line) => /^[\w.-]+\s*:/.test(line.trim())) ? text.slice(match[0].length) : text;
}

/**
 * Описание курса из хранилища потока без разделов «Конспекты…» и «Навигация»: список конспектов
 * на сайте свой, а навигация ведёт по Obsidian-хранилищу. Остальное приходит синхронизацией как есть.
 */
export function stripVaultSections(text: string): string {
  const kept = text
    .split(/\r?\n(?=## )/)
    .filter((section) => !/^## .*(Конспект|Навигаци)/i.test(section))
    .join('\n');
  // Разделитель `---` перед вырезанным последним разделом
  return kept.replace(/(\s*\n---\s*)+$/, '').trimEnd();
}

/** Папка файла в raw-виде — относительные картинки в конспектах (`../img/diagram.svg`) считаются от неё */
export function noteAssetBase(note: Pick<LectureNote, 'sourceRef'>): string | undefined {
  if (!note.sourceRef) return undefined;
  return rawUrl('group', note.sourceRef.slice(0, note.sourceRef.lastIndexOf('/') + 1));
}

function materialType(name: string): MaterialType {
  const ext = extension(name);
  if (ext === 'pdf') return 'pdf';
  if (ext === 'ppt' || ext === 'pptx') return 'presentation';
  if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return 'image';
  if (['doc', 'docx', 'djvu', 'txt', 'md'].includes(ext)) return 'document';
  return 'other';
}

/** Зависшее соединение не должно держать «Синхронизация…» вечно */
const timeout = () => AbortSignal.timeout(20_000);

async function fetchResponse(url: string): Promise<Response> {
  const response = await fetch(url, { cache: 'no-store', signal: timeout() });
  if (!response.ok) throw new Error(`Не удалось загрузить ${decodeURI(url)} (${response.status})`);
  return response;
}

const fetchText = (url: string) => fetchResponse(url).then((response) => response.text());

interface TreeFile extends RepoFile {
  sha: string;
}

/** Поменялся разбор файлов (stripFrontMatter, splitTitle…) — увеличить: все конспекты скачаются и разберутся заново */
const PARSER_VERSION = 1;
const fileVersion = (file: TreeFile) => `${PARSER_VERSION}:${file.sha}`;

/** git blob sha — им GitHub подписывает файл в дереве репозитория: sha1("blob <размер>\0" + байты) */
export async function blobSha(bytes: Uint8Array): Promise<string> {
  const header = new TextEncoder().encode(`blob ${bytes.length}\0`);
  const data = new Uint8Array(header.length + bytes.length);
  data.set(header);
  data.set(bytes, header.length);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-1', data));
  return [...hash].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Текст файла и его версия для кеша. Версию ставим, только если sha скачанного совпал с деревом: raw-сервер
 * кеширует файлы ~5 минут и сразу после правки может отдать старый текст — тогда без версии, скачаем в следующий раз
 */
async function fetchFile(repo: keyof typeof REPOS, file: TreeFile): Promise<{ text: string; version?: string }> {
  const bytes = new Uint8Array(await (await fetchResponse(rawUrl(repo, file.path))).arrayBuffer());
  // crypto.subtle есть только на https и localhost — по адресу из локальной сети просто без кеша
  const verified = crypto.subtle !== undefined && (await blobSha(bytes)) === file.sha;
  return { text: new TextDecoder().decode(bytes), version: verified ? fileVersion(file) : undefined };
}

async function fetchTree(repo: keyof typeof REPOS): Promise<TreeFile[]> {
  const { name, branch } = REPOS[repo];
  const response = await githubFetch(`https://api.github.com/repos/${name}/git/trees/${branch}?recursive=1`, { signal: timeout() });
  if (!response.ok) throw new Error(`${name}: ${githubError(response.status, false, response)}`);
  const tree = (await response.json()) as { truncated?: boolean; tree: { path: string; type: string; size?: number; sha: string }[] };
  // Неполный список нельзя принимать за полный: пропавшие из него конспекты ушли бы в архив
  if (tree.truncated) throw new Error(`${name}: GitHub отдал неполный список файлов — синхронизация отменена.`);
  return tree.tree.filter((entry) => entry.type === 'blob').map((entry) => ({ path: entry.path, size: entry.size ?? 0, sha: entry.sha }));
}

const BLACKBOARD: Record<string, string> = { C: 'ℂ', N: 'ℕ', Q: 'ℚ', R: 'ℝ', Z: 'ℤ' };

/** "Конспект лекции: Поле $\mathbb{C}$" → "Поле ℂ" — в списках формулы не рендерятся */
export function cleanTitle(title: string): string {
  return title
    .replace(/\\mathbb\{(\w)\}/gu, (_, letter: string) => BLACKBOARD[letter] ?? letter)
    .replace(/\$/gu, '')
    .replace(/^Конспект(?: лекции)?:\s*/iu, '')
    .trim();
}

/** Убирает первый заголовок "# …" — название конспекта и так показывается над текстом */
function splitTitle(markdown: string): { title?: string; content: string } {
  const match = markdown.match(/^﻿?\s*#\s+(.+)\r?\n/u);
  return match ? { title: cleanTitle(match[1]!), content: markdown.slice(match[0].length).trimStart() } : { content: markdown };
}

type NoteFields = Pick<LectureNote, 'subjectId' | 'lectureNumber' | 'title' | 'contentType' | 'content' | 'sourceVersion'>;

function toNote(path: string, fields: NoteFields, previous: LectureNote[], now: string): LectureNote {
  const id = `gh:${path}`;
  const old = previous.find((note) => note.id === id);
  const unchanged = old && old.content === fields.content && old.title === fields.title;
  return {
    ...fields,
    id,
    createdAt: old?.createdAt ?? now,
    updatedAt: unchanged ? old.updatedAt : now,
    lastOpenedAt: old?.lastOpenedAt,
    source: 'github',
    sourceRef: path,
    archived: false,
  };
}

async function buildGroupNotes(tree: TreeFile[], previous: LectureNote[], now: string): Promise<LectureNote[]> {
  const files = tree
    .map((file) => ({ file, path: file.path, parts: file.path.split('/') }))
    .filter(({ parts }) => parts[0] === 'Конспекты' && parts.length === 4 && parts[2]!.toLowerCase() !== 'img' && resolveSubjectFolder(parts[1]!));

  return Promise.all(
    files.map(async ({ file, path, parts }) => {
      const [, subjectFolder, lessonFolder, name] = parts as [string, string, string, string];
      const ext = extension(name);
      let title = `${prettify(name)} (${ext.toUpperCase()})`;
      let content = fileUrl(path);
      let sourceVersion: string | undefined;
      if (ext === 'md') {
        // Файл не менялся с прошлой синхронизации — не качаем
        const old = previous.find((note) => note.id === `gh:${path}`);
        if (old?.sourceVersion === fileVersion(file)) return { ...old, archived: false };
        // Название — по имени файла, как на сайте группы; первый заголовок убираем, только если он его повторяет
        // Файл-тест (mode: quiz) — один блок ```quiz, обычный конспект — без служебной шапки
        const fetched = await fetchFile('group', file);
        sourceVersion = fetched.version;
        const text = stripFrontMatter(quizPageToMarkdown(fetched.text));
        const split = splitTitle(text);
        title = prettify(name);
        content = split.title?.toLowerCase() === title.toLowerCase() ? split.content : text;
      }
      return toNote(
        path,
        {
          subjectId: resolveSubjectFolder(subjectFolder)!,
          lectureNumber: parseLessonFolder(lessonFolder),
          title,
          contentType: ext === 'md' ? 'markdown' : ext === 'pdf' ? 'pdf' : 'link',
          content,
          sourceVersion,
        },
        previous,
        now,
      );
    }),
  );
}

/** Описания курсов — из встроенных файлов `src/data/courseInfo` (без сети): без списка конспектов и навигации */
async function buildCourseInfo(info: SubjectInfo[], now: string): Promise<SubjectInfo[]> {
  const { COURSE_INFO_FILES } = await import('./courseInfoFiles');
  return Object.entries(COURSE_INFO_FILES).flatMap(([file, raw]): SubjectInfo[] => {
    const name = stem(file.slice(file.lastIndexOf('/') + 1));
    const subjectId = STREAM_SUBJECT_FOLDERS[name];
    if (!subjectId) return [];
    const path = `${COURSE_INFO_FOLDER}${name}/${name}.md`;
    const old = info.find((item) => item.id === `gh:${path}`);
    const content = stripVaultSections(splitTitle(stripFrontMatter(raw)).content);
    return [
      {
        id: `gh:${path}`,
        createdAt: old?.createdAt ?? now,
        updatedAt: old?.content === content ? old.updatedAt : now,
        subjectId,
        title: 'Описание курса (1 поток)',
        content,
        category: 'description',
        source: 'github',
        sourceRef: path,
        sourceVersion: 'bundled',
        archived: false,
      },
    ];
  });
}

function buildMaterials(paths: string[], previous: Material[], now: string): Material[] {
  return paths.flatMap((path): Material[] => {
    const parts = path.split('/');
    const section = MATERIAL_SECTIONS[parts[0]!];
    if (!section || parts.length !== 3) return [];
    const name = parts[2]!;
    const old = previous.find((material) => material.id === `gh:${path}`);
    return [
      {
        id: `gh:${path}`,
        createdAt: old?.createdAt ?? now,
        updatedAt: old?.updatedAt ?? now,
        name: section.label + prettify(name),
        subjectId: resolveSubjectFolder(parts[1]!),
        category: section.category,
        type: materialType(name),
        url: fileUrl(path),
      },
    ];
  });
}

const LAST_SYNC_KEY = storageKey('last-sync');
const AUTO_SYNC_INTERVAL = 10 * 60 * 1000;

/** При открытии приложения — не чаще раза в 10 минут, чтобы перезагрузки не съедали лимит GitHub API */
export async function autoSyncGithubContent(): Promise<void> {
  if (Date.now() - Number(localStorage.getItem(LAST_SYNC_KEY) ?? 0) < AUTO_SYNC_INTERVAL) return;
  await syncGithubContent();
}

/**
 * Расписание группы заменяет встроенное (m3102-class-*) и прошлую синхронизацию (gh:*).
 * Пары и исключения, добавленные вручную в режиме редактирования, остаются.
 */
function applyGroupSchedule(schedule: GroupSchedule) {
  const isSynced = (id: string) => id.startsWith('gh:') || id.startsWith('m3102-class-');
  useScheduleStore.setState((state) => {
    const classes = [...schedule.classes, ...state.classes.filter((item) => !isSynced(item.id))];
    const classIds = new Set(classes.map((item) => item.id));
    const ownExceptions = state.exceptions.filter((item) => !isSynced(item.id) && (item.kind === 'additional' || classIds.has(item.classId)));
    return { classes, exceptions: [...schedule.exceptions, ...ownExceptions] };
  });
  useSemesterSettingsStore.getState().updateSemesterSettings({ weekOneStart: schedule.weekOneStart });
}

/**
 * Синхронизирует оба репозитория независимо: если один недоступен, второй всё равно обновится.
 * Файлы, которых больше нет в репозитории: конспекты и описания курсов архивируются, материалы
 * удаляются. Ручные записи не трогает.
 */
export async function syncGithubContent(): Promise<SyncSummary> {
  const now = new Date().toISOString();
  const notesBefore = useLectureNotesStore.getState().lectureNotes;
  const infoBefore = useSubjectInfoStore.getState().items;
  const materialsBefore = useMaterialsStore.getState().materials;

  const [group, courses] = await Promise.allSettled([
    fetchTree('group').then(async (tree) => {
      const paths = tree.map((file) => file.path);
      const files: RepoFile[] = tree.map(({ path, size, sha }) => ({ path, size, sha }));
      const [notes, deadlines, homework, links, schedule] = await Promise.all([
        buildGroupNotes(tree, notesBefore, now),
        fetchText(rawUrl('group', 'Дедлайны/deadlines.json')).then((text) => parseDeadlines(JSON.parse(text))),
        fetchText(rawUrl('group', 'data/homework.json')).then((text) => parseHomework(JSON.parse(text))),
        fetchText(rawUrl('group', 'data/links.json')).then((text) => parseLinks(JSON.parse(text))),
        // Расписание необязательно: если файл сломан или пропал, остаётся прежнее
        fetchText(rawUrl('group', 'data/schedule.json'))
          .then((text) => parseGroupSchedule(JSON.parse(text)))
          .catch(() => null),
      ]);
      return { files, notes, deadlines, homework, links, schedule, materials: buildMaterials(paths, materialsBefore, now) };
    }),
    buildCourseInfo(infoBefore, now),
  ]);

  const summary: SyncSummary = { group: 0, subjectInfo: 0, materials: 0, deadlines: 0, homework: 0, links: 0, schedule: 0 };

  if (group.status === 'fulfilled') {
    const { files, notes, deadlines, homework, links, schedule, materials } = group.value;
    const ids = new Set(notes.map((note) => note.id));
    useLectureNotesStore.setState((state) => ({
      lectureNotes: [
        ...notes,
        ...state.lectureNotes.filter((note) => !ids.has(note.id)).map((note) => (note.source === 'github' ? { ...note, archived: true } : note)),
      ],
    }));
    summary.group = notes.length;
    useMaterialsStore.setState((state) => ({
      materials: [...materials, ...state.materials.filter((material) => !material.id.startsWith('gh:'))],
    }));
    useGroupStore.setState({ files, deadlines, links });
    if (schedule) {
      applyGroupSchedule(schedule);
      summary.schedule = schedule.classes.length;
    }
    useHomeworkStore.getState().setRemote(homework);
    // Раньше дедлайны группы складывались в задачи (id "gh:deadline:…") — теперь у них своя страница
    useTasksStore.setState((state) => ({ tasks: state.tasks.filter((task) => !task.id.startsWith('gh:')) }));
    Object.assign(summary, { materials: materials.length, deadlines: deadlines.length, homework: homework.length, links: links.length });
  }

  if (courses.status === 'fulfilled') {
    const ids = new Set(courses.value.map((item) => item.id));
    useSubjectInfoStore.setState((state) => ({
      items: [
        ...courses.value,
        ...state.items.filter((item) => !ids.has(item.id)).map((item) => (item.source === 'github' ? { ...item, archived: true } : item)),
      ],
    }));
    summary.subjectInfo = courses.value.length;
  }

  // Хоть один репозиторий обновился — следующая автосинхронизация через 10 минут: иначе недоступный второй
  // заставлял бы синхронизироваться заново при каждом открытии сайта и тратить лимит GitHub API
  if (group.status === 'fulfilled' || courses.status === 'fulfilled') localStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
  const failed = [group, courses].find((result) => result.status === 'rejected');
  if (failed) throw failed.reason instanceof Error ? failed.reason : new Error('Не удалось синхронизироваться с GitHub.');
  return summary;
}
