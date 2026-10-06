import { Trash } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { ConfirmDeleteModal } from '../../components/ui/ConfirmDeleteModal';
import { Modal } from '../../components/ui/Modal';
import type { Subject } from '../../types/models';
import { SubjectForm } from './SubjectForm';
import { useSubjectsStore, type SubjectDraft } from './subjectsStore';
import styles from './SubjectDialog.module.css';

/** Что открыто в окне: новый предмет или редактирование существующего */
export type SubjectDialogTarget = { mode: 'create' } | { mode: 'edit'; subject: Subject };

const FORM_ID = 'subject-form';

interface SubjectDialogProps {
  target: SubjectDialogTarget | null;
  onClose: () => void;
  /** Вызывается после удаления — например, чтобы уйти со страницы удалённого предмета */
  onDeleted?: () => void;
}

/** Создание, редактирование и удаление предмета в одном модальном окне. */
export function SubjectDialog({ target, onClose, onDeleted }: SubjectDialogProps) {
  const addSubject = useSubjectsStore((state) => state.addSubject);
  const updateSubject = useSubjectsStore((state) => state.updateSubject);
  const deleteSubject = useSubjectsStore((state) => state.deleteSubject);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const isEditing = target?.mode === 'edit';

  function handleSubmit(draft: SubjectDraft) {
    if (!target) return;
    if (target.mode === 'edit') updateSubject(target.subject.id, draft);
    else addSubject(draft);
    onClose();
  }

  function handleDelete() {
    if (target?.mode !== 'edit') return;
    deleteSubject(target.subject.id);
    setConfirmingDelete(false);
    onClose();
    onDeleted?.();
  }

  return (
    <>
      <Modal
        open={target !== null}
        onClose={onClose}
        title={isEditing ? 'Изменить предмет' : 'Добавить предмет'}
        size="md"
        footer={
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
              {isEditing ? 'Сохранить' : 'Добавить предмет'}
            </Button>
          </>
        }
      >
        {target && (
          <SubjectForm
            id={FORM_ID}
            initialValues={
              target.mode === 'edit'
                ? {
                    name: target.subject.name,
                    teacherPrimary: target.subject.teacherPrimary ?? '',
                    telegramChatUrl: target.subject.telegramChatUrl ?? '',
                    contacts: target.subject.contacts ?? [],
                  }
                : { name: '', teacherPrimary: '', telegramChatUrl: '', contacts: [] }
            }
            onSubmit={handleSubmit}
          />
        )}
      </Modal>
      <ConfirmDeleteModal
        open={confirmingDelete}
        title={target?.mode === 'edit' ? target.subject.name : ''}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={handleDelete}
      />
    </>
  );
}
