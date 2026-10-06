import { useState, type FormEvent } from 'react';
import { Field } from '../../components/ui/Field';
import { Form } from '../../components/ui/Form';
import { Input } from '../../components/ui/Input';
import type { SubjectContact } from '../../types/models';
import { SubjectContactsField } from './SubjectContactsField';
import type { SubjectDraft } from './subjectsStore';

export interface SubjectFormValues {
  name: string;
  teacherPrimary: string;
  telegramChatUrl: string;
  contacts: SubjectContact[];
}

interface SubjectFormProps {
  id: string;
  initialValues: SubjectFormValues;
  onSubmit: (draft: SubjectDraft) => void;
}

/** Поля предмета: создание и редактирование используют одну и ту же форму. */
export function SubjectForm({ id, initialValues, onSubmit }: SubjectFormProps) {
  const [name, setName] = useState(initialValues.name);
  const [teacherPrimary, setTeacherPrimary] = useState(initialValues.teacherPrimary);
  const [telegramChatUrl, setTelegramChatUrl] = useState(initialValues.telegramChatUrl);
  const [contacts, setContacts] = useState(initialValues.contacts);
  const [error, setError] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setError('Укажите название предмета.');
      return;
    }
    // Пустые строки контактов (добавили и передумали) не сохраняем
    const cleanContacts = contacts
      .map((contact) => ({ ...contact, teacherName: contact.teacherName.trim() }))
      .filter((contact) => contact.teacherName);

    onSubmit({
      name: name.trim(),
      teacherPrimary: teacherPrimary.trim() || undefined,
      telegramChatUrl: telegramChatUrl.trim() || undefined,
      contacts: cleanContacts,
    });
  }

  return (
    <Form id={id} onSubmit={handleSubmit}>
      <Field label="Название" htmlFor="subject-name" error={error}>
        <Input
          id="subject-name"
          value={name}
          placeholder="например, линейная алгебра"
          invalid={Boolean(error)}
          onChange={(event) => {
            setName(event.target.value);
            setError('');
          }}
        />
      </Field>
      <Field
        label="Основной преподаватель"
        htmlFor="subject-teacher"
        optional
        hint="Для списка предметов. Если в расписании уже есть занятия, контакты по ролям вычисляются из него автоматически."
      >
        <Input
          id="subject-teacher"
          value={teacherPrimary}
          placeholder="например, Иванов И. И."
          onChange={(event) => setTeacherPrimary(event.target.value)}
        />
      </Field>
      <Field label="Ссылка на Telegram-чат" htmlFor="subject-telegram-chat" optional>
        <Input
          id="subject-telegram-chat"
          value={telegramChatUrl}
          placeholder="например, https://t.me/group_chat"
          onChange={(event) => setTelegramChatUrl(event.target.value)}
        />
      </Field>
      <Field label="Контакты" optional>
        <SubjectContactsField contacts={contacts} onChange={setContacts} />
      </Field>
    </Form>
  );
}
