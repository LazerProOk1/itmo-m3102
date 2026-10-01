import { Trash } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { ConfirmDeleteModal } from '../../components/ui/ConfirmDeleteModal';
import { Modal } from '../../components/ui/Modal';
import { useEditMode } from '../settings/EditModeContext';
import type { ID, Note } from '../../types/models';
import { NoteForm, type NoteFormValues } from './NoteForm';
import { useNotesStore } from './notesStore';
import styles from './NoteDialog.module.css';

/** Что открыто в окне: новая заметка (можно заранее задать предмет) или редактирование существующей */
export type NoteDialogTarget = { mode: 'create'; defaultSubjectId?: ID } | { mode: 'edit'; note: Note };

const FORM_ID = 'note-form';

interface NoteDialogProps {
  target: NoteDialogTarget | null;
  onClose: () => void;
}

/** Создание и редактирование заметки в одном модальном окне — просторнее остальных, ей самое место для текста. */
export function NoteDialog({ target, onClose }: NoteDialogProps) {
  const { isEditMode } = useEditMode();
  const addNote = useNotesStore((state) => state.addNote);
  const updateNote = useNotesStore((state) => state.updateNote);
  const deleteNote = useNotesStore((state) => state.deleteNote);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const isEditing = target?.mode === 'edit';

  function handleSubmit(values: NoteFormValues) {
    if (!target) return;
    const draft = {
      title: values.title.trim(),
      subjectId: values.subjectId || undefined,
      content: values.content.trim(),
    };

    if (target.mode === 'edit') updateNote(target.note.id, draft);
    else addNote(draft);
    onClose();
  }

  function handleDelete() {
    if (target?.mode === 'edit') deleteNote(target.note.id);
    setConfirmingDelete(false);
    onClose();
  }

  return (
    <>
      <Modal
        open={target !== null}
        onClose={onClose}
        title={!isEditMode && target?.mode === 'edit' ? target.note.title : isEditing ? 'Изменить заметку' : 'Новая заметка'}
        size="lg"
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
                {isEditing ? 'Сохранить' : 'Создать заметку'}
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
          <NoteForm id={FORM_ID} initialValues={getInitialValues(target)} onSubmit={handleSubmit} disabled={!isEditMode} />
        )}
      </Modal>
      <ConfirmDeleteModal
        open={confirmingDelete}
        title={target?.mode === 'edit' ? target.note.title : ''}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={handleDelete}
      />
    </>
  );
}

function getInitialValues(target: NoteDialogTarget): NoteFormValues {
  if (target.mode === 'edit') {
    return {
      title: target.note.title,
      subjectId: target.note.subjectId ?? '',
      content: target.note.content,
    };
  }
  return { title: '', subjectId: target.defaultSubjectId ?? '', content: '' };
}
