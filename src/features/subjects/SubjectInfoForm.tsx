import { useState, type FormEvent } from 'react';
import { Dropdown, type DropdownOption } from '../../components/ui/Dropdown';
import { Field } from '../../components/ui/Field';
import { Form } from '../../components/ui/Form';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import type { SubjectInfoCategory } from '../../types/models';
import styles from './SubjectInfoForm.module.css';

export interface SubjectInfoFormValues {
  title: string;
  category: SubjectInfoCategory;
  content: string;
}

const CATEGORY_OPTIONS: DropdownOption[] = [
  { value: 'description', label: 'Описание' },
  { value: 'rules', label: 'Правила' },
  { value: 'links', label: 'Ссылки' },
  { value: 'other', label: 'Другое' },
];

interface SubjectInfoFormProps {
  id: string;
  initialValues: SubjectInfoFormValues;
  onSubmit: (values: SubjectInfoFormValues) => void;
}

/** Правки контента, синхронизированного с GitHub — сам файл в репозитории они не меняют. */
export function SubjectInfoForm({ id, initialValues, onSubmit }: SubjectInfoFormProps) {
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState('');

  function update<K extends keyof SubjectInfoFormValues>(key: K, value: SubjectInfoFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!values.title.trim()) {
      setError('Укажите название.');
      return;
    }
    onSubmit(values);
  }

  return (
    <Form id={id} onSubmit={handleSubmit}>
      <Field label="Название" htmlFor="subject-info-title" error={error}>
        <Input
          id="subject-info-title"
          value={values.title}
          invalid={Boolean(error)}
          onChange={(event) => {
            update('title', event.target.value);
            setError('');
          }}
        />
      </Field>

      <Field label="Категория" htmlFor="subject-info-category">
        <Dropdown
          id="subject-info-category"
          value={values.category}
          options={CATEGORY_OPTIONS}
          onChange={(value) => update('category', value as SubjectInfoCategory)}
        />
      </Field>

      <Field label="Содержание" htmlFor="subject-info-content" optional>
        <Textarea
          id="subject-info-content"
          rows={16}
          className={styles.content}
          value={values.content}
          onChange={(event) => update('content', event.target.value)}
        />
      </Field>
    </Form>
  );
}
