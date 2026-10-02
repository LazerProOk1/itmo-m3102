import { Ellipsis, ExternalLink, Pencil, Trash } from 'lucide-react';
import { ConfirmDeleteModal, useConfirmDelete } from '../../components/ui/ConfirmDeleteModal';
import { DropdownItem, DropdownMenu, DropdownSeparator } from '../../components/ui/DropdownMenu';
import { IconButton } from '../../components/ui/IconButton';
import { ListItem } from '../../components/ui/List';
import { formatDayLabel } from '../../lib/dates';
import type { ISODate, Material } from '../../types/models';
import { useEditMode } from '../settings/EditModeContext';
import { useOptionalSubjectName } from '../subjects/subjectsStore';
import { useMaterialsStore } from './materialsStore';
import { MATERIAL_TYPES } from './labels';
import styles from './MaterialRow.module.css';

interface MaterialRowProps {
  material: Material;
  today: ISODate;
  onEdit: (material: Material) => void;
  /** Показать предмет в подписи — нужно на страницах, где материалы разных предметов вперемешку */
  showSubject?: boolean;
}

/** Строка материала или ссылки: иконка по типу, название (клик — редактирование), дата, открыть, меню. */
export function MaterialRow({ material, today, onEdit, showSubject = false }: MaterialRowProps) {
  const { isEditMode } = useEditMode();
  const deleteMaterial = useMaterialsStore((state) => state.deleteMaterial);
  const subjectName = useOptionalSubjectName(material.subjectId);
  const { label, icon: Icon } = MATERIAL_TYPES[material.type];
  const confirmDelete = useConfirmDelete<Material>();

  return (
    <>
      <ListItem
        leading={
          <span className={styles.icon}>
            <Icon size={14} strokeWidth={1.75} aria-hidden />
          </span>
        }
        title={
          <button type="button" className={styles.titleButton} onClick={() => onEdit(material)}>
            {material.name}
          </button>
        }
        meta={showSubject ? [subjectName, label].filter(Boolean).join(' · ') : label}
        trailing={
          <>
            <span className={styles.date}>{formatDayLabel(material.createdAt.slice(0, 10), today)}</span>
            <IconButton
              icon={ExternalLink}
              label={`Открыть ${material.name}`}
              size="sm"
              onClick={() => window.open(material.url, '_blank', 'noopener,noreferrer')}
            />
            {isEditMode && (
              <DropdownMenu align="end" trigger={(props) => <IconButton icon={Ellipsis} label="Действия с материалом" size="sm" {...props} />}>
                <DropdownItem icon={Pencil} onSelect={() => onEdit(material)}>
                  Изменить
                </DropdownItem>
                <DropdownSeparator />
                <DropdownItem icon={Trash} onSelect={() => confirmDelete.request(material)}>
                  Удалить
                </DropdownItem>
              </DropdownMenu>
            )}
          </>
        }
      />
      <ConfirmDeleteModal
        open={confirmDelete.target !== null}
        title={confirmDelete.target?.name ?? ''}
        onCancel={confirmDelete.cancel}
        onConfirm={() => {
          if (confirmDelete.target) deleteMaterial(confirmDelete.target.id);
          confirmDelete.cancel();
        }}
      />
    </>
  );
}
