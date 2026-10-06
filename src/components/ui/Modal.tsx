import { X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type AnimationEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/cn';
import { IconButton } from './IconButton';
import styles from './Modal.module.css';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Строка под заголовком */
  description?: string;
  children: ReactNode;
  /** Кнопки внизу окна */
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Без заголовка и отступов, ближе к верху экрана — для окон со своей раскладкой (поиск) */
  bare?: boolean;
}

const FOCUSABLE =
  'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/** Открытые окна по порядку: Esc и Tab слушает только верхнее (окно подтверждения поверх формы) */
const stack: symbol[] = [];

/** Есть ли между целью и слоем окна что-то, что само прокручивается, — тогда колесо и свайп не трогаем */
function scrollsInside(target: EventTarget | null, layer: HTMLElement): boolean {
  for (let node = target instanceof Element ? target : null; node && node !== layer; node = node.parentElement) {
    if (node.scrollHeight > node.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(node).overflowY)) return true;
  }
  return false;
}

/**
 * Модальное окно — слой поверх страницы через портал в body, а не `<dialog>.showModal()`: модальный dialog
 * делает всю остальную страницу инертной, и браузер пересчитывает стили всего документа — на открытии ~100 мс,
 * на закрытии ~40 мс (×4 на телефоне), окно дёргалось. Прокрутку страницы под окном держим, перехватывая колесо
 * и свайп, а не `overflow: hidden` на html — тот пересчитывал раскладку всей страницы.
 * Фокус: при открытии — первое поле (крестик последний), Tab не выходит из окна, при закрытии фокус
 * возвращается туда, откуда открыли. Содержимое создаётся заново при каждом открытии — формы сбрасываются сами.
 */
export function Modal({ open, onClose, title, description, children, footer, size = 'md', bare = false }: ModalProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pressedOnBackdrop = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const titleId = useId();
  // «Закрывается» — в том же рендере, где пришло open=false: содержимое остаётся до конца анимации ухода
  // и не пересоздаётся (иначе окно мигало, а анимации внутри начинались заново)
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);
  const closing = mounted && !open;

  // Открылось: запомнить, откуда, поставить фокус внутрь, слушать Esc/Tab и колесо
  useEffect(() => {
    if (!open) return undefined;
    const layer = layerRef.current;
    const panel = panelRef.current;
    if (!layer || !panel) return undefined;
    const id = Symbol('modal');
    stack.push(id);
    const returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Фокус внутрь. В поле — сразу (поиск: буквы, набранные до фокуса, потерялись бы); на кнопку — со следующего
    // кадра: фокус пересчитывает раскладку окна (~30 мс на ПК), и до первого кадра это задерживало появление
    // Кроме крестика в окне ничего нет («Горячие клавиши») — фокус на само окно, без кольца на крестике
    const found = panel.querySelector<HTMLElement>(FOCUSABLE);
    const first = styles.close && found?.classList.contains(styles.close) ? null : found;
    const focusFirst = () => (first ?? panel).focus({ preventScroll: true });
    const frame = first?.matches('input, textarea') ? (focusFirst(), 0) : requestAnimationFrame(focusFirst);

    function handleKey(event: KeyboardEvent) {
      if (stack[stack.length - 1] !== id) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
      } else if (event.key === 'Tab' && panel) {
        const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((item) => item.offsetParent !== null);
        if (!items.length) return event.preventDefault();
        // По кругу: с последнего — на первый, с первого назад — на последний, вне окна — на первый
        const index = items.indexOf(document.activeElement as HTMLElement);
        const wrapTo =
          index === -1 ? items[0] : event.shiftKey && index === 0 ? items.at(-1) : !event.shiftKey && index === items.length - 1 ? items[0] : null;
        if (wrapTo) {
          event.preventDefault();
          wrapTo.focus();
        }
      }
    }
    function blockScroll(event: Event) {
      if (layer && !scrollsInside(event.target, layer)) event.preventDefault();
    }
    document.addEventListener('keydown', handleKey);
    layer.addEventListener('wheel', blockScroll, { passive: false });
    layer.addEventListener('touchmove', blockScroll, { passive: false });
    return () => {
      cancelAnimationFrame(frame);
      stack.splice(stack.indexOf(id), 1);
      document.removeEventListener('keydown', handleKey);
      layer.removeEventListener('wheel', blockScroll);
      layer.removeEventListener('touchmove', blockScroll);
      if (returnTo?.isConnected) returnTo.focus({ preventScroll: true });
    };
  }, [open]);

  // Страховка: вкладка в фоне или анимации выключены — animationend может не прийти, а слой ловит клики
  useEffect(() => {
    if (!closing) return undefined;
    const timer = setTimeout(() => setMounted(false), 400);
    return () => clearTimeout(timer);
  }, [closing]);

  // Убрать слой — когда доиграла анимация ухода (своя, не всплывшая из содержимого)
  function handleAnimationEnd(event: AnimationEvent<HTMLDivElement>) {
    if (closing && event.target === event.currentTarget) setMounted(false);
  }

  if (!mounted) return null;
  return createPortal(
    <div ref={layerRef} className={cn(styles.layer, bare && styles.bareLayer, closing && styles.closing)} data-modal>
      {/* Закрываем по клику на фон: и нажатие, и отпускание — на фоне, чтобы выделение текста в поле,
          законченное за пределами окна, его не закрывало */}
      <div
        className={styles.backdrop}
        onPointerDown={() => (pressedOnBackdrop.current = true)}
        onClick={() => pressedOnBackdrop.current && onClose()}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(styles.dialog, styles[size], bare && styles.bare)}
        onPointerDown={() => (pressedOnBackdrop.current = false)}
        onAnimationEnd={handleAnimationEnd}
      >
        <div className={styles.panel}>
          {bare ? (
            <h2 id={titleId} className="sr-only">
              {title}
            </h2>
          ) : (
            <header className={styles.header}>
              <h2 id={titleId} className={styles.title}>
                {title}
              </h2>
              {description && <p className={styles.description}>{description}</p>}
            </header>
          )}

          <div className={cn(styles.body, bare && styles.bareBody)}>{children}</div>

          {footer && <footer className={styles.footer}>{footer}</footer>}

          {/* Кнопка закрытия идёт последней, чтобы при открытии фокус попал на первое поле */}
          {!bare && <IconButton icon={X} label="Закрыть" size="sm" className={styles.close} onClick={onClose} />}
        </div>
      </div>
    </div>,
    document.body,
  );
}
