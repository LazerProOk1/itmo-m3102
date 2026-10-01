import { useState, type FormEvent } from 'react';
import { Dropdown, type DropdownOption } from '../../components/ui/Dropdown';
import { Field } from '../../components/ui/Field';
import { Form, FormRow } from '../../components/ui/Form';
import { Input } from '../../components/ui/Input';
import type { LectureNoteContentType } from '../../types/models';
import { useSubjectsStore } from '../subjects/subjectsStore';
import { LectureNoteContentEditor } from './LectureNoteContentEditor';
import { LectureNoteContentView } from './LectureNoteContentView';

export interface LectureNoteFormValues {
  subjectId: string;
  lectureNumber: string;
  title: string;
  contentType: LectureNoteContentType;
  content: string;
}

interface LectureNoteFormProps {
  id: string;
  initialValues: LectureNoteFormValues;
  onSubmit: (values: LectureNoteFormValues) => void;
  /** Только просмотр — все поля отключены, содержание рендерится, а не показывается как отключённое поле формы */
  disabled?: boolean;
  /** source_ref редактируемого конспекта — для резолва относительных ссылок [[...]] в просмотре */
  sourceRef?: string;
}

/** Поля конспекта: предмет, номер лекции, название, содержание — как в заметках, но привязано к занятию. */
export function LectureNoteForm({ id, initialValues, onSubmit, disabled, sourceRef }: LectureNoteFormProps) {
  const subjects = useSubjectsStore((state) => state.subjects);
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<{ subjectId?: string; title?: string }>({});

  const subjectOptions: DropdownOption[] = subjects.map((subject) => ({ value: subject.id, label: subject.name }));

  function update<K extends keyof LectureNoteFormValues>(key: K, value: LectureNoteFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = {
      subjectId: values.subjectId ? undefined : 'Выберите предмет.',
      title: values.title.trim() ? undefined : 'Укажите название конспекта.',
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    onSubmit(values);
  }

  return (
    <Form id={id} onSubmit={handleSubmit} disabled={disabled}>
      <FormRow>
        <Field label="Предмет" htmlFor="lecture-note-subject" error={errors.subjectId}>
          <Dropdown
            id="lecture-note-subject"
            value={values.subjectId}
            placeholder="Выберите предмет"
            invalid={Boolean(errors.subjectId)}
            options={subjectOptions}
            onChange={(value) => {
              update('subjectId', value);
              setErrors((current) => ({ ...current, subjectId: undefined }));
            }}
          />
        </Field>
        <Field label="Номер лекции" htmlFor="lecture-note-number" optional>
          <Input
            id="lecture-note-number"
            value={values.lectureNumber}
            placeholder="например, Лекция 1"
            onChange={(event) => update('lectureNumber', event.target.value)}
          />
        </Field>
      </FormRow>

      <Field label="Название" htmlFor="lecture-note-title" error={errors.title}>
        <Input
          id="lecture-note-title"
          value={values.title}
          placeholder="например, Системы контроля версий"
          invalid={Boolean(errors.title)}
          onChange={(event) => {
            update('title', event.target.value);
            setErrors((current) => ({ ...current, title: undefined }));
          }}
        />
      </Field>

      {disabled ? (
        <LectureNoteContentView contentType={values.contentType} content={values.content} sourceRef={sourceRef} />
      ) : (
        <LectureNoteContentEditor
          contentType={values.contentType}
          content={values.content}
          onContentTypeChange={(contentType) => update('contentType', contentType)}
          onContentChange={(content) => update('content', content)}
        />
      )}
    </Form>
  );
}
