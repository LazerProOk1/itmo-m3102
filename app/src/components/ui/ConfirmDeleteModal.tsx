import { useState } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';

interface ConfirmDeleteModalProps {
  open: boolean;
  /** Название удаляемой записи — подставляется в «Удалить «{title}»?» */
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Единое окно подтверждения удаления — для задач, дедлайнов, занятий, материалов, конспектов, заметок и предметов. */
export function ConfirmDeleteModal({ open, title, onCancel, onConfirm }: ConfirmDeleteModalProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={`Удалить «${title}»?`}
      description="Это действие нельзя отменить."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Отмена
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            Удалить
          </Button>
        </>
      }
    >
      {null}
    </Modal>
  );
}

/** Какая запись ждёт подтверждения удаления — для рядов списков вне диалога редактирования. */
export function useConfirmDelete<T>() {
  const [target, setTarget] = useState<T | null>(null);

  return {
    target,
    request: setTarget,
    cancel: () => setTarget(null),
  };
}
