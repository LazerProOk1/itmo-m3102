import { useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Tabs, type TabItem } from '../../components/ui/Tabs';
import { GroupFilesRoot } from '../group/RepoFilePage';
import { LectureNotesTab } from './LectureNotesTab';
import { MaterialsLibraryTab } from './MaterialsLibraryTab';
import styles from './MaterialsPage.module.css';

type MaterialsSection = 'notes' | 'files' | 'library';

const SECTION_TABS: TabItem<MaterialsSection>[] = [
  { value: 'notes', label: 'Конспекты' },
  { value: 'files', label: 'Файлы группы' },
  { value: 'library', label: 'Материалы' },
];

/** Материалы: конспекты (1 поток и группа), файлы репозитория группы и остальные материалы. */
export function MaterialsPage() {
  const [section, setSection] = useState<MaterialsSection>('notes');

  return (
    <>
      <PageHeader title="Материалы" />
      <Tabs
        label="Раздел материалов"
        items={SECTION_TABS}
        value={section}
        onChange={setSection}
        className={styles.sectionTabs}
      />
      <div role="tabpanel">
        {section === 'notes' ? <LectureNotesTab /> : section === 'files' ? <GroupFilesRoot /> : <MaterialsLibraryTab />}
      </div>
    </>
  );
}
