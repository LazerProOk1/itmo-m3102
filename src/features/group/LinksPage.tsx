import { motion } from 'framer-motion';
import { ExternalLink, Search } from 'lucide-react';
import { useState } from 'react';
import { buttonClass } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { PageHeader } from '../../components/ui/PageHeader';
import { SPRING_SMOOTH, usePrefersReducedMotion } from '../../lib/motion';
import { repoEditUrl } from '../../services/github';
import { useEditMode } from '../settings/EditModeContext';
import { useGroupStore, type GroupLink } from './groupStore';
import styles from './LinksPage.module.css';

const KINDS: [RegExp, string, string][] = [
  [/forms\.gle|docs\.google\.com\/forms/, 'Форма', 'FORM'],
  [/disk\.yandex|yadi\.sk/, 'Диск', 'DISK'],
  [/drive\.google/, 'Диск', 'DISK'],
  [/yonote/, 'Yonote', 'YO'],
  [/t\.me/, 'Telegram', 'TG'],
  [/github\.io/, 'Сайт', 'WEB'],
  [/github\.com/, 'GitHub', 'GIT'],
];

/** Тип ссылки — явный kind из links.json или по адресу, как на сайте группы */
export function linkKind(link: Pick<GroupLink, 'kind' | 'url'>): { label: string; badge: string } {
  if (link.kind) return { label: link.kind, badge: link.kind.slice(0, 4).toUpperCase() };
  const hit = KINDS.find(([pattern]) => pattern.test(link.url));
  return hit ? { label: hit[1], badge: hit[2] } : { label: 'Ссылка', badge: '↗' };
}

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

/** Цвет карточки — стабильный по предмету (одинаковый предмет = одинаковый цвет) */
const tone = (text: string) => [...text].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 7) % 6;

/** Полезные ссылки группы (data/links.json): формы сдачи, чужие конспекты и курсы. */
export function LinksPage({ embedded = false }: { embedded?: boolean }) {
  const links = useGroupStore((state) => state.links);
  const { isEditMode } = useEditMode();
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const visible = links.filter((link) =>
    `${link.title} ${link.description} ${link.subject} ${linkKind(link).label} ${host(link.url)}`.toLowerCase().includes(q),
  );
  const groups = new Map<string, GroupLink[]>();
  for (const link of visible) groups.set(link.group, [...(groups.get(link.group) ?? []), link]);

  const addButton = isEditMode && (
    <a className={buttonClass('primary', 'md')} href={repoEditUrl('data/links.json')} target="_blank" rel="noopener noreferrer">
      <ExternalLink size={14} strokeWidth={1.75} aria-hidden />
      Добавить ссылку
    </a>
  );

  return (
    <>
      {!embedded && (
        <PageHeader
          title="Полезные ссылки"
          subtitle="Формы сдачи, чужие конспекты и курсы — всё, что обычно теряется в чатах."
          actions={addButton}
        />
      )}
      <div className={styles.toolbar}>
        <Input
          icon={Search}
          type="search"
          placeholder="Поиск по ссылкам"
          aria-label="Поиск по ссылкам"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {embedded && addButton}
      </div>

      {links.length === 0 ? (
        <EmptyState title="Ссылок пока нет" description="Они появятся после синхронизации с GitHub." />
      ) : groups.size === 0 ? (
        <EmptyState icon={Search} title="Ничего не найдено" description="Попробуйте другое слово." />
      ) : (
        [...groups].map(([group, items]) => (
          <section key={group} className={styles.group}>
            <div className={styles.groupHead}>
              <h2>{group}</h2>
              <span>{items.length}</span>
            </div>
            <LinkCards links={items} />
          </section>
        ))
      )}
    </>
  );
}

/** Карточки ссылок — на странице «Ссылки» и у предмета */
export function LinkCards({ links }: { links: GroupLink[] }) {
  const reduceMotion = usePrefersReducedMotion();
  return (
    <div className={styles.grid}>
      {links.map((link, index) => {
        const kind = linkKind(link);
        const delay = Math.min(index, 12) * 0.035;
        return (
          <motion.a
            key={link.url + link.title}
            className={styles.card}
            data-tone={tone(link.subject || link.group)}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{
              opacity: 1,
              y: 0,
              transition: { ...SPRING_SMOOTH, delay },
            }}
            whileHover={reduceMotion ? undefined : { y: -2 }}
          >
            <span className={styles.badge} aria-hidden>
              {kind.badge}
            </span>
            <span className={styles.body}>
              <strong>{link.title}</strong>
              {link.description && <small>{link.description}</small>}
              <span className={styles.meta}>
                {link.subject && <span className={styles.subject}>{link.subject}</span>}
                <span>{host(link.url)}</span>
              </span>
            </span>
            <span className={styles.arrow} aria-hidden>
              ↗
            </span>
          </motion.a>
        );
      })}
    </div>
  );
}
