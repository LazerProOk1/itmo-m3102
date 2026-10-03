import { Pencil } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { GithubSourceBadge } from '../../components/ui/GithubSourceBadge';
import { IconButton } from '../../components/ui/IconButton';
import { Section } from '../../components/ui/Section';
import { Tabs, type TabItem } from '../../components/ui/Tabs';
import { useEditMode } from '../settings/EditModeContext';
import type { SubjectInfo, SubjectInfoCategory } from '../../types/models';
import styles from './SubjectInfoSection.module.css';

// Markdown с формулами (KaTeX) — ~600 КБ: страница предмета открывается сразу, описание курса дорисовывается следом
const LectureNoteContentView = lazy(() =>
  import('../materials/LectureNoteContentView').then((module) => ({ default: module.LectureNoteContentView })),
);

const CATEGORY_LABELS: Record<SubjectInfoCategory, string> = {
  description: 'Описание',
  rules: 'Правила',
  links: 'Ссылки',
  other: 'Другое',
};

interface SubjectInfoSectionProps {
  items: SubjectInfo[];
  onEdit: (item: SubjectInfo) => void;
}

/**
 * Нелекционный контент предмета (описание курса, правила аттестации, ссылки), пришедший
 * из GitHub-синхронизации — показывается до вкладок Overview/Tasks/Materials (PROMPT 25).
 * Несколько категорий — переключаются табами; внутри категории — все записи подряд.
 */
export function SubjectInfoSection({ items, onEdit }: SubjectInfoSectionProps) {
  const { isEditMode } = useEditMode();
  const active = items.filter((item) => !item.archived);
  const categories = Array.from(new Set(active.map((item) => item.category)));
  const [category, setCategory] = useState<SubjectInfoCategory>(categories[0] ?? 'description');

  if (active.length === 0) return null;

  const currentCategory = categories.includes(category) ? category : categories[0]!;
  const visible = active.filter((item) => item.category === currentCategory);

  const tabItems: TabItem<SubjectInfoCategory>[] = categories.map((value) => ({
    value,
    label: CATEGORY_LABELS[value],
  }));

  return (
    <Section title="О курсе" className={styles.section}>
      {categories.length > 1 && (
        <Tabs label="Категория информации о курсе" items={tabItems} value={currentCategory} onChange={setCategory} className={styles.tabs} />
      )}

      {visible.map((item) => (
        <div key={item.id} className={styles.item}>
          <header className={styles.itemHeader}>
            <h3 className={styles.itemTitle}>
              {item.title}
              {item.source === 'github' && <GithubSourceBadge />}
            </h3>
            {isEditMode && <IconButton icon={Pencil} label="Изменить" size="sm" onClick={() => onEdit(item)} />}
          </header>
          <Suspense fallback={<p className={styles.loading}>Загружаем описание…</p>}>
            <LectureNoteContentView contentType="markdown" content={item.content} sourceRef={item.sourceRef} />
          </Suspense>
        </div>
      ))}
    </Section>
  );
}
