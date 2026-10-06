import { Plus, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Dropdown } from '../../components/ui/Dropdown';
import { FormRow } from '../../components/ui/Form';
import { IconButton } from '../../components/ui/IconButton';
import { Input } from '../../components/ui/Input';
import type { ClassType, SubjectContact } from '../../types/models';
import { CLASS_TYPE_OPTIONS } from '../schedule/labels';
import styles from './SubjectContactsField.module.css';

interface SubjectContactsFieldProps {
  contacts: SubjectContact[];
  onChange: (contacts: SubjectContact[]) => void;
}

const EMPTY_CONTACT: SubjectContact = { role: 'lecture', teacherName: '', email: '', telegram: '' };

/** Редактируемый список контактов предмета: роль, преподаватель, email/telegram. */
export function SubjectContactsField({ contacts, onChange }: SubjectContactsFieldProps) {
  function update<K extends keyof SubjectContact>(index: number, key: K, value: SubjectContact[K]) {
    onChange(contacts.map((contact, i) => (i === index ? { ...contact, [key]: value } : contact)));
  }

  function remove(index: number) {
    onChange(contacts.filter((_, i) => i !== index));
  }

  function add() {
    onChange([...contacts, { ...EMPTY_CONTACT }]);
  }

  return (
    <div className={styles.wrapper}>
      {contacts.map((contact, index) => (
        <div key={index} className={styles.contact}>
          <div className={styles.contactHeader}>
            <div className={styles.roleField}>
              <Dropdown
                options={CLASS_TYPE_OPTIONS}
                value={contact.role}
                onChange={(value) => update(index, 'role', value as ClassType)}
                aria-label="Роль"
              />
            </div>
            <Input
              value={contact.teacherName}
              placeholder="Преподаватель"
              aria-label="Преподаватель"
              onChange={(event) => update(index, 'teacherName', event.target.value)}
            />
            <IconButton icon={X} label="Удалить контакт" size="sm" onClick={() => remove(index)} />
          </div>
          <FormRow>
            <Input
              type="email"
              value={contact.email ?? ''}
              placeholder="Email (необязательно)"
              aria-label="Email"
              onChange={(event) => update(index, 'email', event.target.value)}
            />
            <Input
              value={contact.telegram ?? ''}
              placeholder="Telegram (необязательно)"
              aria-label="Telegram"
              onChange={(event) => update(index, 'telegram', event.target.value)}
            />
          </FormRow>
        </div>
      ))}

      <Button type="button" variant="secondary" size="sm" icon={Plus} onClick={add}>
        Добавить контакт
      </Button>
    </div>
  );
}
