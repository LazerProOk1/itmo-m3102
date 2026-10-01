import { resolveSubjectFolder, STREAM_SUBJECT_FOLDERS } from '../data/m3102';
import { useLectureNotesStore } from '../features/materials/lectureNotesStore';
import { useMaterialsStore } from '../features/materials/materialsStore';
import { useSubjectInfoStore } from '../features/subjects/subjectInfoStore';
import { useTasksStore } from '../features/tasks/tasksStore';
import { parseDeadlines, useGroupStore, type RepoFile } from '../features/group/groupStore';
import { parseHomework, useHomeworkStore } from '../features/homework/homeworkStore';
import { githubError, githubFetch } from './github';
import { storageKey } from '../lib/storage';
import type { LectureNote, LectureNoteCollection, Material, MaterialCategory, MaterialType, SubjectInfo } from '../types/models';

/**
 * Контент из двух публичных репозиториев:
 *
 * group — RedstoneLord/itmo-m3102 (он же сайт группы на GitHub Pages):
 *   Конспекты/{Полное_имя_предмета}/{Лекция_N|Практика_N|Доп_Материалы}/файл.md|pdf|docx|html
 *   Материалы/{Предмет}/…, Лабораторные/{Предмет}/…, Записи лекций/{Предмет}/…, Дедлайны/deadlines.json,
 *   data/homework.json — общее ДЗ группы
 *
 * stream — Kefirleos/itmo-vault, Obsidian-хранилище 1 потока:
 *   Конспекты/1 семестр/Поток 1/{Предмет}/{NN}. {Тип} - {Название} ({YYYY-MM-DD}).md
 *   Конспекты/1 семестр/Поток 1/{Предмет}/{Предмет}.md — описание курса (SubjectInfo)
 *
 * Список файлов — по 1 запросу к GitHub API на репозиторий (лимит 60/час без токена), сами файлы —
 * с raw.githubusercontent.com / GitHub Pages (CORS открыт, лимита нет). Записи имеют id "gh:{путь}".
 */
export const REPOS = {
  group: { name: 'RedstoneLord/itmo-m3102', branch: 'master' },
  stream: { name: 'Kefirleos/itmo-vault', branch: 'main' },
} as const;

export const COLLECTION_LABELS: Record<LectureNoteCollection, string> = {
  stream: 'Конспекты 1 потока',
  group: 'Конспекты группы M3102',
};

const PAGES_BASE = 'https://redstonelord.github.io/itmo-m3102/';
const STREAM_FOLDER = 'Конспекты/1 семестр/Поток 1/';

const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/');

/** Файл репозитория группы на GitHub Pages — там html открывается как страница, а не текст */
export function fileUrl(path: string): string {
  return PAGES_BASE + encodePath(path);
}

/** Оригинал конспекта на GitHub — для кнопки «Оригинал» на странице чтения */
export function noteSourceUrl(note: Pick<LectureNote, 'sourceRef' | 'collection'>): string | undefined {
  if (!note.sourceRef) return undefined;
  const repo = REPOS[note.collection ?? 'group'];
  return `https://github.com/${repo.name}/blob/${repo.branch}/${encodePath(note.sourceRef)}`;
}

export function rawUrl(repo: keyof typeof REPOS, path: string): string {
  return `https://raw.githubusercontent.com/${REPOS[repo].name}/${REPOS[repo].branch}/${encodePath(path)}`;
}

const MATERIAL_SECTIONS: Record<string, { category: MaterialCategory; label: string }> = {
  Материалы: { category: 'literature', label: '' },
  Лабораторные: { category: 'assignments', label: '' },
  'Записи лекций': { category: 'other', label: 'Запись лекции — ' },
};

export interface SyncSummary {
  stream: number;
  group: number;
  subjectInfo: number;
  materials: number;
  deadlines: number;
  homework: number;
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

/** Папка файла в raw-виде — относительные картинки в конспектах (`../img/diagram.svg`) считаются от неё */
export function noteAssetBase(note: Pick<LectureNote, 'sourceRef' | 'collection'>): string | undefined {
  if (!note.sourceRef) return undefined;
  return rawUrl(note.collection ?? 'group', note.sourceRef.slice(0, note.sourceRef.lastIndexOf('/') + 1));
}

const STREAM_LESSON = /^(\d+)\.\s*(\S+)\s*-\s*(.+?)\s*\((\d{4}-\d{2}-\d{2})\)$/u;

/** "02. Лекция - Предикаты и кванторы (2026-09-09)" → Лекция 2 / Предикаты и кванторы / дата */
export function parseStreamFilename(name: string): { lectureNumber: string; title: string; date: string } | null {
  const match = stem(name).match(STREAM_LESSON);
  return match ? { lectureNumber: `${match[2]} ${Number(match[1])}`, title: match[3]!, date: match[4]! } : null;
}

function materialType(name: string): MaterialType {
  const ext = extension(name);
  if (ext === 'pdf') return 'pdf';
  if (ext === 'ppt' || ext === 'pptx') return 'presentation';
  if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return 'image';
  if (['doc', 'docx', 'djvu', 'txt', 'md'].includes(ext)) return 'document';
  return 'other';
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Не удалось загрузить ${decodeURI(url)} (${response.status})`);
  return response.text();
}

async function fetchTree(repo: keyof typeof REPOS): Promise<RepoFile[]> {
  const { name, branch } = REPOS[repo];
  const response = await githubFetch(`https://api.github.com/repos/${name}/git/trees/${branch}?recursive=1`);
  if (!response.ok) throw new Error(`${name}: ${githubError(response.status)}`);
  const tree = (await response.json()) as { tree: { path: string; type: string; size?: number }[] };
  return tree.tree.filter((entry) => entry.type === 'blob').map((entry) => ({ path: entry.path, size: entry.size ?? 0 }));
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

type NoteFields = Pick<LectureNote, 'subjectId' | 'lectureNumber' | 'title' | 'contentType' | 'content' | 'collection'>;

function toNote(path: string, fields: NoteFields, previous: LectureNote[], now: string, createdAt = now): LectureNote {
  const id = `gh:${path}`;
  const old = previous.find((note) => note.id === id);
  const unchanged = old && old.content === fields.content && old.title === fields.title;
  return {
    ...fields,
    id,
    createdAt: old?.createdAt ?? createdAt,
    updatedAt: unchanged ? old.updatedAt : now,
    lastOpenedAt: old?.lastOpenedAt,
    source: 'github',
    sourceRef: path,
    archived: false,
  };
}

async function buildGroupNotes(paths: string[], previous: LectureNote[], now: string): Promise<LectureNote[]> {
  const files = paths
    .map((path) => ({ path, parts: path.split('/') }))
    .filter(({ parts }) => parts[0] === 'Конспекты' && parts.length === 4 && parts[2]!.toLowerCase() !== 'img' && resolveSubjectFolder(parts[1]!));

  return Promise.all(
    files.map(async ({ path, parts }) => {
      const [, subjectFolder, lessonFolder, name] = parts as [string, string, string, string];
      const ext = extension(name);
      let title = `${prettify(name)} (${ext.toUpperCase()})`;
      let content = fileUrl(path);
      if (ext === 'md') {
        const split = splitTitle(stripFrontMatter(await fetchText(rawUrl('group', path))));
        title = split.title ?? prettify(name);
        content = split.content;
      }
      return toNote(
        path,
        {
          subjectId: resolveSubjectFolder(subjectFolder)!,
          lectureNumber: parseLessonFolder(lessonFolder),
          title,
          contentType: ext === 'md' ? 'markdown' : ext === 'pdf' ? 'pdf' : 'link',
          content,
          collection: 'group',
        },
        previous,
        now,
      );
    }),
  );
}

interface StreamContent {
  notes: LectureNote[];
  info: SubjectInfo[];
}

async function buildStreamContent(paths: string[], notes: LectureNote[], info: SubjectInfo[], now: string): Promise<StreamContent> {
  const files = paths
    .filter((path) => path.startsWith(STREAM_FOLDER) && path.endsWith('.md'))
    .map((path) => ({ path, parts: path.slice(STREAM_FOLDER.length).split('/') }))
    .filter(({ parts }) => parts.length === 2 && STREAM_SUBJECT_FOLDERS[parts[0]!]);

  const result: StreamContent = { notes: [], info: [] };
  await Promise.all(
    files.map(async ({ path, parts }) => {
      const [subjectFolder, name] = parts as [string, string];
      const subjectId = STREAM_SUBJECT_FOLDERS[subjectFolder]!;
      const { content } = splitTitle(stripFrontMatter(await fetchText(rawUrl('stream', path))));
      const lesson = parseStreamFilename(name);

      if (lesson) {
        const fields: NoteFields = { subjectId, lectureNumber: lesson.lectureNumber, title: lesson.title, contentType: 'markdown', content, collection: 'stream' };
        result.notes.push(toNote(path, fields, notes, now, `${lesson.date}T00:00:00.000Z`));
        return;
      }

      const id = `gh:${path}`;
      const old = info.find((item) => item.id === id);
      const isDescription = stem(name) === subjectFolder;
      result.info.push({
        id,
        createdAt: old?.createdAt ?? now,
        updatedAt: old?.content === content ? old.updatedAt : now,
        subjectId,
        title: isDescription ? 'Описание курса (1 поток)' : stem(name),
        content,
        category: isDescription ? 'description' : 'other',
        source: 'github',
        sourceRef: path,
        archived: false,
      });
    }),
  );
  return result;
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

const isGithubNoteOf = (collection: LectureNoteCollection) => (note: LectureNote) =>
  note.source === 'github' && (note.collection ?? 'group') === collection;

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

  const [group, stream] = await Promise.allSettled([
    fetchTree('group').then(async (files) => {
      const paths = files.map((file) => file.path);
      const [notes, deadlines, homework] = await Promise.all([
        buildGroupNotes(paths, notesBefore, now),
        fetchText(rawUrl('group', 'Дедлайны/deadlines.json')).then((text) => parseDeadlines(JSON.parse(text))),
        fetchText(rawUrl('group', 'data/homework.json')).then((text) => parseHomework(JSON.parse(text))),
      ]);
      return { files, notes, deadlines, homework, materials: buildMaterials(paths, materialsBefore, now) };
    }),
    fetchTree('stream').then((files) => buildStreamContent(files.map((file) => file.path), notesBefore, infoBefore, now)),
  ]);

  const summary: SyncSummary = { stream: 0, group: 0, subjectInfo: 0, materials: 0, deadlines: 0, homework: 0 };

  function replaceNotes(collection: LectureNoteCollection, fresh: LectureNote[]) {
    const ids = new Set(fresh.map((note) => note.id));
    useLectureNotesStore.setState((state) => ({
      lectureNotes: [
        ...fresh,
        ...state.lectureNotes
          .filter((note) => !ids.has(note.id))
          .map((note) => (isGithubNoteOf(collection)(note) ? { ...note, archived: true } : note)),
      ],
    }));
    summary[collection] = fresh.length;
  }

  if (group.status === 'fulfilled') {
    const { files, notes, deadlines, homework, materials } = group.value;
    replaceNotes('group', notes);
    useMaterialsStore.setState((state) => ({
      materials: [...materials, ...state.materials.filter((material) => !material.id.startsWith('gh:'))],
    }));
    useGroupStore.setState({ files, deadlines });
    useHomeworkStore.getState().setRemote(homework);
    // Раньше дедлайны группы складывались в задачи (id "gh:deadline:…") — теперь у них своя страница
    useTasksStore.setState((state) => ({ tasks: state.tasks.filter((task) => !task.id.startsWith('gh:')) }));
    Object.assign(summary, { materials: materials.length, deadlines: deadlines.length, homework: homework.length });
  }

  if (stream.status === 'fulfilled') {
    replaceNotes('stream', stream.value.notes);
    const ids = new Set(stream.value.info.map((item) => item.id));
    useSubjectInfoStore.setState((state) => ({
      items: [
        ...stream.value.info,
        ...state.items.filter((item) => !ids.has(item.id)).map((item) => (item.source === 'github' ? { ...item, archived: true } : item)),
      ],
    }));
    summary.subjectInfo = stream.value.info.length;
  }

  const failed = [group, stream].find((result) => result.status === 'rejected');
  if (failed) throw failed.reason instanceof Error ? failed.reason : new Error('Не удалось синхронизироваться с GitHub.');

  localStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
  return summary;
}
