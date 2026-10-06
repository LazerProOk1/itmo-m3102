import { useState, type FormEvent } from 'react';
import { Dropdown, type DropdownOption } from '../../components/ui/Dropdown';
import { Field } from '../../components/ui/Field';
import { Form } from '../../components/ui/Form';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { useSubjectsStore } from '../subjects/subjectsStore';
import styles from './NoteForm.module.css';

export interface NoteFormValues {
  title: string;
  subjectId: string;
  content: string;
}

interface NoteFormProps {
  id: string;
  initialValues: NoteFormValues;
  onSubmit: (values: NoteFormValues) => void;
  /** Только просмотр — все поля отключены, без кнопки сохранения */
  disabled?: boolean;
}

/**
 * Поля заметки. Никакого форматирования, кроме обычного текста — заметка
 * не должна превращаться в редактор блоков. Разметку в духе markdown
 * (например, "- пункт" или "# заголовок") можно писать от руки, приложение её не разбирает.
 */
export function NoteForm({ id, initialValues, onSubmit, disabled }: NoteFormProps) {
  const subjects = useSubjectsStore((state) => state.subjects);
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState('');

  const subjectOptions: DropdownOption[] = subjects.map((subject) => ({ value: subject.id, label: subject.name }));

  function update<K extends keyof NoteFormValues>(key: K, value: NoteFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!values.title.trim()) {
      setError('Укажите название заметки.');
      return;
    }
    onSubmit(values);
  }

  return (
    <Form id={id} onSubmit={handleSubmit} disabled={disabled}>
      <Field label="Название" htmlFor="note-title" error={error}>
        <Input
          id="note-title"
          value={values.title}
          placeholder="например, указатели"
          invalid={Boolean(error)}
          onChange={(event) => {
            update('title', event.target.value);
            setError('');
          }}
        />
      </Field>

      <Field label="Предмет" htmlFor="note-subject" optional className={styles.subjectField}>
        <Dropdown
          id="note-subject"
          value={values.subjectId}
          placeholder="Без предмета"
          options={subjectOptions}
          onChange={(value) => update('subjectId', value)}
        />
      </Field>

      <Field label="Содержание" htmlFor="note-content" optional>
        <Textarea
          id="note-content"
          rows={14}
          className={styles.content}
          value={values.content}
          placeholder="Запишите всё, что стоит запомнить — обычный текст или заметки в markdown-стиле."
          onChange={(event) => update('content', event.target.value)}
        />
      </Field>
    </Form>
  );
}
