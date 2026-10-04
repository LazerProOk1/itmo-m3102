import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useEffect } from 'react';
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
 * или Ctrl+B; колонка сетки сужается до 0 (AppShell), а меню фиксированной ширины уезжает влево вместе с ней.
 */
export function Sidebar() {
  const collapsed = useSettingsStore((state) => state.sidebarCollapsed);
  return (
    <aside className={styles.sidebar} inert={collapsed} data-collapsed={collapsed || undefined}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <Brand />
          <SidebarToggle />
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

/** «Закрыть / Открыть боковую панель» — в самом меню и в шапке, когда меню свёрнуто */
export function SidebarToggle({ className, side }: { className?: string; side?: 'bottom' | 'bottom-start' }) {
  const collapsed = useSettingsStore((state) => state.sidebarCollapsed);
  const toggle = useSettingsStore((state) => state.toggleSidebar);
  const label = collapsed ? 'Открыть боковую панель' : 'Закрыть боковую панель';
  return (
    <span className={className}>
      <Tooltip text={label} keys={[MOD, 'B']} side={side}>
        <IconButton icon={collapsed ? PanelLeftOpen : PanelLeftClose} label={label} title={undefined} onClick={toggle} />
      </Tooltip>
    </span>
  );
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
