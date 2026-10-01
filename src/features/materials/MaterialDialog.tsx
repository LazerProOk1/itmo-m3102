import { Trash } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { ConfirmDeleteModal } from '../../components/ui/ConfirmDeleteModal';
import { Modal } from '../../components/ui/Modal';
import { useEditMode } from '../settings/EditModeContext';
import type { ID, Material, MaterialType } from '../../types/models';
import { MaterialForm, type MaterialFormValues } from './MaterialForm';
import { useMaterialsStore } from './materialsStore';
import styles from './MaterialDialog.module.css';

/** Что открыто в окне: новый материал (можно заранее задать предмет и/или тип) или редактирование существующего */
export type MaterialDialogTarget =
  | { mode: 'create'; defaultSubjectId?: ID; defaultType?: MaterialType }
  | { mode: 'edit'; material: Material };

const FORM_ID = 'material-form';

interface MaterialDialogProps {
  target: MaterialDialogTarget | null;
  onClose: () => void;
}

/** Создание и редактирование материала (документа, ссылки или Google-файла) в одном модальном окне. */
export function MaterialDialog({ target, onClose }: MaterialDialogProps) {
  const { isEditMode } = useEditMode();
  const addMaterial = useMaterialsStore((state) => state.addMaterial);
  const updateMaterial = useMaterialsStore((state) => state.updateMaterial);
  const deleteMaterial = useMaterialsStore((state) => state.deleteMaterial);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const isEditing = target?.mode === 'edit';
  const isLink = target?.mode === 'create' && target.defaultType === 'link';

  function handleSubmit(values: MaterialFormValues) {
    if (!target) return;
    const draft = {
      name: values.name.trim(),
      subjectId: values.subjectId || undefined,
      category: values.category,
      type: values.type,
      url: values.url.trim(),
      description: values.description.trim() || undefined,
    };

    if (target.mode === 'edit') updateMaterial(target.material.id, draft);
    else addMaterial(draft);
    onClose();
  }

  function handleDelete() {
    if (target?.mode === 'edit') deleteMaterial(target.material.id);
    setConfirmingDelete(false);
    onClose();
  }

  const titles = { create: isLink ? 'Добавить ссылку' : 'Добавить материал', edit: isLink ? 'Изменить ссылку' : 'Изменить материал' };

  return (
    <>
      <Modal
        open={target !== null}
        onClose={onClose}
        title={!isEditMode && target?.mode === 'edit' ? target.material.name : isEditing ? titles.edit : titles.create}
        footer={
          isEditMode ? (
            <>
              {isEditing && (
                <Button variant="danger" icon={Trash} className={styles.delete} onClick={() => setConfirmingDelete(true)}>
                  Удалить
                </Button>
              )}
              <Button variant="ghost" onClick={onClose}>
                Отмена
              </Button>
              <Button variant="primary" type="submit" form={FORM_ID}>
                {isEditing ? 'Сохранить' : 'Добавить'}
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={onClose}>
              Закрыть
            </Button>
          )
        }
      >
        {target && (
          <MaterialForm
            id={FORM_ID}
            initialValues={getInitialValues(target)}
            onSubmit={handleSubmit}
            disabled={!isEditMode}
          />
        )}
      </Modal>
      <ConfirmDeleteModal
        open={confirmingDelete}
        title={target?.mode === 'edit' ? target.material.name : ''}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={handleDelete}
      />
    </>
  );
}

function getInitialValues(target: MaterialDialogTarget): MaterialFormValues {
  if (target.mode === 'edit') {
    const { material } = target;
    return {
      name: material.name,
      subjectId: material.subjectId ?? '',
      category: material.category ?? 'other',
      type: material.type,
      url: material.url,
      description: material.description ?? '',
    };
  }
  return {
    name: '',
    subjectId: target.defaultSubjectId ?? '',
    category: 'other',
    type: target.defaultType ?? 'pdf',
    url: '',
    description: '',
  };
}
