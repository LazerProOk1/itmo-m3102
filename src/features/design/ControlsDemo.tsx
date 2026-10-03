import { Download, Pencil, Plus, Search, Settings } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import { Dropdown, type DropdownOption } from '../../components/ui/Dropdown';
import { Field } from '../../components/ui/Field';
import { IconButton } from '../../components/ui/IconButton';
import { Input } from '../../components/ui/Input';
import { Section } from '../../components/ui/Section';
import { SegmentedControl, type SegmentedOption } from '../../components/ui/SegmentedControl';
import { Tabs, type TabItem } from '../../components/ui/Tabs';
import { Textarea } from '../../components/ui/Textarea';
import { DateInput } from '../../components/ui/DateInput';
import { Demo } from './Demo';
import styles from './DesignSystemPage.module.css';

type CalendarView = 'day' | 'week' | 'month';
type SubjectTab = 'overview' | 'tasks' | 'materials' | 'notes';

const VIEW_OPTIONS: SegmentedOption<CalendarView>[] = [
  { value: 'day', label: 'День' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
];

const SUBJECT_TABS: TabItem<SubjectTab>[] = [
  { value: 'overview', label: 'Обзор' },
  { value: 'tasks', label: 'Задачи', count: 3 },
  { value: 'materials', label: 'Материалы', count: 5 },
  { value: 'notes', label: 'Заметки' },
];

const SUBJECT_OPTIONS: DropdownOption[] = [
  { value: 'programming', label: 'Программирование' },
  { value: 'mathematics', label: 'Математика' },
  { value: 'physics', label: 'Физика' },
];

/** Кнопки, поля ввода и элементы выбора. */
export function ControlsDemo() {
  const [isRepeating, setRepeating] = useState(true);
  const [demoDate, setDemoDate] = useState('');
  const [view, setView] = useState<CalendarView>('week');
  const [subjectTab, setSubjectTab] = useState<SubjectTab>('overview');
  const [demoSubject, setDemoSubject] = useState('');

  return (
    <>
      <Section title="Кнопки">
        <Demo label="Варианты">
          <Button variant="primary">Основная</Button>
          <Button>Вторичная</Button>
          <Button variant="ghost">Без фона</Button>
        </Demo>
        <Demo label="С иконкой">
          <Button variant="primary" icon={Plus}>
            Новая задача
          </Button>
          <Button icon={Download}>Экспорт</Button>
          <Button variant="ghost" icon={Pencil}>
            Изменить
          </Button>
        </Demo>
        <Demo label="Размеры">
          <Button size="sm">Маленькая</Button>
          <Button>Средняя</Button>
          <IconButton icon={Settings} label="Настройки" size="sm" />
          <IconButton icon={Settings} label="Настройки" />
        </Demo>
        <Demo label="Состояния">
          <Button disabled>Недоступна</Button>
        </Demo>
      </Section>

      <Section title="Поля ввода">
        <Demo label="Текст">
          <Field label="Название" htmlFor="demo-title" className={styles.field}>
            <Input id="demo-title" placeholder="например, доделать отчёт по лабораторной" />
          </Field>
          <Field label="Поиск" htmlFor="demo-search" className={styles.field}>
            <Input id="demo-search" icon={Search} placeholder="Поиск материалов…" />
          </Field>
        </Demo>
        <Demo label="Выбор и дата">
          <Field label="Предмет" htmlFor="demo-subject" className={styles.field}>
            <Dropdown id="demo-subject" options={SUBJECT_OPTIONS} placeholder="Без предмета" value={demoSubject} onChange={setDemoSubject} />
          </Field>
          <Field label="Срок" htmlFor="demo-date" optional className={styles.field}>
            <DateInput id="demo-date" value={demoDate} onChange={setDemoDate} />
          </Field>
        </Demo>
        <Demo label="Подсказка и ошибка">
          <Field label="Ссылка" htmlFor="demo-link" hint="Вставьте ссылку на страницу курса." className={styles.field}>
            <Input id="demo-link" placeholder="https://" />
          </Field>
          <Field label="Аудитория" htmlFor="demo-room" error="Укажите аудиторию." className={styles.field}>
            <Input id="demo-room" invalid />
          </Field>
        </Demo>
        <Demo label="Многострочное поле">
          <Field label="Заметки" htmlFor="demo-notes" optional className={styles.wide}>
            <Textarea id="demo-notes" placeholder="Дополнительные заметки…" />
          </Field>
        </Demo>
        <Demo label="Недоступно">
          <Input className={styles.field} defaultValue="Только для чтения" disabled aria-label="Недоступное поле" />
        </Demo>
      </Section>

      <Section title="Выбор">
        <Demo label="Чекбокс">
          <Checkbox label="Повторять каждую неделю" checked={isRepeating} onChange={(event) => setRepeating(event.target.checked)} />
          <Checkbox label="Недоступно" disabled />
        </Demo>
        <Demo label="Сегментированный переключатель">
          <SegmentedControl label="Вид календаря" options={VIEW_OPTIONS} value={view} onChange={setView} />
        </Demo>
        <Demo label="Вкладки">
          <Tabs label="Разделы предмета" items={SUBJECT_TABS} value={subjectTab} onChange={setSubjectTab} className={styles.wide} />
        </Demo>
      </Section>
    </>
  );
}
