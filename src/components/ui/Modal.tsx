import { X } from 'lucide-react';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { cn } from '../../lib/cn';
import { IconButton } from './IconButton';
import styles from './Modal.module.css';

/** Держит origin-точку в разумных пределах — окно не должно «вырастать» из самого угла экрана */
function clampPercent(value: number): number {
  return Math.min(85, Math.max(15, value));
}

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

/**
 * Модальное окно на основе встроенного элемента <dialog>.
 * Браузер сам держит фокус внутри окна и закрывает его по Esc.
 * Содержимое создаётся заново при каждом открытии — формы внутри сбрасываются сами.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  bare = false,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pressedOnBackdrop = useRef(false);
  const titleId = useId();
  // Пока идёт анимация закрытия, окно уже логически закрыто (open=false), но контент
  // остаётся отрисован — иначе закрытию попросту нечего было бы показывать.
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      // Окно «рождается» из точки, откуда его вызвали: элемент, на котором был фокус
      // в момент клика (кнопка/карточка), задаёт transform-origin вместо центра экрана.
      const trigger = document.activeElement;
      if (trigger instanceof HTMLElement && trigger !== document.body) {
        const rect = trigger.getBoundingClientRect();
        const originX = clampPercent(((rect.left + rect.width / 2) / window.innerWidth) * 100);
        const originY = clampPercent(((rect.top + rect.height / 2) / window.innerHeight) * 100);
        dialog.style.setProperty('--origin-x', `${originX}%`);
        dialog.style.setProperty('--origin-y', `${originY}%`);
      } else {
        dialog.style.removeProperty('--origin-x');
        dialog.style.removeProperty('--origin-y');
      }
      setIsClosing(false);
      dialog.showModal();
    } else if (!open && dialog.open && !isClosing) {
      setIsClosing(true);
    }
  }, [open, isClosing]);

  // Реальное закрытие <dialog> откладывается до конца анимации ухода
  useEffect(() => {
    if (!isClosing) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    // Фильтр по цели (не по имени: CSS-модули манглят имена @keyframes, так что
    // сравнивать event.animationName со строкой из исходника бессмысленно) — иначе
    // всплывающая animationend от вложенных попапов (DropdownMenu, ClassDetailsPopover)
    // внутри содержимого окна закрыла бы его раньше времени.
    function handleAnimationEnd(event: globalThis.AnimationEvent) {
      if (event.target !== dialog) return;
      dialog?.close();
      setIsClosing(false);
    }

    dialog.addEventListener('animationend', handleAnimationEnd);
    return () => dialog.removeEventListener('animationend', handleAnimationEnd);
  }, [isClosing]);

  // Закрываем по клику на затемнённый фон. Проверяем и нажатие, и отпускание,
  // чтобы выделение текста в поле, законченное за пределами окна, его не закрывало.
  function handlePointerDown(event: PointerEvent<HTMLDialogElement>) {
    pressedOnBackdrop.current = event.target === event.currentTarget;
  }

  function handleClick(event: MouseEvent<HTMLDialogElement>) {
    if (pressedOnBackdrop.current && event.target === event.currentTarget) onClose();
  }

  // Браузер и сам закрывает <dialog> по Esc, но не во всех случаях — обрабатываем явно
  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className={cn(styles.dialog, styles[size], bare && styles.bare, isClosing && styles.closing)}
      onClose={onClose}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {(open || isClosing) && (
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
      )}
    </dialog>
  );
}
