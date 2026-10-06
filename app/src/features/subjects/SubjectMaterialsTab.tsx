import { BookOpen, FolderOpen, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { SECTIONS } from '../../app/navigation';
import { buttonClass } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { IconButton } from '../../components/ui/IconButton';
import { List } from '../../components/ui/List';
import { Section } from '../../components/ui/Section';
import { Tabs, type TabItem } from '../../components/ui/Tabs';
import type { ISODate, LectureNote, Material } from '../../types/models';
import { FolderList } from '../materials/LectureNotesTab';
import { compareLessons } from '../materials/NoteReader';
import { MaterialRow } from '../materials/MaterialRow';
import { useEditMode } from '../settings/EditModeContext';
import styles from './SubjectMaterialsTab.module.css';

type MaterialChip = 'all' | 'literature' | 'assignments' | 'google';

const CHIP_ITEMS: TabItem<MaterialChip>[] = [
  { value: 'all', label: 'Все' },
  { value: 'literature', label: 'Литература' },
  { value: 'assignments', label: 'Задания' },
  { value: 'google', label: 'Google Drive' },
];

function matchesChip(material: Material, chip: MaterialChip): boolean {
  if (chip === 'all') return true;
  if (chip === 'google') return material.type === 'google_drive' || material.type === 'google_docs';
  return (material.category ?? 'other') === chip;
}

interface SubjectMaterialsTabProps {
  subjectId: string;
  lectureNotes: LectureNote[];
  materials: Material[];
  today: ISODate;
  onAddNote: () => void;
  onAddMaterial: () => void;
  onEditMaterial: (material: Material) => void;
}

/** Материалы предмета: конспекты лекций и остальные материалы — два независимых списка в одной вкладке. */
export function SubjectMaterialsTab({
  subjectId,
  lectureNotes,
  materials,
  today,
  onAddNote,
  onAddMaterial,
  onEditMaterial,
}: SubjectMaterialsTabProps) {
  const { isEditMode } = useEditMode();
  const [chip, setChip] = useState<MaterialChip>('all');

  const navigate = useNavigate();
  // Папки занятий по порядку (Лекция 1, Практика 1…), как в «Материалы → Конспекты»
  const sortedNotes = [...lectureNotes].sort(compareLessons);
  const openFolder = (folder: string) => navigate(`${SECTIONS.materials.path}?s=${encodeURIComponent(subjectId)}&f=${encodeURIComponent(folder)}`);

  const sortedMaterials = [...materials].filter((material) => matchesChip(material, chip)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <>
      <Section
        title="Конспекты"
        action={
          <div className={styles.actions}>
            {isEditMode && <IconButton icon={Plus} label="Добавить конспект" size="sm" onClick={onAddNote} />}
            <Link to={`${SECTIONS.materials.path}?s=${encodeURIComponent(subjectId)}`} className={buttonClass('ghost', 'sm')}>
              Все →
            </Link>
          </div>
        }
      >
        {sortedNotes.length === 0 ? (
          <EmptyState compact icon={BookOpen} title="Пока нет конспектов" />
        ) : (
          <FolderList notes={sortedNotes} onSelect={openFolder} />
        )}
      </Section>

      {/* Добавленные вручную материалы (литература, Google Drive…) — только если они есть или включено редактирование */}
      {(materials.length > 0 || isEditMode) && (
        <>
          <hr className={styles.divider} />

          <Section
            title="Материалы"
            action={
              <div className={styles.actions}>
                {isEditMode && <IconButton icon={Plus} label="Добавить материал" size="sm" onClick={onAddMaterial} />}
                <Tabs label="Фильтр материалов" items={CHIP_ITEMS} value={chip} onChange={setChip} />
              </div>
            }
          >
            {sortedMaterials.length === 0 ? (
              <EmptyState compact icon={FolderOpen} title="Пока нет материалов" description="Добавьте слайды, документы или ссылки этого предмета." />
            ) : (
              <List>
                {sortedMaterials.map((material) => (
                  <MaterialRow key={material.id} material={material} today={today} onEdit={onEditMaterial} />
                ))}
              </List>
            )}
          </Section>
        </>
      )}
    </>
  );
}
