import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { getMonthGridDates } from '../../features/calendar/monthGrid';
import { cn } from '../../lib/cn';
import { addDays, addMonths, formatMonthLabel, formatWeekdayDate, getDayOfMonth, startOfMonth, toISODate } from '../../lib/dates';
import type { ISODate } from '../../types/models';
import controls from './controls.module.css';
import sheet from './Dropdown/Dropdown.module.css';
import styles from './DateInput.module.css';

interface DateInputProps {
  id?: string;
  /** Дата «ГГГГ-ММ-ДД» или '' — как value у <input type="date"> */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  min?: string;
  max?: string;
  /** Без кнопки «Очистить» */
  required?: boolean;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MOBILE_QUERY = '(max-width: 767px)';
const GAP = 6;
const KEY_STEPS: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };

/**
 * Поле даты в стиле сайта вместо системного <input type="date">: у Android и Windows свои календари,
 * не похожие на сайт. На компьютере — календарь под полем, на телефоне — шторка снизу, как у Dropdown.
 * Клавиатура: стрелки — дни, PageUp/PageDown — месяцы, Home/End — начало и конец недели, Esc — закрыть.
 */
export function DateInput({
  id,
  value,
  onChange,
  placeholder = 'Выберите дату',
  min,
  max,
  required,
  invalid,
  disabled,
  className,
  'aria-label': ariaLabel,
}: DateInputProps) {
  const today = toISODate(new Date());
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState<ISODate>(value || today);
  const [isMobile] = useState(() => matchMedia(MOBILE_QUERY).matches);
  const [coords, setCoords] = useState<{ top?: number; bottom?: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const allowed = (date: ISODate) => (!min || date >= min) && (!max || date <= max);

  function openPicker() {
    if (disabled) return;
    setCursor(value || today);
    setOpen(true);
  }

  function close() {
    setOpen(false);
    rootRef.current?.querySelector('button')?.focus();
  }

  function pick(date: ISODate) {
    if (!allowed(date)) return;
    onChange(date);
    close();
  }

  // Как у Dropdown: вниз, а если снизу мало места — вверх; position: fixed, чтобы не обрезало тело модалки
  // Перемеряем в следующем кадре и при прокрутке: модальное окно в момент открытия ещё «въезжает»
  useLayoutEffect(() => {
    if (!open || isMobile) return undefined;
    const measure = () => {
      const rect = rootRef.current!.getBoundingClientRect();
      const height = panelRef.current?.offsetHeight ?? 340;
      const width = panelRef.current?.offsetWidth ?? 300;
      const left = Math.max(GAP, Math.min(rect.left, innerWidth - width - GAP));
      const up = innerHeight - rect.bottom < height + GAP && rect.top > innerHeight - rect.bottom;
      setCoords(up ? { left, bottom: innerHeight - rect.top + GAP } : { left, top: rect.bottom + GAP });
    };
    measure();
    const frame = requestAnimationFrame(measure);
    const settle = setTimeout(measure, 350);
    addEventListener('scroll', measure, true);
    addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settle);
      removeEventListener('scroll', measure, true);
      removeEventListener('resize', measure);
    };
  }, [open, isMobile]);

  // Фокус — на выбранный или текущий день, и за ним при движении стрелками
  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLElement>(`[data-date="${cursor}"]`)?.focus();
  }, [open, cursor, coords]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node) && !panelRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // Внутри модального окна Esc закрывает только календарь, а не всё окно
      event.preventDefault();
      event.stopPropagation();
      close();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onEscape, true);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onEscape, true);
    };
  });

  function onGridKey(event: KeyboardEvent) {
    const weekday = (new Date(cursor).getDay() + 6) % 7;
    const next =
      event.key in KEY_STEPS
        ? addDays(cursor, KEY_STEPS[event.key]!)
        : event.key === 'PageUp'
          ? addMonths(cursor, -1)
          : event.key === 'PageDown'
            ? addMonths(cursor, 1)
            : event.key === 'Home'
              ? addDays(cursor, -weekday)
              : event.key === 'End'
                ? addDays(cursor, 6 - weekday)
                : null;
    if (!next) return;
    event.preventDefault();
    setCursor(next);
  }

  const month = startOfMonth(cursor);
  const panel = (
    <div
      ref={panelRef}
      className={cn(styles.panel, isMobile && styles.inSheet)}
      role="dialog"
      aria-label="Выбор даты"
      style={isMobile || !coords ? undefined : { position: 'fixed', top: coords.top ?? 'auto', bottom: coords.bottom ?? 'auto', left: coords.left }}
    >
      <div className={styles.head}>
        <button type="button" className={styles.nav} aria-label="Предыдущий месяц" onClick={() => setCursor(addMonths(month, -1))}>
          <ChevronLeft size={16} strokeWidth={1.75} aria-hidden />
        </button>
        <span className={styles.month} aria-live="polite">
          {formatMonthLabel(month)}
        </span>
        <button type="button" className={styles.nav} aria-label="Следующий месяц" onClick={() => setCursor(addMonths(month, 1))}>
          <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
        </button>
      </div>

      <div className={styles.grid} role="grid" onKeyDown={onGridKey}>
        {WEEKDAYS.map((day) => (
          <span key={day} className={styles.weekday} role="columnheader">
            {day}
          </span>
        ))}
        {getMonthGridDates(month).map((date) => (
          <button
            key={date}
            type="button"
            role="gridcell"
            data-date={date}
            tabIndex={date === cursor ? 0 : -1}
            aria-selected={date === value}
            aria-current={date === today ? 'date' : undefined}
            disabled={!allowed(date)}
            className={cn(
              styles.day,
              date.slice(0, 7) !== month.slice(0, 7) && styles.outside,
              date === today && styles.today,
              date === value && styles.selected,
            )}
            onClick={() => pick(date)}
          >
            {getDayOfMonth(date)}
          </button>
        ))}
      </div>

      <div className={styles.foot}>
        <button type="button" className={styles.link} onClick={() => pick(today)} disabled={!allowed(today)}>
          Сегодня
        </button>
        {!required && value && (
          <button
            type="button"
            className={styles.link}
            onClick={() => {
              onChange('');
              close();
            }}
          >
            Очистить
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div ref={rootRef} className={cn(styles.root, className)}>
      <button
        id={id}
        type="button"
        className={cn(controls.control, styles.trigger)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? close() : openPicker())}
      >
        <span className={cn(styles.value, !value && styles.placeholder)}>
          {value ? formatWeekdayDate(value) + ' ' + value.slice(0, 4) : placeholder}
        </span>
        <CalendarDays size={14} strokeWidth={1.75} className={styles.icon} aria-hidden />
      </button>

      {open &&
        // Порталом: position: fixed внутри страницы считался бы от обёртки с анимацией (transform), а не от экрана.
        // В модальном окне — в само окно: оно в верхнем слое, и календарь из body оказался бы под ним
        createPortal(
          isMobile ? (
            <div className={sheet.backdrop} onClick={() => setOpen(false)}>
              <div className={sheet.sheet} onClick={(event) => event.stopPropagation()}>
                <span className={sheet.sheetHandle} aria-hidden />
                {panel}
              </div>
            </div>
          ) : (
            panel
          ),
          rootRef.current?.closest('dialog') ?? document.body,
        )}
    </div>
  );
}
