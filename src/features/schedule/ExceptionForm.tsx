import { useState, type FormEvent } from 'react';
import { Dropdown } from '../../components/ui/Dropdown';
import { Field } from '../../components/ui/Field';
import { Form, FormRow } from '../../components/ui/Form';
import { Input } from '../../components/ui/Input';
import type { ClassType, ISODate } from '../../types/models';
import { useSubjectsStore } from '../subjects/subjectsStore';
import { CLASS_TYPE_OPTIONS } from './labels';
import { checkTimeRange } from './validation';

export interface ExceptionFormValues {
  /** Только для переноса */
  newDate: ISODate;
  /** Только для замены */
  subjectId: string;
  type: ClassType;
  startTime: string;
  endTime: string;
  room: string;
  teacher: string;
  note: string;
}

type FormErrors = Partial<Record<'newDate' | 'subjectId' | 'time' | 'teacher', string>>;

interface ExceptionFormProps {
  id: string;
  kind: 'moved' | 'replaced';
  initialValues: ExceptionFormValues;
  onSubmit: (values: ExceptionFormValues) => void;
  /** Только просмотр — все поля отключены, без кнопки сохранения */
  disabled?: boolean;
}

/** Поля переноса или замены занятия. */
export function ExceptionForm({ id, kind, initialValues, onSubmit, disabled }: ExceptionFormProps) {
  const subjects = useSubjectsStore((state) => state.subjects);
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});

  const subjectOptions = subjects.map((subject) => ({ value: subject.id, label: subject.name }));

  function update<K extends keyof ExceptionFormValues>(key: K, value: ExceptionFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: FormErrors = {
      newDate: kind === 'moved' && !values.newDate ? 'Выберите дату.' : undefined,
      subjectId: kind === 'replaced' && !values.subjectId ? 'Выберите предмет.' : undefined,
      time: checkTimeRange(values.startTime, values.endTime),
      teacher: kind === 'replaced' && !values.teacher.trim() ? 'Укажите преподавателя.' : undefined,
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    onSubmit(values);
  }

  return (
    <Form id={id} onSubmit={handleSubmit} disabled={disabled}>
      {kind === 'moved' ? (
        <Field label="Новая дата" htmlFor="exception-date" error={errors.newDate}>
          <Input
            id="exception-date"
            type="date"
            value={values.newDate}
            invalid={Boolean(errors.newDate)}
            onChange={(event) => update('newDate', event.target.value)}
          />
        </Field>
      ) : (
        <FormRow>
          <Field label="Предмет" htmlFor="exception-subject" error={errors.subjectId}>
            <Dropdown
              id="exception-subject"
              value={values.subjectId}
              placeholder="Выберите предмет"
              options={subjectOptions}
              invalid={Boolean(errors.subjectId)}
              onChange={(value) => update('subjectId', value)}
            />
          </Field>
          <Field label="Тип" htmlFor="exception-type">
            <Dropdown id="exception-type" value={values.type} options={CLASS_TYPE_OPTIONS} onChange={(value) => update('type', value as ClassType)} />
          </Field>
        </FormRow>
      )}

      <FormRow>
        <Field label="Начало" htmlFor="exception-start" error={errors.time}>
          <Input
            id="exception-start"
            type="time"
            value={values.startTime}
            invalid={Boolean(errors.time)}
            onChange={(event) => update('startTime', event.target.value)}
          />
        </Field>
        <Field label="Окончание" htmlFor="exception-end">
          <Input
            id="exception-end"
            type="time"
            value={values.endTime}
            invalid={Boolean(errors.time)}
            onChange={(event) => update('endTime', event.target.value)}
          />
        </Field>
      </FormRow>

      <FormRow>
        <Field label="Аудитория" htmlFor="exception-room" optional>
          <Input id="exception-room" value={values.room} placeholder="например, 1405" onChange={(event) => update('room', event.target.value)} />
        </Field>
        <Field
          label={kind === 'replaced' ? 'Преподаватель' : 'Преподаватель (если сменился)'}
          htmlFor="exception-teacher"
          optional={kind === 'moved'}
          error={errors.teacher}
        >
          <Input
            id="exception-teacher"
            value={values.teacher}
            placeholder="например, Петров П. П."
            invalid={Boolean(errors.teacher)}
            onChange={(event) => {
              update('teacher', event.target.value);
              setErrors((current) => ({ ...current, teacher: undefined }));
            }}
          />
        </Field>
      </FormRow>

      <Field label="Заметка" htmlFor="exception-note" optional>
        <Input
          id="exception-note"
          value={values.note}
          placeholder="например, преподаватель отсутствует"
          onChange={(event) => update('note', event.target.value)}
        />
      </Field>
    </Form>
  );
}
