import { Archive, ArrowDownUp, Ellipsis, Pencil } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import { Dropdown, type DropdownOption } from '../../components/ui/Dropdown';
import { DropdownItem, DropdownLabel, DropdownMenu, DropdownSeparator } from '../../components/ui/DropdownMenu';
import { Field } from '../../components/ui/Field';
import { Form, FormRow } from '../../components/ui/Form';
import { IconButton } from '../../components/ui/IconButton';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Section } from '../../components/ui/Section';
import { Demo } from './Demo';

type Sort = 'deadline' | 'priority' | 'title';

const SORT_LABELS: Record<Sort, string> = {
  deadline: 'Сроку',
  priority: 'Приоритету',
  title: 'Названию',
};

const SUBJECT_OPTIONS: DropdownOption[] = [
  { value: 'programming', label: 'Программирование' },
  { value: 'mathematics', label: 'Математика' },
  { value: 'physics', label: 'Физика' },
];

const FORM_ID = 'demo-class-form';

/** Выпадающие меню и модальное окно. */
export function OverlaysDemo() {
  const [sort, setSort] = useState<Sort>('deadline');
  const [isModalOpen, setModalOpen] = useState(false);
  const [demoSubject, setDemoSubject] = useState('programming');

  const closeModal = () => setModalOpen(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    closeModal();
  }

  return (
    <Section title="Всплывающие элементы">
      <Demo label="Выпадающее меню">
        <DropdownMenu
          trigger={(props) => (
            <Button icon={ArrowDownUp} {...props}>
              По {SORT_LABELS[sort].toLowerCase()}
            </Button>
          )}
        >
          <DropdownLabel>Сортировка</DropdownLabel>
          {(Object.keys(SORT_LABELS) as Sort[]).map((value) => (
            <DropdownItem key={value} checked={sort === value} onSelect={() => setSort(value)}>
              {SORT_LABELS[value]}
            </DropdownItem>
          ))}
        </DropdownMenu>

        <DropdownMenu trigger={(props) => <IconButton icon={Ellipsis} label="Другие действия" {...props} />}>
          <DropdownItem icon={Pencil} onSelect={() => {}}>
            Изменить
          </DropdownItem>
          <DropdownSeparator />
          <DropdownItem icon={Archive} onSelect={() => {}}>
            В архив
          </DropdownItem>
        </DropdownMenu>
      </Demo>

      <Demo label="Модальное окно">
        <Button onClick={() => setModalOpen(true)}>Открыть окно</Button>

        <Modal
          open={isModalOpen}
          onClose={closeModal}
          title="Добавить пару"
          description="Добавить пару в еженедельное расписание."
          footer={
            <>
              <Button variant="ghost" onClick={closeModal}>
                Отмена
              </Button>
              <Button variant="primary" type="submit" form={FORM_ID}>
                Сохранить
              </Button>
            </>
          }
        >
          <Form id={FORM_ID} onSubmit={handleSubmit}>
            <Field label="Предмет" htmlFor="demo-class-subject">
              <Dropdown id="demo-class-subject" options={SUBJECT_OPTIONS} value={demoSubject} onChange={setDemoSubject} />
            </Field>
            <FormRow>
              <Field label="Начало" htmlFor="demo-class-start">
                <Input id="demo-class-start" type="time" defaultValue="10:00" />
              </Field>
              <Field label="Окончание" htmlFor="demo-class-end">
                <Input id="demo-class-end" type="time" defaultValue="11:30" />
              </Field>
            </FormRow>
            <Field label="Аудитория" htmlFor="demo-class-room" optional>
              <Input id="demo-class-room" placeholder="например, 1405" />
            </Field>
            <Checkbox label="Повторять каждую неделю" defaultChecked />
          </Form>
        </Modal>
      </Demo>
    </Section>
  );
}
