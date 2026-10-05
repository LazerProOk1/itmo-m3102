import { BookOpen, FolderOpen, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { SECTIONS } from '../../app/navigation';
import { buttonClass } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { IconButton } from '../../components/ui/IconButton';
import { List, ListItem } from '../../components/ui/List';
import { Section } from '../../components/ui/Section';
import { Tabs, type TabItem } from '../../components/ui/Tabs';
import type { ISODate, LectureNote, Material } from '../../types/models';
import { LectureNoteRow } from '../materials/LectureNoteRow';
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
  lectureNotes: LectureNote[];
  materials: Material[];
  today: ISODate;
  onAddNote: () => void;
  onEditNote: (note: LectureNote) => void;
  onAddMaterial: () => void;
  onEditMaterial: (material: Material) => void;
}

/** Материалы предмета: конспекты лекций и остальные материалы — два независимых списка в одной вкладке. */
export function SubjectMaterialsTab({
  lectureNotes,
  materials,
  today,
  onAddNote,
  onEditNote,
  onAddMaterial,
  onEditMaterial,
}: SubjectMaterialsTabProps) {
  const { isEditMode } = useEditMode();
  const [chip, setChip] = useState<MaterialChip>('all');

  const sortedNotes = [...lectureNotes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const continueReading = [...lectureNotes].filter((note) => note.lastOpenedAt).sort((a, b) => b.lastOpenedAt!.localeCompare(a.lastOpenedAt!))[0];

  const sortedMaterials = [...materials].filter((material) => matchesChip(material, chip)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <>
      <Section
        title="Конспекты"
        action={
          <div className={styles.actions}>
            {isEditMode && <IconButton icon={Plus} label="Добавить конспект" size="sm" onClick={onAddNote} />}
            <Link to={SECTIONS.materials.path} className={buttonClass('ghost', 'sm')}>
              Все →
            </Link>
          </div>
        }
      >
        {continueReading && (
          <List className={styles.continueList}>
            <ListItem
              highlighted
              leading={<BookOpen size={14} strokeWidth={1.75} aria-hidden />}
              title={
                <Link to={`/materials/notes/${continueReading.id}`} className={styles.continueButton} data-row-action>
                  Продолжить чтение — {continueReading.title} →
                </Link>
              }
            />
          </List>
        )}
        {sortedNotes.length === 0 ? (
          <EmptyState compact icon={BookOpen} title="Пока нет конспектов" />
        ) : (
          <List>
            {sortedNotes.map((note) => (
              <LectureNoteRow key={note.id} note={note} today={today} onEdit={onEditNote} />
            ))}
          </List>
        )}
      </Section>

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
  );
}
