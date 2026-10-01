import { useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Tabs, type TabItem } from '../../components/ui/Tabs';
import { LinksPage } from '../group/LinksPage';
import { GroupFilesRoot, GroupFolder } from '../group/RepoFilePage';
import { LectureNotesTab } from './LectureNotesTab';
import styles from './MaterialsPage.module.css';

type MaterialsSection = 'notes' | 'materials' | 'files' | 'links';

const SECTION_TABS: TabItem<MaterialsSection>[] = [
  { value: 'notes', label: 'Конспекты' },
  { value: 'materials', label: 'Материалы' },
  { value: 'files', label: 'Файлы группы' },
  { value: 'links', label: 'Ссылки' },
];

/** Материалы: конспекты (1 поток и группа), учебники из «Материалы/», остальные файлы группы и ссылки. */
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
        {section === 'notes' && <LectureNotesTab />}
        {section === 'files' && <GroupFilesRoot />}
        {section === 'links' && <LinksPage embedded />}
        {section === 'materials' && <GroupFolder folder="Материалы" />}
      </div>
    </>
  );
}
