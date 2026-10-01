import { useLocation } from 'react-router';
import { findSection } from '../../app/navigation';
import { Brand } from './Brand';
import { EditModeToggle } from './EditModeToggle';
import { SearchTrigger } from './SearchTrigger';
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

  return (
    <header className={styles.bar}>
      <div className={styles.inner}>
        <div className={styles.mobileBrand}>
          <Brand />
        </div>

        {section && SectionIcon && (
          <p className={styles.section}>
            <SectionIcon size={14} strokeWidth={1.75} aria-hidden />
            {section.label}
          </p>
        )}

        <div className={styles.actions}>
          <EditModeToggle />
          <SearchTrigger onClick={onOpenSearch} />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
