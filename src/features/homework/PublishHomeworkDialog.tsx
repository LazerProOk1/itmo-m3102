import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { getToken, readRepoFile, saveToken, writeRepoFile } from '../../services/github';
import { TokenFields, type TokenValue } from '../group/TokenFields';
import groupStyles from '../group/group.module.css';
import { HOMEWORK_PATH, mergeHomework, parseHomework, serializeHomework, useHomeworkStore } from './homeworkStore';
import styles from './Homework.module.css';

const FORM_ID = 'homework-publish-form';

/** Публикация ДЗ в data/homework.json — свежая версия с GitHub + мои правки, сливаются по id. */
export function PublishHomeworkDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [message, setMessage] = useState('');
  const [token, setToken] = useState<TokenValue>({ token: '', remember: false });
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMessage(`Домашнее задание: обновление ${new Date().toLocaleDateString('ru-RU')}`);
    setToken({ token: '', remember: false });
    setStatus('');
  }, [open]);

  async function publish() {
    if (token.token.trim()) saveToken(token.token, token.remember);
    if (!getToken()) return setStatus('Введите токен с правом Contents: Read and write.');
    setBusy(true);
    setStatus('Сохраняем…');
    try {
      const { base, items, markPublished } = useHomeworkStore.getState();
      const remote = await readRepoFile(HOMEWORK_PATH);
      const latest = remote ? parseHomework(JSON.parse(remote.text)) : [];
      const result = mergeHomework(base, latest, items);
      await writeRepoFile(HOMEWORK_PATH, serializeHomework(result), message.trim() || 'Обновить домашнее задание', remote?.sha);
      markPublished(result);
      setStatus('Сохранено. Задания появятся у группы после обновления GitHub Pages (обычно пара минут).');
      setTimeout(onClose, 1800);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Не удалось сохранить задания.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Сохранить домашнее задание"
      description="Изменения станут видны всей группе — и здесь, и на сайте М3102."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" type="submit" form={FORM_ID} disabled={busy}>
            Сохранить
          </Button>
        </>
      }
    >
      <form
        id={FORM_ID}
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void publish();
        }}
      >
        <Field label="Сообщение коммита" htmlFor="hw-commit">
          <Input id="hw-commit" required maxLength={160} value={message} onChange={(event) => setMessage(event.target.value)} />
        </Field>
        <TokenFields value={token} onChange={setToken} />
        {status && (
          <p className={groupStyles.status} aria-live="polite">
            {status}
          </p>
        )}
      </form>
    </Modal>
  );
}
