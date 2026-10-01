import type { LucideIcon } from 'lucide-react';
import { Check } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { SPRING_SNAPPY } from '../../lib/motion';
import { useFloatingPosition } from '../../lib/useFloatingPosition';
import styles from './DropdownMenu.module.css';

/** Props, которые нужно передать кнопке, открывающей меню */
export interface DropdownTriggerProps {
  onClick: () => void;
  'aria-expanded': boolean;
  'aria-haspopup': 'menu';
}

interface DropdownMenuProps {
  /** Кнопка-триггер. Пример: (props) => <Button {...props}>Sort</Button> */
  trigger: (props: DropdownTriggerProps) => ReactNode;
  /** По какому краю кнопки выравнивать меню */
  align?: 'start' | 'end';
  children: ReactNode;
}

const ITEM_SELECTOR = '[role^="menuitem"]';

/** Пункты меню получают отсюда функцию закрытия */
const CloseMenuContext = createContext<() => void>(() => {});

/**
 * Выпадающее меню действий или вариантов. Рисуется через портал в document.body,
 * заякоренное за триггер (см. useFloatingPosition) — так его не может запереть
 * в себе stacking context ближайшего трансформированного предка (карточка/строка с hover-lift).
 * Закрывается кликом снаружи, по Esc и после выбора пункта. Стрелки ↑ ↓ переключают пункты.
 */
export function DropdownMenu({ trigger, align = 'start', children }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const coords = useFloatingPosition(rootRef, menuRef, open, align);

  function focusTrigger() {
    rootRef.current?.querySelector('button')?.focus();
  }

  function close() {
    setOpen(false);
    focusTrigger();
  }

  useEffect(() => {
    if (!open) return;

    // Фокус на первый пункт — чтобы сразу можно было выбирать стрелками
    menuRef.current?.querySelector<HTMLElement>(ITEM_SELECTOR)?.focus();

    function handlePointerDown(event: globalThis.PointerEvent) {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        focusTrigger();
      }
      if (event.key === 'Tab') setOpen(false);
    }

    function handleScrollOrResize() {
      setOpen(false);
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
  }, [open]);

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();

    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []);
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);
    const step = event.key === 'ArrowDown' ? 1 : -1;
    items[(currentIndex + step + items.length) % items.length]?.focus();
  }

  return (
    <div ref={rootRef} className={styles.root}>
      {trigger({
        onClick: () => setOpen((isOpen) => !isOpen),
        'aria-expanded': open,
        'aria-haspopup': 'menu',
      })}

      {createPortal(
        <AnimatePresence>
          {open && coords && (
            <CloseMenuContext value={close}>
              <motion.div
                ref={menuRef}
                role="menu"
                className={styles.menu}
                style={{ position: 'fixed', left: coords.left, top: coords.top, bottom: coords.bottom }}
                initial={{ opacity: 0, scale: 0.92, y: coords.bottom !== undefined ? 4 : -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.1 } }}
                transition={SPRING_SNAPPY}
                onKeyDown={handleMenuKeyDown}
              >
                {children}
              </motion.div>
            </CloseMenuContext>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}

interface DropdownItemProps {
  icon?: LucideIcon;
  onSelect: () => void;
  /** Для пунктов-вариантов: у выбранного показывается галочка */
  checked?: boolean;
  children: ReactNode;
}

export function DropdownItem({ icon: Icon, onSelect, checked, children }: DropdownItemProps) {
  const closeMenu = useContext(CloseMenuContext);
  const isOption = checked !== undefined;

  return (
    <button
      type="button"
      role={isOption ? 'menuitemradio' : 'menuitem'}
      aria-checked={isOption ? checked : undefined}
      tabIndex={-1}
      className={styles.item}
      onPointerMove={(event) => event.currentTarget.focus()}
      onClick={() => {
        onSelect();
        closeMenu();
      }}
    >
      {Icon && <Icon size={14} strokeWidth={1.75} className={styles.itemIcon} aria-hidden />}
      <span className={styles.itemLabel}>{children}</span>
      {checked && <Check size={14} strokeWidth={2} className={styles.check} aria-hidden />}
    </button>
  );
}

export function DropdownSeparator() {
  return <div role="separator" className={styles.separator} />;
}

interface DropdownLabelProps {
  children: ReactNode;
}

/** Подпись группы пунктов */
export function DropdownLabel({ children }: DropdownLabelProps) {
  return <div className={styles.label}>{children}</div>;
}
