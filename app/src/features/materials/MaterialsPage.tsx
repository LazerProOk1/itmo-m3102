import { useSearchParams } from 'react-router';
import { PageHeader } from '../../components/ui/PageHeader';
import { Swap, useDirection } from '../../components/ui/Swap';
import { Tabs, type TabItem } from '../../components/ui/Tabs';
import { LinksPage } from '../group/LinksPage';
import { GroupFolder } from '../group/RepoFilePage';
import { LectureNotesTab } from './LectureNotesTab';
import styles from './MaterialsPage.module.css';

type MaterialsSection = 'notes' | 'materials' | 'links';

const SECTION_TABS: TabItem<MaterialsSection>[] = [
  { value: 'notes', label: 'Конспекты' },
  { value: 'materials', label: 'Материалы' },
  { value: 'links', label: 'Ссылки' },
];

/** Материалы: конспекты группы, учебники из «Материалы/» и ссылки. */
export function MaterialsPage() {
  // Раздел — в адресе (?tab=…): «Назад» в браузере возвращает на прошлую вкладку, а не в начало
  const [params, setParams] = useSearchParams();
  const section = SECTION_TABS.find((tab) => tab.value === params.get('tab'))?.value ?? 'notes';
  const setSection = (value: MaterialsSection) => setParams(value === 'notes' ? {} : { tab: value });
  const direction = useDirection(SECTION_TABS.findIndex((tab) => tab.value === section));

  return (
    <>
      <PageHeader title="Материалы" />
      <Tabs label="Раздел материалов" items={SECTION_TABS} value={section} onChange={setSection} className={styles.sectionTabs} />
      <div role="tabpanel">
        <Swap id={section} direction={direction}>
          {section === 'notes' && <LectureNotesTab />}
          {section === 'links' && <LinksPage embedded />}
          {section === 'materials' && <GroupFolder folder="Материалы" />}
        </Swap>
      </div>
    </>
  );
}
