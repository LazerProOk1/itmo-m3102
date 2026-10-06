import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { findSection } from '../../app/navigation';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import { Brand } from './Brand';
import { EditModeToggle } from './EditModeToggle';
import { SearchTrigger } from './SearchTrigger';
import { SidebarToggle } from './Sidebar';
import { SiteSwitch } from './SiteSwitch';
import { SyncButton } from './SyncButton';
import { UserMenu } from './UserMenu';
import styles from './TopBar.module.css';

interface TopBarProps {
  onOpenSearch: () => void;
}

/**
 * Верхняя панель: текущий раздел слева, поиск и меню справа.
 * На телефоне вместо названия раздела — логотип.
 */
export function TopBar({ onOpenSearch }: TopBarProps) {
  const { pathname } = useLocation();
  const section = findSection(pathname);
  const SectionIcon = section?.icon;
  // Название вкладки — раздел; конспект и предмет уточняют своим (см. useDocumentTitle)
  useDocumentTitle(section?.label, pathname);

  // Пока страница в самом верху, шапка сливается с фоном (без грани); при прокрутке получает подложку и линию (data-scrolled)
  useEffect(() => {
    const root = document.documentElement;
    const update = () => {
      if (scrollY > 4) root.dataset.scrolled = '';
      else delete root.dataset.scrolled;
    };
    update();
    addEventListener('scroll', update, { passive: true });
    return () => {
      removeEventListener('scroll', update);
      delete root.dataset.scrolled;
    };
  }, []);

  return (
    <header className={styles.bar}>
      <div className={styles.inner}>
        <div className={styles.mobileBrand}>
          <Brand />
        </div>

        {/* Меню свёрнуто — кнопка «Открыть боковую панель» в начале шапки (на телефоне меню и так нет) */}
        <SidebarToggle action="open" className={styles.sidebarToggle} side="bottom-start" />

        {section && SectionIcon && (
          <p className={styles.section}>
            <SectionIcon size={14} strokeWidth={1.75} aria-hidden />
            {section.label}
          </p>
        )}

        <div className={styles.actions}>
          <SiteSwitch />
          <SyncButton />
          <EditModeToggle />
          <SearchTrigger onClick={onOpenSearch} />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
