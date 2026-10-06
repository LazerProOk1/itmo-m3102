import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { MORE_PAGE_SECTIONS } from '../../app/navigation';
import { ThemeToggle } from '../../components/layout/ThemeToggle';
import { PageHeader } from '../../components/ui/PageHeader';
import styles from './MorePage.module.css';

/** Страница «More» для телефона: разделы, не поместившиеся в нижнюю панель, и смена темы. */
export function MorePage() {
  return (
    <>
      <PageHeader title="Ещё" />

      <ul className={styles.list}>
        {MORE_PAGE_SECTIONS.map((section) => {
          const Icon = section.icon;

          return (
            <li key={section.path} className={styles.item}>
              <Link to={section.path} className={styles.row}>
                <Icon size={18} strokeWidth={1.75} className={styles.muted} aria-hidden />
                <span className={styles.label}>{section.label}</span>
                <ChevronRight size={16} strokeWidth={1.75} className={styles.muted} aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>

      <div className={styles.themeRow}>
        <span>Тема</span>
        <ThemeToggle />
      </div>
    </>
  );
}
