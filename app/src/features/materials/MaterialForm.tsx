import { HardDrive } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '../../components/ui/Button';
import { Dropdown, type DropdownOption } from '../../components/ui/Dropdown';
import { Field } from '../../components/ui/Field';
import { Form, FormRow } from '../../components/ui/Form';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { checkUrl } from '../../lib/url';
import { googleDriveService } from '../../services/googleDrive';
import type { ID, MaterialCategory, MaterialType } from '../../types/models';
import { useSubjectsStore } from '../subjects/subjectsStore';
import { GOOGLE_MATERIAL_TYPES, MATERIAL_CATEGORIES, MATERIAL_TYPES } from './labels';
import styles from './MaterialForm.module.css';

const TYPE_OPTIONS: DropdownOption[] = Object.entries(MATERIAL_TYPES).map(([value, { label }]) => ({ value, label }));
const CATEGORY_OPTIONS: DropdownOption[] = Object.entries(MATERIAL_CATEGORIES).map(([value, label]) => ({
  value,
  label,
}));

export interface MaterialFormValues {
  name: string;
  subjectId: string;
  category: MaterialCategory;
  type: MaterialType;
  url: string;
  description: string;
}

interface MaterialFormProps {
  id: string;
  initialValues: MaterialFormValues;
  onSubmit: (values: MaterialFormValues) => void;
  /** Только просмотр — все поля отключены, без кнопки сохранения */
  disabled?: boolean;
}

/** Поля материала: Name, Subject, Type, URL, Description. */
export function MaterialForm({ id, initialValues, onSubmit, disabled }: MaterialFormProps) {
  const subjects = useSubjectsStore((state) => state.subjects);
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<{ name?: string; url?: string }>({});
  const [driveNotice, setDriveNotice] = useState('');

  const subjectOptions: DropdownOption[] = subjects.map((subject) => ({ value: subject.id, label: subject.name }));
  const isGoogleType = GOOGLE_MATERIAL_TYPES.includes(values.type);

  function update<K extends keyof MaterialFormValues>(key: K, value: MaterialFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function handlePickFromDrive() {
    setDriveNotice('');
    try {
      const result = await googleDriveService.pickFile();
      if (!result) return; // пользователь отменил выбор
      update('url', result.file.url);
      if (!values.name.trim()) update('name', result.file.name);
    } catch {
      // Сегодня сервис — заглушка без настоящего Google Drive: сообщаем и оставляем ручной ввод ссылки
      setDriveNotice('Google Drive пока не подключён — вставьте ссылку вручную.');
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = {
      name: values.name.trim() ? undefined : 'Укажите название материала.',
      url: values.url.trim() ? checkUrl(values.url) : 'Добавьте ссылку на файл или страницу.',
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    onSubmit(values);
  }

  return (
    <Form id={id} onSubmit={handleSubmit} disabled={disabled}>
      <Field label="Название" htmlFor="material-name" error={errors.name}>
        <Input
          id="material-name"
          value={values.name}
          placeholder="например, Лекция_3.pdf"
          invalid={Boolean(errors.name)}
          onChange={(event) => update('name', event.target.value)}
        />
      </Field>

      <Field label="Предмет" htmlFor="material-subject" optional>
        <Dropdown
          id="material-subject"
          value={values.subjectId}
          placeholder="Без предмета"
          options={subjectOptions}
          onChange={(value) => update('subjectId', value as ID)}
        />
      </Field>

      <FormRow>
        <Field label="Тип" htmlFor="material-type">
          <Dropdown
            id="material-type"
            value={values.type}
            options={TYPE_OPTIONS}
            onChange={(value) => {
              update('type', value as MaterialType);
              setDriveNotice('');
            }}
          />
        </Field>
        <Field label="Категория" htmlFor="material-category">
          <Dropdown
            id="material-category"
            value={values.category}
            options={CATEGORY_OPTIONS}
            onChange={(value) => update('category', value as MaterialCategory)}
          />
        </Field>
      </FormRow>

      <Field label="URL" htmlFor="material-url" error={errors.url} hint={driveNotice || undefined}>
        <div className={styles.urlRow}>
          <Input
            id="material-url"
            type="url"
            value={values.url}
            placeholder="https://"
            invalid={Boolean(errors.url)}
            onChange={(event) => {
              update('url', event.target.value);
              setErrors((current) => ({ ...current, url: undefined }));
            }}
          />
          {isGoogleType && (
            <Button type="button" size="sm" icon={HardDrive} onClick={handlePickFromDrive}>
              Выбрать из Drive
            </Button>
          )}
        </div>
      </Field>

      <Field label="Описание" htmlFor="material-description" optional>
        <Textarea
          id="material-description"
          rows={3}
          value={values.description}
          placeholder="Что это и почему это важно…"
          onChange={(event) => update('description', event.target.value)}
        />
      </Field>
    </Form>
  );
}
