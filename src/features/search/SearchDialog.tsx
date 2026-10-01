import { Search, SearchX } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';
import { EmptyState } from '../../components/ui/EmptyState';
import { Kbd } from '../../components/ui/Kbd';
import { Modal } from '../../components/ui/Modal';
import { cn } from '../../lib/cn';
import { search, type SearchGroup } from './searchIndex';
import styles from './SearchDialog.module.css';

interface SearchDialogProps {
  open: boolean;
  onClose: () => void;
}

/** Каждой группе — начальный индекс в общем (по всем группам) списке результатов */
function withStartIndex(groups: SearchGroup[]): { group: SearchGroup; startIndex: number }[] {
  let cursor = 0;
  return groups.map((group) => {
    const startIndex = cursor;
    cursor += group.results.length;
    return { group, startIndex };
  });
}

/** Окно быстрого поиска (Ctrl / ⌘ + K): Subjects, Tasks, Deadlines, Materials, Notes, Links. */
export function SearchDialog({ open, onClose }: SearchDialogProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const navigate = useNavigate();
  const activeResultRef = useRef<HTMLButtonElement>(null);

  const groups = search(query);
  const groupsWithIndex = withStartIndex(groups);
  const flatResults = groupsWithIndex.flatMap(({ group }) => group.results);
  const resultCount = flatResults.length;

  // Новый запрос — выделение возвращается на самый первый результат
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Клавиатурой можно уйти за пределы видимой области — подскролливаем к выделенному
  useEffect(() => {
    activeResultRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  function handleClose() {
    setQuery('');
    onClose();
  }

  function handleSelect(path: string) {
    navigate(path);
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
      if (active) handleSelect(active.path);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Поиск" bare>
      <div className={styles.inputRow}>
        <Search size={16} strokeWidth={1.75} className={styles.muted} aria-hidden />
        <input
          className={styles.input}
          placeholder="Поиск по предметам, задачам, дедлайнам, материалам, заметкам, ссылкам…"
          aria-label="Поиск"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Kbd>Esc</Kbd>
      </div>

      <div className={styles.results} role="listbox" aria-label="Результаты поиска">
        {groupsWithIndex.length === 0 ? (
          <EmptyState compact icon={SearchX} title="Ничего не найдено" description={`Ничего не найдено по запросу «${query.trim()}».`} />
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
                    onClick={() => handleSelect(result.path)}
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
