import { useState, type FormEvent } from 'react';
import { Dropdown, type DropdownOption } from '../../components/ui/Dropdown';
import { Field } from '../../components/ui/Field';
import { Form, FormRow } from '../../components/ui/Form';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import type { TaskPriority, TaskStatus, TaskType } from '../../types/models';
import { useSubjectsStore } from '../subjects/subjectsStore';
import { LinksField } from './LinksField';
import { PRIORITIES, STATUSES, TASK_TYPE_LABELS } from './labels';

const TYPE_OPTIONS: DropdownOption[] = Object.entries(TASK_TYPE_LABELS).map(([value, label]) => ({ value, label }));

const PRIORITY_OPTIONS: DropdownOption[] = (['low', 'normal', 'high', 'critical'] as TaskPriority[]).map((value) => ({
  value,
  label: PRIORITIES[value].label,
}));

const STATUS_OPTIONS: DropdownOption[] = (['todo', 'in_progress', 'done'] as TaskStatus[]).map((value) => ({
  value,
  label: STATUSES[value].label,
}));

export interface TaskFormValues {
  title: string;
  subjectId: string;
  type: TaskType;
  deadline: string;
  priority: TaskPriority;
  status: TaskStatus;
  description: string;
  links: string[];
}

interface TaskFormProps {
  /** id формы — чтобы кнопка «Save» в подвале окна могла её отправить */
  id: string;
  initialValues: TaskFormValues;
  onSubmit: (values: TaskFormValues) => void;
  /** Только просмотр — все поля отключены, без кнопки сохранения */
  disabled?: boolean;
}

/** Поля задачи: создание, редактирование и просмотр используют одну и ту же форму. */
export function TaskForm({ id, initialValues, onSubmit, disabled }: TaskFormProps) {
  const subjects = useSubjectsStore((state) => state.subjects);
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState('');

  const subjectOptions: DropdownOption[] = subjects.map((subject) => ({ value: subject.id, label: subject.name }));

  function update<K extends keyof TaskFormValues>(key: K, value: TaskFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!values.title.trim()) {
      setError('Укажите название задачи.');
      return;
    }
    onSubmit(values);
  }

  return (
    <Form id={id} onSubmit={handleSubmit} disabled={disabled}>
      <Field label="Название" htmlFor="task-title" error={error}>
        <Input
          id="task-title"
          value={values.title}
          placeholder="например, доделать отчёт по лабораторной"
          invalid={Boolean(error)}
          onChange={(event) => {
            update('title', event.target.value);
            setError('');
          }}
        />
      </Field>

      <FormRow>
        <Field label="Предмет" htmlFor="task-subject" optional>
          <Dropdown
            id="task-subject"
            value={values.subjectId}
            placeholder="Без предмета"
            options={subjectOptions}
            onChange={(value) => update('subjectId', value)}
          />
        </Field>
        <Field label="Тип" htmlFor="task-type">
          <Dropdown
            id="task-type"
            value={values.type}
            options={TYPE_OPTIONS}
            onChange={(value) => update('type', value as TaskType)}
          />
        </Field>
      </FormRow>

      <FormRow>
        <Field label="Срок" htmlFor="task-deadline" optional>
          <Input
            id="task-deadline"
            type="date"
            value={values.deadline}
            onChange={(event) => update('deadline', event.target.value)}
          />
        </Field>
        <Field label="Приоритет" htmlFor="task-priority">
          <Dropdown
            id="task-priority"
            value={values.priority}
            options={PRIORITY_OPTIONS}
            onChange={(value) => update('priority', value as TaskPriority)}
          />
        </Field>
      </FormRow>

      <Field label="Статус" htmlFor="task-status">
        <Dropdown
          id="task-status"
          value={values.status}
          options={STATUS_OPTIONS}
          onChange={(value) => update('status', value as TaskStatus)}
        />
      </Field>

      <Field label="Описание" htmlFor="task-description" optional>
        <Textarea
          id="task-description"
          rows={3}
          value={values.description}
          placeholder="Детали, которые стоит запомнить…"
          onChange={(event) => update('description', event.target.value)}
        />
      </Field>

      <Field label="Ссылки" optional>
        <LinksField links={values.links} onChange={(links) => update('links', links)} />
      </Field>
    </Form>
  );
}
