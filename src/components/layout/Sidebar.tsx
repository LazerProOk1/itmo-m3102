import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useEffect, useLayoutEffect } from 'react';
import { SECTIONS, SIDEBAR_PRIMARY, SIDEBAR_SECONDARY, type Section } from '../../app/navigation';
import { useSettingsStore } from '../../features/settings/settingsStore';
import { IconButton } from '../ui/IconButton';
import { Tooltip } from '../ui/Tooltip';
import { Brand } from './Brand';
import { NavItem } from './NavItem';
import { ThemeToggle } from './ThemeToggle';
import styles from './Sidebar.module.css';

const MOD = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

/**
 * Боковое меню (только на компьютере и планшете). Сворачивается целиком — кнопкой в нём, кнопкой в шапке
 * или Ctrl+B; колонка плавно сужается до 0, а меню фиксированной ширины уезжает влево вместе с ней.
 */
export function Sidebar() {
  // inert и видимость кнопок ставит useSidebarAttribute без React — см. там же
  return (
    <aside id="sidebar" className={styles.sidebar}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <Brand />
          <SidebarToggle action="close" />
        </div>

        <nav className={styles.nav} aria-label="Основное меню">
          <NavGroup sections={SIDEBAR_PRIMARY} />
          <hr className={styles.divider} />
          <NavGroup sections={SIDEBAR_SECONDARY} />
        </nav>

        <div className={styles.footer}>
          <div className={styles.footerLink}>
            <NavItem section={SECTIONS.settings} />
          </div>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}

/**
 * «Закрыть боковую панель» — в самом меню, «Открыть» — в шапке. Обе всегда в разметке, лишнюю прячет CSS по
 * <html data-sidebar> (TopBar.module.css): переключение меню не перерисовывает React.
 */
export function SidebarToggle({ action, className, side }: { action: 'open' | 'close'; className?: string; side?: 'bottom' | 'bottom-start' }) {
  const toggle = useSettingsStore((state) => state.toggleSidebar);
  const label = action === 'open' ? 'Открыть боковую панель' : 'Закрыть боковую панель';
  return (
    <span className={className}>
      <Tooltip text={label} keys={[MOD, 'B']} side={side}>
        <IconButton icon={action === 'open' ? PanelLeftOpen : PanelLeftClose} label={label} title={undefined} onClick={toggle} />
      </Tooltip>
    </span>
  );
}

/**
 * Сворачивание меню: колонка плавно меняет ширину (переход grid-template-columns в AppShell.module.css), текст
 * перетекает, как в ChatGPT. Чтобы это не тормозило на длинном конспекте:
 * - состояние — атрибутом <html data-sidebar> (и inert у меню) через подписку на стор, без React: перерисовка
 *   каркаса перерисовала бы весь конспект, а даже перерисовка меню заставляет framer-motion перемерить все
 *   анимируемые элементы страницы;
 * - на время анимации разделы конспекта ([data-lazy-layout] > *) получают content-visibility: auto с их нынешней
 *   высотой — каждый кадр браузер раскладывает только видимые, а невидимые стоят и не сдвигают прокрутку.
 *   После анимации — обычная раскладка один раз, когда уже ничего не движется;
 * - место чтения не уезжает: строка под шапкой держится на своей высоте каждый кадр (текст выше неё становится
 *   шире и короче — без этого всё под ним подтягивалось бы вверх).
 */
export function useSidebarAttribute() {
  useLayoutEffect(() => {
    let frame = 0;
    let finish = () => {};
    const apply = (collapsed: boolean, animate: boolean) => {
      finish();
      const root = document.documentElement;
      const sections = animate ? [...document.querySelectorAll<HTMLElement>('[data-lazy-layout] > *')] : [];
      // Сначала все замеры (одна раскладка), потом все записи
      const heights = sections.map((section) => {
        const first = section.firstElementChild;
        // С content-visibility поле первого ребёнка уже не «выпадает» из раздела, а входит в его высоту
        return section.offsetHeight + (first ? parseFloat(getComputedStyle(first).marginTop) || 0 : 0);
      });
      // Что держать на месте: первый блок текста, который виден под шапкой
      const barBottom = document.querySelector('header')?.getBoundingClientRect().bottom ?? 0;
      let anchor: Element | null = null;
      if (animate) {
        for (const block of document.querySelectorAll('#main :is(h1, h2, h3, h4, p, li, pre, table, blockquote, .katex-display)')) {
          if (block.getBoundingClientRect().bottom > barBottom) {
            anchor = block;
            break;
          }
        }
      }
      const anchorTop = anchor?.getBoundingClientRect().top ?? 0;
      const holdAnchor = () => {
        if (!anchor?.isConnected) return;
        const drift = anchor.getBoundingClientRect().top - anchorTop;
        if (Math.abs(drift) >= 1) scrollBy(0, drift);
      };

      sections.forEach((section, index) => {
        section.style.containIntrinsicSize = `auto ${heights[index]}px`;
        section.style.contentVisibility = 'auto';
      });
      if (collapsed) root.dataset.sidebar = 'collapsed';
      else delete root.dataset.sidebar;
      document.getElementById('sidebar')?.toggleAttribute('inert', collapsed);
      if (!animate) return;

      // Своё удержание места вместо встроенного overflow-anchor: тот выбирает строку под шапкой, а не на виду
      root.style.overflowAnchor = 'none';
      finish = () => {
        cancelAnimationFrame(frame);
        for (const section of sections) {
          section.style.contentVisibility = '';
          section.style.containIntrinsicSize = '';
        }
        // Обычная раскладка вернулась (высоты выше могли измениться) — место держим и здесь
        holdAnchor();
        root.style.overflowAnchor = '';
        finish = () => {};
      };
      const end = performance.now() + (parseFloat(getComputedStyle(root).getPropertyValue('--sidebar-duration')) || 260) + 60;
      const hold = (now: number) => {
        holdAnchor();
        if (now < end) frame = requestAnimationFrame(hold);
        else finish();
      };
      frame = requestAnimationFrame(hold);
    };
    apply(useSettingsStore.getState().sidebarCollapsed, false);
    const unsubscribe = useSettingsStore.subscribe((state, previous) => {
      if (state.sidebarCollapsed !== previous.sidebarCollapsed) apply(state.sidebarCollapsed, true);
    });
    return () => {
      unsubscribe();
      finish();
    };
  }, []);
}

/** Ctrl+B (⌘B) — свернуть или открыть меню; в полях ввода не перехватываем: там это жирный шрифт */
export function useSidebarShortcut() {
  const toggle = useSettingsStore((state) => state.toggleSidebar);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (event.code !== 'KeyB' || !(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey) return;
      if (target instanceof Element && target.closest('input, textarea, [contenteditable="true"]')) return;
      event.preventDefault();
      toggle();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [toggle]);
}

interface NavGroupProps {
  sections: Section[];
}

function NavGroup({ sections }: NavGroupProps) {
  return (
    <ul className={styles.group}>
      {sections.map((section) => (
        <li key={section.path}>
          <NavItem section={section} />
        </li>
      ))}
    </ul>
  );
}
