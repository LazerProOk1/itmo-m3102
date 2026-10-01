import { useState, type FormEvent } from 'react';
import { Field } from '../../components/ui/Field';
import { Form, FormRow } from '../../components/ui/Form';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';

export interface EventFormValues {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  description: string;
}

interface EventFormProps {
  id: string;
  initialValues: EventFormValues;
  onSubmit: (values: EventFormValues) => void;
  /** Только просмотр — все поля отключены, без кнопки сохранения */
  disabled?: boolean;
}

type FormErrors = Partial<Record<'title' | 'date' | 'time', string>>;

/** Без времени начала и конца событие считается «весь день». */
function checkEventTimes(startTime: string, endTime: string): string | undefined {
  if (!startTime && !endTime) return undefined;
  if (!startTime || !endTime) return 'Укажите оба времени или оставьте оба поля пустыми — для события на весь день.';
  if (endTime <= startTime) return 'Время окончания должно быть позже времени начала.';
  return undefined;
}

/** Поля обычного события: Title, Date, Start time, End time, Description. */
export function EventForm({ id, initialValues, onSubmit, disabled }: EventFormProps) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});

  function update<K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: FormErrors = {
      title: values.title.trim() ? undefined : 'Укажите название события.',
      date: values.date ? undefined : 'Выберите дату.',
      time: checkEventTimes(values.startTime, values.endTime),
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    onSubmit(values);
  }

  return (
    <Form id={id} onSubmit={handleSubmit} disabled={disabled}>
      <Field label="Название" htmlFor="event-title" error={errors.title}>
        <Input
          id="event-title"
          value={values.title}
          placeholder="например, встреча со старостой"
          invalid={Boolean(errors.title)}
          onChange={(event) => update('title', event.target.value)}
        />
      </Field>

      <Field label="Дата" htmlFor="event-date" error={errors.date}>
        <Input
          id="event-date"
          type="date"
          value={values.date}
          invalid={Boolean(errors.date)}
          onChange={(event) => update('date', event.target.value)}
        />
      </Field>

      <FormRow>
        <Field label="Начало" htmlFor="event-start" optional hint="Оставьте оба времени пустыми для события на весь день." error={errors.time}>
          <Input
            id="event-start"
            type="time"
            value={values.startTime}
            invalid={Boolean(errors.time)}
            onChange={(event) => update('startTime', event.target.value)}
          />
        </Field>
        <Field label="Окончание" htmlFor="event-end" optional>
          <Input
            id="event-end"
            type="time"
            value={values.endTime}
            invalid={Boolean(errors.time)}
            onChange={(event) => update('endTime', event.target.value)}
          />
        </Field>
      </FormRow>

      <Field label="Описание" htmlFor="event-description" optional>
        <Textarea
          id="event-description"
          rows={3}
          value={values.description}
          placeholder="Детали, которые стоит запомнить…"
          onChange={(event) => update('description', event.target.value)}
        />
      </Field>
    </Form>
  );
}
