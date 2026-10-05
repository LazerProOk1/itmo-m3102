import { Search, SearchX } from 'lucide-react';
import { useEffect, useReducer, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';
import { EmptyState } from '../../components/ui/EmptyState';
import { Kbd } from '../../components/ui/Kbd';
import { Modal } from '../../components/ui/Modal';
import { SUBJECT_FOLDERS } from '../../data/m3102';
import { cn } from '../../lib/cn';
import { useResolvedTheme } from '../settings/theme';
import { searchActions } from './searchActions';
import { loadPdfIndex, search, SEARCH_GROUPS, type SearchGroup, type SearchResult } from './searchIndex';
import styles from './SearchDialog.module.css';

/** Короткие подписи фильтров по типу */
const GROUP_CHIPS: Record<string, string> = { 'Домашнее задание': 'ДЗ', 'Учебный план': 'План' };
/** Фильтр по предмету — сокращения, как папки в репозитории группы */
const SUBJECT_CHIPS = Object.entries(SUBJECT_FOLDERS).map(([label, id]) => ({ label, id }));

type Choice = SearchResult & { run?: (navigate: (path: string) => void) => void };

interface SearchDialogProps {
  open: boolean;
  onClose: () => void;
}

/** Каждой группе — начальный индекс в общем (по всем группам) списке результатов */
function withStartIndex<T extends SearchGroup>(groups: T[]): { group: T; startIndex: number }[] {
  let cursor = 0;
  return groups.map((group) => {
    const startIndex = cursor;
    cursor += group.results.length;
    return { group, startIndex };
  });
}

/**
 * Окно поиска (Ctrl / ⌘ + K): всё на сайте по названию и полному тексту (конспекты с PDF, ДЗ, заметки, подписи
 * схем), слова — в любом порядке; фильтр по типу и предмету; быстрые действия (синхронизация, тема, меню,
 * «Перед контрольной»). Пустой запрос — список действий.
 */
export function SearchDialog({ open, onClose }: SearchDialogProps) {
  const [query, setQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState<string | undefined>();
  const [subjectFilter, setSubjectFilter] = useState<string | undefined>();
  const dark = useResolvedTheme() === 'dark';
  const [activeIndex, setActiveIndex] = useState(0);
  const navigate = useNavigate();
  const activeResultRef = useRef<HTMLButtonElement>(null);

  // Текст PDF подгружается при первом открытии — когда пришёл, повторяем поиск
  const [, rerender] = useReducer((value: number) => value + 1, 0);
  useEffect(() => {
    if (open) void loadPdfIndex().then(rerender);
  }, [open]);
  const filter = { group: groupFilter, subjectId: subjectFilter };
  // Действия — первыми; с фильтром по типу их нет, без запроса — только общие (не по каждому предмету)
  const actions = groupFilter ? [] : searchActions(query, dark, subjectFilter).filter((action) => query.trim() || subjectFilter || !action.subjectId);
  const groups: { label: string; results: Choice[] }[] = [
    ...(actions.length ? [{ label: 'Действия', results: actions.map((action) => ({ ...action, path: '' })) }] : []),
    ...search(query, filter),
  ];
  const groupsWithIndex = withStartIndex(groups);
  const flatResults = groupsWithIndex.flatMap(({ group }) => group.results);
  const resultCount = flatResults.length;

  // Новый запрос или фильтр — выделение возвращается на самый первый результат
  useEffect(() => {
    setActiveIndex(0);
  }, [query, groupFilter, subjectFilter]);

  // Клавиатурой можно уйти за пределы видимой области — подскролливаем к выделенному
  useEffect(() => {
    activeResultRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  function handleClose() {
    setQuery('');
    setGroupFilter(undefined);
    setSubjectFilter(undefined);
    onClose();
  }

  function handleSelect(choice: Choice) {
    if (choice.run) choice.run(navigate);
    else navigate(choice.path);
    handleClose();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (resultCount === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % resultCount);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + resultCount) % resultCount);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const active = flatResults[activeIndex];
      if (active) handleSelect(active);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Поиск" bare>
      <div className={styles.inputRow}>
        <Search size={16} strokeWidth={1.75} className={styles.muted} aria-hidden />
        <input
          className={styles.input}
          placeholder="Конспекты, ДЗ, дедлайны, заметки, действия…"
          aria-label="Поиск"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Kbd>Esc</Kbd>
      </div>

      <div className={styles.filters} role="group" aria-label="Фильтры поиска">
        {SEARCH_GROUPS.map((label) => (
          <button
            key={label}
            type="button"
            className={cn(styles.chip, groupFilter === label && styles.chipOn)}
            aria-pressed={groupFilter === label}
            onClick={() => setGroupFilter(groupFilter === label ? undefined : label)}
          >
            {GROUP_CHIPS[label] ?? label}
          </button>
        ))}
        <span className={styles.chipDivider} aria-hidden />
        {SUBJECT_CHIPS.map(({ label, id }) => (
          <button
            key={id}
            type="button"
            className={cn(styles.chip, subjectFilter === id && styles.chipOn)}
            aria-pressed={subjectFilter === id}
            onClick={() => setSubjectFilter(subjectFilter === id ? undefined : id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={styles.results} role="listbox" aria-label="Результаты поиска">
        {groupsWithIndex.length === 0 ? (
          <EmptyState
            compact
            icon={SearchX}
            title="Ничего не найдено"
            description={query.trim() ? `Ничего не найдено по запросу «${query.trim()}».` : 'Под этот фильтр пока ничего нет.'}
          />
        ) : (
          groupsWithIndex.map(({ group, startIndex }) => (
            <div key={group.label} className={styles.group}>
              <p className={styles.groupLabel}>{group.label}</p>
              {group.results.map((result, index) => {
                const globalIndex = startIndex + index;
                const isActive = globalIndex === activeIndex;
                const Icon = result.icon;

                return (
                  <button
                    key={result.id}
                    ref={isActive ? activeResultRef : undefined}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    className={cn(styles.result, isActive && styles.active)}
                    onMouseEnter={() => setActiveIndex(globalIndex)}
                    onClick={() => handleSelect(result)}
                  >
                    <Icon size={16} strokeWidth={1.75} className={styles.muted} aria-hidden />
                    <span className={styles.resultTitle}>{result.title}</span>
                    {result.meta && <span className={styles.resultMeta}>{result.meta}</span>}
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>

      {resultCount > 0 && (
        <div className={styles.hints}>
          <span className={styles.hint}>
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> Навигация
          </span>
          <span className={styles.hint}>
            <Kbd>Enter</Kbd> Открыть
          </span>
          <span className={styles.hint}>
            <Kbd>Esc</Kbd> Закрыть
          </span>
        </div>
      )}
    </Modal>
  );
}
