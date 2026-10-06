import type { AnchorHTMLAttributes } from 'react';
import { Link } from 'react-router';
import { WIKI_LINK_PREFIX } from '../../lib/wikiLinks';
import { useLectureNotesStore } from './lectureNotesStore';
import { useSubjectInfoStore } from '../subjects/subjectInfoStore';
import { useSubjectsStore } from '../subjects/subjectsStore';
import styles from './WikiLink.module.css';

/** Убирает расширение и делит repo-путь на папку + имя файла, как оно лежит в source_ref */
function splitPath(path: string): { folder: string; stem: string } {
  const withoutExt = path.endsWith('.md') ? path.slice(0, -3) : path;
  const slash = withoutExt.lastIndexOf('/');
  return slash === -1 ? { folder: '', stem: withoutExt } : { folder: withoutExt.slice(0, slash), stem: withoutExt.slice(slash + 1) };
}

/**
 * Определяет, куда ведёт `[[Название]]`/`[[Путь/Название]]` из Obsidian-хранилища:
 * - имя предмета — на страницу предмета;
 * - путь целиком (`Конспекты/.../Файл`) — ищем конспект/«О курсе» с таким source_ref
 *   (так ссылаются на файлы из ДРУГИХ папок, включая другие потоки — если не нашли, значит,
 *   те материалы просто не синхронизированы, и ссылка не резолвится);
 * - голое имя файла без пути — ищем сначала рядом с текущим конспектом (та же папка
 *   предмета, как и резолвит сам Obsidian), потом где угодно как запасной вариант.
 */
function useResolveWikiLink() {
  const subjects = useSubjectsStore((state) => state.subjects);
  const lectureNotes = useLectureNotesStore((state) => state.lectureNotes);
  const subjectInfoItems = useSubjectInfoStore((state) => state.items);

  return function resolve(rawTarget: string, currentSourceRef?: string): string | null {
    const target = rawTarget.trim();

    function findBySourceRef(path: string): string | null {
      const note = lectureNotes.find((item) => item.sourceRef === path);
      if (note) return `/materials/notes/${note.id}`;
      const info = subjectInfoItems.find((item) => item.sourceRef === path);
      if (info) return `/subjects/${info.subjectId}`;
      return null;
    }

    if (target.includes('/')) {
      return findBySourceRef(`${target}.md`);
    }

    const subject = subjects.find((item) => item.name.trim().toLowerCase() === target.toLowerCase());
    if (subject) return `/subjects/${subject.id}`;

    if (currentSourceRef) {
      const { folder } = splitPath(currentSourceRef);
      const bySameFolder = findBySourceRef(folder ? `${folder}/${target}.md` : `${target}.md`);
      if (bySameFolder) return bySameFolder;
    }

    // Запасной вариант — то же имя файла, но в другой папке (например, ссылка без полного пути)
    const noteAnywhere = lectureNotes.find((item) => item.sourceRef && splitPath(item.sourceRef).stem === target);
    if (noteAnywhere) return `/materials/notes/${noteAnywhere.id}`;

    const infoAnywhere = subjectInfoItems.find((item) => item.sourceRef && splitPath(item.sourceRef).stem === target);
    if (infoAnywhere) return `/subjects/${infoAnywhere.subjectId}`;

    return null;
  };
}

interface WikiLinkAnchorProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  /** source_ref конспекта/материала, внутри которого встретилась ссылка — для относительного резолва */
  sourceRef?: string;
}

/**
 * Замена стандартного `<a>` в ReactMarkdown: обычные ссылки (http/https) рендерятся как есть,
 * `wikilink:` — резолвятся во внутренний маршрут (если получилось) или показываются
 * приглушённым нередактируемым текстом с подсказкой (если такого материала нет в приложении).
 */
export function WikiLinkAnchor({ href, children, sourceRef, ...rest }: WikiLinkAnchorProps) {
  const resolve = useResolveWikiLink();

  if (href?.startsWith(WIKI_LINK_PREFIX)) {
    const target = decodeURIComponent(href.slice(WIKI_LINK_PREFIX.length));
    const to = resolve(target, sourceRef);

    if (to) {
      return (
        <Link to={to} className={styles.link}>
          {children}
        </Link>
      );
    }

    return (
      <span className={styles.missing} title={`«${target}» не синхронизировано с этим приложением`}>
        {children}
      </span>
    );
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
      {children}
    </a>
  );
}
