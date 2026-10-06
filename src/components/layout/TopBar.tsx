import { useLocation } from 'react-router';
import { findSection } from '../../app/navigation';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import { Brand } from './Brand';
import { EditModeToggle } from './EditModeToggle';
import { SearchTrigger } from './SearchTrigger';
import { SidebarToggle } from './Sidebar';
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
          <SyncButton />
          <EditModeToggle />
          <SearchTrigger onClick={onOpenSearch} />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
