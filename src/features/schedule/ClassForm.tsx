import { useState, type FormEvent } from 'react';
import { Dropdown } from '../../components/ui/Dropdown';
import { Field } from '../../components/ui/Field';
import { Form, FormRow } from '../../components/ui/Form';
import { Input } from '../../components/ui/Input';
import { SegmentedControl, type SegmentedOption } from '../../components/ui/SegmentedControl';
import { Textarea } from '../../components/ui/Textarea';
import { checkUrl } from '../../lib/url';
import type { ClassType, ISODate, Weekday } from '../../types/models';
import { useSubjectsStore } from '../subjects/subjectsStore';
import { CLASS_TYPE_OPTIONS, WEEKDAY_OPTIONS } from './labels';
import { checkTimeRange } from './validation';

/**
 * Повторение: каждую неделю, только по нечётным ('1') или чётным ('2') неделям, или один раз.
 * '1'|'2' строками — SegmentedControl работает только со строковыми значениями;
 * в WeekRepeat (число) конвертируется в ClassDialog при сохранении.
 */
export type RepeatOption = 'every' | '1' | '2' | 'once';

export interface ClassFormValues {
  subjectId: string;
  repeat: RepeatOption;
  /** Для повторяющегося занятия */
  weekday: Weekday;
  /** Для разового занятия */
  date: ISODate;
  startTime: string;
  endTime: string;
  type: ClassType;
  room: string;
  building: string;
  teacher: string;
  subgroup: string;
  link: string;
  notes: string;
}

type FormErrors = Partial<Record<'subjectId' | 'date' | 'time' | 'teacher' | 'link', string>>;

interface ClassFormProps {
  id: string;
  initialValues: ClassFormValues;
  /** Какие варианты повторения можно выбрать. Пустой список — поле скрыто. */
  repeatOptions: SegmentedOption<RepeatOption>[];
  onSubmit: (values: ClassFormValues) => void;
  /** Только просмотр — все поля отключены, без кнопки сохранения */
  disabled?: boolean;
}

/** Поля занятия. Используется для создания, редактирования и просмотра. */
export function ClassForm({ id, initialValues, repeatOptions, onSubmit, disabled }: ClassFormProps) {
  const subjects = useSubjectsStore((state) => state.subjects);
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});

  const subjectOptions = subjects.map((subject) => ({ value: subject.id, label: subject.name }));

  function update<K extends keyof ClassFormValues>(key: K, value: ClassFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: FormErrors = {
      subjectId: values.subjectId ? undefined : 'Выберите предмет.',
      date: values.repeat === 'once' && !values.date ? 'Выберите дату.' : undefined,
      time: checkTimeRange(values.startTime, values.endTime),
      teacher: values.teacher.trim() ? undefined : 'Укажите преподавателя.',
      link: checkUrl(values.link),
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    onSubmit(values);
  }

  return (
    <Form id={id} onSubmit={handleSubmit} disabled={disabled}>
      <Field label="Предмет" htmlFor="class-subject" error={errors.subjectId}>
        <Dropdown
          id="class-subject"
          value={values.subjectId}
          placeholder="Выберите предмет"
          options={subjectOptions}
          invalid={Boolean(errors.subjectId)}
          onChange={(value) => update('subjectId', value)}
        />
      </Field>

      {repeatOptions.length > 0 && (
        <Field label="Повторение" hint="Нечётная/чётная — занятие только по таким неделям.">
          <SegmentedControl
            label="Повторение"
            options={repeatOptions}
            value={values.repeat}
            onChange={(value) => update('repeat', value)}
          />
        </Field>
      )}

      <FormRow>
        {values.repeat === 'once' ? (
          <Field label="Дата" htmlFor="class-date" error={errors.date}>
            <Input
              id="class-date"
              type="date"
              value={values.date}
              invalid={Boolean(errors.date)}
              onChange={(event) => update('date', event.target.value)}
            />
          </Field>
        ) : (
          <Field label="День" htmlFor="class-day">
            <Dropdown
              id="class-day"
              value={String(values.weekday)}
              options={WEEKDAY_OPTIONS}
              onChange={(value) => update('weekday', Number(value) as Weekday)}
            />
          </Field>
        )}
        <Field label="Тип" htmlFor="class-type">
          <Dropdown
            id="class-type"
            value={values.type}
            options={CLASS_TYPE_OPTIONS}
            onChange={(value) => update('type', value as ClassType)}
          />
        </Field>
      </FormRow>

      <FormRow>
        <Field label="Начало" htmlFor="class-start" error={errors.time}>
          <Input
            id="class-start"
            type="time"
            value={values.startTime}
            invalid={Boolean(errors.time)}
            onChange={(event) => update('startTime', event.target.value)}
          />
        </Field>
        <Field label="Окончание" htmlFor="class-end">
          <Input
            id="class-end"
            type="time"
            value={values.endTime}
            invalid={Boolean(errors.time)}
            onChange={(event) => update('endTime', event.target.value)}
          />
        </Field>
      </FormRow>

      <FormRow>
        <Field label="Аудитория" htmlFor="class-room" optional>
          <Input
            id="class-room"
            value={values.room}
            placeholder="например, 1405"
            onChange={(event) => update('room', event.target.value)}
          />
        </Field>
        <Field label="Корпус / адрес" htmlFor="class-building" optional>
          <Input
            id="class-building"
            value={values.building}
            placeholder="например, Кронверкский пр., д.49"
            onChange={(event) => update('building', event.target.value)}
          />
        </Field>
      </FormRow>

      <FormRow>
        <Field label="Преподаватель" htmlFor="class-teacher" error={errors.teacher}>
          <Input
            id="class-teacher"
            value={values.teacher}
            placeholder="например, Иванов И. И."
            invalid={Boolean(errors.teacher)}
            onChange={(event) => {
              update('teacher', event.target.value);
              setErrors((current) => ({ ...current, teacher: undefined }));
            }}
          />
        </Field>
        <Field label="Подгруппа" htmlFor="class-subgroup" optional>
          <Input
            id="class-subgroup"
            value={values.subgroup}
            placeholder="например, Лин.Алг. 1.2"
            onChange={(event) => update('subgroup', event.target.value)}
          />
        </Field>
      </FormRow>

      <Field label="Ссылка" htmlFor="class-link" optional error={errors.link}>
        <Input
          id="class-link"
          type="url"
          value={values.link}
          placeholder="https://"
          invalid={Boolean(errors.link)}
          onChange={(event) => update('link', event.target.value)}
        />
      </Field>

      <Field label="Заметки" htmlFor="class-notes" optional>
        <Textarea
          id="class-notes"
          rows={3}
          value={values.notes}
          placeholder="Что-нибудь на память…"
          onChange={(event) => update('notes', event.target.value)}
        />
      </Field>
    </Form>
  );
}
