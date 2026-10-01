import { Trash } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { ConfirmDeleteModal } from '../../components/ui/ConfirmDeleteModal';
import { Modal } from '../../components/ui/Modal';
import type { SubjectInfo } from '../../types/models';
import { useSubjectInfoStore } from './subjectInfoStore';
import { SubjectInfoForm, type SubjectInfoFormValues } from './SubjectInfoForm';

const FORM_ID = 'subject-info-form';

interface SubjectInfoDialogProps {
  target: SubjectInfo | null;
  onClose: () => void;
}

/**
 * Редактирование записи, синхронизированной с GitHub (или созданной раньше синхронизацией) —
 * своей формы «создать» нет, эти записи приходят только из GitHub.
 */
export function SubjectInfoDialog({ target, onClose }: SubjectInfoDialogProps) {
  const updateSubjectInfo = useSubjectInfoStore((state) => state.updateSubjectInfo);
  const deleteSubjectInfo = useSubjectInfoStore((state) => state.deleteSubjectInfo);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function handleSubmit(values: SubjectInfoFormValues) {
    if (!target) return;
    updateSubjectInfo(target.id, {
      title: values.title.trim(),
      category: values.category,
      content: values.content.trim(),
    });
    onClose();
  }

  function handleDelete() {
    if (target) deleteSubjectInfo(target.id);
    setConfirmingDelete(false);
    onClose();
  }

  return (
    <>
      <Modal
        open={target !== null}
        onClose={onClose}
        title="Изменить информацию о курсе"
        description={
          target?.source === 'github'
            ? 'Синхронизировано из GitHub — если файл в репозитории изменится, правки здесь будут перезаписаны.'
            : undefined
        }
        size="lg"
        footer={
          <>
            <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
              <Trash size={14} strokeWidth={1.75} aria-hidden />
              Удалить
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Отмена
            </Button>
            <Button variant="primary" type="submit" form={FORM_ID}>
              Сохранить
            </Button>
          </>
        }
      >
        {target && (
          <SubjectInfoForm
            id={FORM_ID}
            initialValues={{ title: target.title, category: target.category, content: target.content }}
            onSubmit={handleSubmit}
          />
        )}
      </Modal>
      <ConfirmDeleteModal
        open={confirmingDelete}
        title={target?.title ?? ''}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={handleDelete}
      />
    </>
  );
}
