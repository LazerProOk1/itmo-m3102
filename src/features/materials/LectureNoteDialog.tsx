import { Trash } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { ConfirmDeleteModal } from '../../components/ui/ConfirmDeleteModal';
import { Modal } from '../../components/ui/Modal';
import { useEditMode } from '../settings/EditModeContext';
import type { ID, LectureNote, LectureNoteCollection } from '../../types/models';
import { LectureNoteForm, type LectureNoteFormValues } from './LectureNoteForm';
import { useLectureNotesStore } from './lectureNotesStore';
import styles from './LectureNoteDialog.module.css';

/** Что открыто в окне: новый конспект (можно заранее задать предмет) или редактирование существующего */
export type LectureNoteDialogTarget =
  { mode: 'create'; defaultSubjectId?: ID; defaultCollection?: LectureNoteCollection } | { mode: 'edit'; note: LectureNote };

const FORM_ID = 'lecture-note-form';

interface LectureNoteDialogProps {
  target: LectureNoteDialogTarget | null;
  onClose: () => void;
}

/** Создание и редактирование конспекта лекции в одном модальном окне. */
export function LectureNoteDialog({ target, onClose }: LectureNoteDialogProps) {
  const { isEditMode } = useEditMode();
  const addLectureNote = useLectureNotesStore((state) => state.addLectureNote);
  const updateLectureNote = useLectureNotesStore((state) => state.updateLectureNote);
  const deleteLectureNote = useLectureNotesStore((state) => state.deleteLectureNote);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const isEditing = target?.mode === 'edit';

  function handleSubmit(values: LectureNoteFormValues) {
    if (!target) return;
    const draft = {
      subjectId: values.subjectId,
      lectureNumber: values.lectureNumber.trim(),
      title: values.title.trim(),
      contentType: values.contentType,
      content: values.content.trim(),
    };

    if (target.mode === 'edit') updateLectureNote(target.note.id, draft);
    else addLectureNote({ ...draft, collection: target.defaultCollection });
    onClose();
  }

  function handleDelete() {
    if (target?.mode === 'edit') deleteLectureNote(target.note.id);
    setConfirmingDelete(false);
    onClose();
  }

  return (
    <>
      <Modal
        open={target !== null}
        onClose={onClose}
        title={!isEditMode && target?.mode === 'edit' ? target.note.title : isEditing ? 'Изменить конспект' : 'Новый конспект'}
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
                {isEditing ? 'Сохранить' : 'Создать конспект'}
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
          <LectureNoteForm
            id={FORM_ID}
            initialValues={getInitialValues(target)}
            onSubmit={handleSubmit}
            disabled={!isEditMode}
            sourceRef={target.mode === 'edit' ? target.note.sourceRef : undefined}
          />
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

function getInitialValues(target: LectureNoteDialogTarget): LectureNoteFormValues {
  if (target.mode === 'edit') {
    return {
      subjectId: target.note.subjectId,
      lectureNumber: target.note.lectureNumber,
      title: target.note.title,
      contentType: target.note.contentType,
      content: target.note.content,
    };
  }
  return { subjectId: target.defaultSubjectId ?? '', lectureNumber: '', title: '', contentType: 'markdown', content: '' };
}
