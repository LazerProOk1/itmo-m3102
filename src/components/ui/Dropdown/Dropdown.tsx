import { Check, ChevronDown, Search, type LucideIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../../lib/cn';
import { SPRING_SNAPPY } from '../../../lib/motion';
import { buttonClass } from '../Button';
import menuStyles from '../DropdownMenu.module.css';
import controls from '../controls.module.css';
import styles from './Dropdown.module.css';

export interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownProps {
  id?: string;
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Поле поиска внутри списка. Если не задано — появляется само при больше 8 пунктах. */
  searchable?: boolean;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
  /** field — окаймлённое поле формы (по умолчанию), ghost — компактная кнопка для фильтров тулбара */
  variant?: 'field' | 'ghost';
  /** Иконка слева от текста в варианте ghost, например ListFilter или ArrowDownUp */
  icon?: LucideIcon;
}

const SEARCH_THRESHOLD = 8;
const MOBILE_QUERY = '(max-width: 767px)';
const GAP = 4;

/**
 * Единый выпадающий список: заменяет нативный <select> и меню-фильтры на страницах.
 * Открывается вниз или вверх (если снизу не хватает места), на телефоне — bottom sheet.
 * Текущий пункт помечается галочкой Check слева, без заливки строки.
 */
export function Dropdown({
  id,
  options,
  value,
  onChange,
  placeholder,
  searchable,
  invalid,
  disabled,
  className,
  'aria-label': ariaLabel,
  variant = 'field',
  icon: Icon,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);
  const [coords, setCoords] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
  } | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Поле поиска и список монтируются не сразу (ждут первого измерения позиции), поэтому
  // фокус при открытии ставим через callback ref — он срабатывает точно в момент появления
  // узла в DOM, а не по эффекту, который может отработать до монтирования.
  function attachSearchRef(el: HTMLInputElement | null) {
    if (el) el.focus();
  }

  function attachListRef(el: HTMLDivElement | null) {
    listRef.current = el;
    if (el && !showSearch) {
      el.querySelectorAll<HTMLElement>('[role="option"]')[highlighted]?.focus();
    }
  }

  const selected = options.find((option) => option.value === value);
  const showSearch = searchable ?? options.length > SEARCH_THRESHOLD;

  const filteredOptions = useMemo(() => {
    if (!showSearch || !query.trim()) return options;
    const normalized = query.trim().toLowerCase();
    return options.filter((option) => option.label.toLowerCase().includes(normalized));
  }, [options, query, showSearch]);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);
    const onMediaChange = () => setIsMobile(media.matches);
    media.addEventListener('change', onMediaChange);
    return () => media.removeEventListener('change', onMediaChange);
  }, []);

  function focusTrigger() {
    rootRef.current?.querySelector('button')?.focus();
  }

  function openMenu() {
    if (disabled) return;
    setQuery('');
    setHighlighted(
      Math.max(
        0,
        options.findIndex((option) => option.value === value),
      ),
    );
    setOpen(true);
  }

  function closeMenu() {
    setOpen(false);
    focusTrigger();
  }

  function selectOption(option: DropdownOption) {
    onChange(option.value);
    closeMenu();
  }

  // Базовый collision detection: открываем вниз, но если снизу не хватает места, а сверху больше — открываем вверх.
  // Позиционируем через position: fixed (координаты уже в системе viewport) — так меню не обрезается
  // прокручиваемым телом модального окна, в котором чаще всего и находится это поле.
  useLayoutEffect(() => {
    if (!open || isMobile) return;

    function measure() {
      const trigger = rootRef.current;
      if (!trigger) return;
      const triggerRect = trigger.getBoundingClientRect();
      const menuHeight = menuRef.current?.offsetHeight ?? 240;
      const width = Math.max(triggerRect.width, 200);

      const spaceBelow = window.innerHeight - triggerRect.bottom;
      const spaceAbove = triggerRect.top;
      const openUp = spaceBelow < menuHeight && spaceAbove > spaceBelow;

      // Горизонтально: якорим по левому краю триггера, но если справа не хватает места — по правому.
      const overflowsRight = triggerRect.left + width > window.innerWidth - GAP;
      const left = overflowsRight ? Math.max(GAP, triggerRect.right - width) : triggerRect.left;

      // При открытии вверх якорим через bottom, а не top — тогда меню растёт вверх само,
      // и не нужно заранее знать его точную высоту, чтобы не promахнуться мимо триггера.
      setCoords(openUp ? { left, width, bottom: window.innerHeight - triggerRect.top + GAP } : { left, width, top: triggerRect.bottom + GAP });
    }

    measure();
    // Меню только что появилось без реальной высоты — перемеряем на следующий кадр.
    const raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [open, isMobile, filteredOptions.length]);

  // Подсветка при переключении стрелками — список уже смонтирован, просто переносим фокус
  useEffect(() => {
    if (!open || showSearch) return;
    const items = listRef.current?.querySelectorAll<HTMLElement>('[role="option"]');
    items?.[highlighted]?.focus();
  }, [open, showSearch, highlighted]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node) && !menuRef.current?.contains(event.target as Node)) {
        closeMenu();
      }
    }
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') closeMenu();
    }
    // Прокрутка модалки/страницы делает координаты меню неактуальными — проще закрыть, чем гоняться за позицией
    function handleScrollOrResize() {
      closeMenu();
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleListKeyDown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlighted((index) => Math.min(index + 1, filteredOptions.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlighted((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = filteredOptions[highlighted];
      if (option) selectOption(option);
    }
  }

  const menuContent = (
    <>
      {showSearch && (
        <div className={styles.searchRow}>
          <Search size={14} strokeWidth={1.75} className={styles.searchIcon} aria-hidden />
          <input
            ref={attachSearchRef}
            type="text"
            className={styles.searchInput}
            placeholder="Поиск…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setHighlighted(0);
            }}
            onKeyDown={handleListKeyDown}
          />
        </div>
      )}
      <div ref={attachListRef} role="listbox" className={styles.list} onKeyDown={handleListKeyDown}>
        {filteredOptions.length === 0 ? (
          <p className={styles.empty}>Ничего не найдено</p>
        ) : (
          filteredOptions.map((option, index) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              tabIndex={-1}
              className={cn(menuStyles.item, styles.option, index === highlighted && styles.highlighted)}
              onPointerMove={() => setHighlighted(index)}
              onClick={() => selectOption(option)}
            >
              <span className={styles.checkSlot}>
                {option.value === value && <Check size={14} strokeWidth={2} className={menuStyles.check} aria-hidden />}
              </span>
              <span className={menuStyles.itemLabel}>{option.label}</span>
            </button>
          ))
        )}
      </div>
    </>
  );

  const triggerLabel = selected ? selected.label : placeholder;

  return (
    <div ref={rootRef} className={cn(styles.root, className)}>
      {variant === 'ghost' ? (
        <button
          id={id}
          type="button"
          className={cn(buttonClass('ghost', 'sm'), styles.ghostTrigger)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={ariaLabel}
          disabled={disabled}
          onClick={() => (open ? closeMenu() : openMenu())}
        >
          {Icon && <Icon size={14} strokeWidth={1.75} aria-hidden />}
          {triggerLabel}
        </button>
      ) : (
        <button
          id={id}
          type="button"
          className={cn(controls.control, styles.fieldTrigger)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          aria-label={ariaLabel}
          disabled={disabled}
          onClick={() => (open ? closeMenu() : openMenu())}
        >
          <span className={cn(styles.value, !selected && styles.placeholder)}>{triggerLabel}</span>
          <ChevronDown size={14} strokeWidth={1.75} className={styles.chevron} aria-hidden />
        </button>
      )}

      {/* Меню — в body: у карточек с transform/свечением position:fixed привязывался к карточке и уходил под соседние */}
      {createPortal(
        <>
          <AnimatePresence>
            {open && !isMobile && coords && (
              <motion.div
                ref={menuRef}
                className={cn(menuStyles.menu, styles.menu)}
                style={{
                  position: 'fixed',
                  top: coords.top ?? 'auto',
                  bottom: coords.bottom ?? 'auto',
                  left: coords.left,
                  width: coords.width,
                }}
                initial={{ opacity: 0, scale: 0.92, y: coords.bottom !== undefined ? 4 : -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.1 } }}
                transition={SPRING_SNAPPY}
              >
                {menuContent}
              </motion.div>
            )}
          </AnimatePresence>

          {open && isMobile && (
            <div className={styles.backdrop} onClick={closeMenu}>
              <div ref={menuRef} className={styles.sheet} onClick={(event) => event.stopPropagation()}>
                <span className={styles.sheetHandle} aria-hidden />
                {menuContent}
              </div>
            </div>
          )}
        </>,
        document.body,
      )}
    </div>
  );
}
