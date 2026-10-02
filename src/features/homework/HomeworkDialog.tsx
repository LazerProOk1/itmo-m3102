import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Textarea';
import { addDays } from '../../lib/dates';
import { useClock } from '../../lib/useClock';
import type { ISODate } from '../../types/models';
import { nextClassDate } from '../schedule/occurrences';
import { useScheduleData } from '../schedule/scheduleStore';
import { useSubjectsStore } from '../subjects/subjectsStore';
import { useHomeworkStore, validUrl, type HomeworkItem, type HomeworkLink } from './homeworkStore';
import styles from './Homework.module.css';

/** Пара, с которой задают ДЗ (из карточки занятия в расписании) */
export interface HomeworkLesson {
  date: ISODate;
  id: string;
  start: string;
  subject: string;
}

export type HomeworkDialogTarget = { item: HomeworkItem } | { lesson?: HomeworkLesson };

/** Одно окно ДЗ на всё приложение: открывается и со страницы ДЗ, и из карточки пары в расписании */
export const useHomeworkDialog = create<{ target: HomeworkDialogTarget | null; open: (target: HomeworkDialogTarget) => void; close: () => void }>()(
  (set) => ({
    target: null,
    open: (target) => set({ target }),
    close: () => set({ target: null }),
  }),
);

const FORM_ID = 'homework-form';

const linksToText = (links: HomeworkLink[]) => links.map((link) => `${link.title} | ${link.url}`).join('\n');

/** "Листок | https://…" или просто URL — по строке на ссылку. null — есть строка без корректного URL. */
export function parseLinks(text: string): HomeworkLink[] | null {
  const links = text
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      const [title = '', ...rest] = line.split('|');
      const raw = rest.length ? rest.join('|').trim() : title.trim();
      return { title: rest.length ? title.trim() || raw : raw, url: validUrl(raw) };
    });
  return links.some((link) => !link.url) ? null : links;
}

export function HomeworkDialog() {
  const target = useHomeworkDialog((state) => state.target);
  const onClose = useHomeworkDialog((state) => state.close);
  const { today } = useClock();
  const saveItem = useHomeworkStore((state) => state.saveItem);
  const subjects = useSubjectsStore((state) => state.subjects);
  const scheduleData = useScheduleData();

  const item = target && 'item' in target ? target.item : undefined;
  const lesson = target && 'lesson' in target ? target.lesson : undefined;
  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');
  const [due, setDue] = useState('');
  const [links, setLinks] = useState('');
  const [error, setError] = useState('');

  const lessonDate = item?.lessonDate || lesson?.date || '';

  function nextLesson(subjectName: string): string {
    const subjectId = subjects.find((entry) => entry.name === subjectName.trim())?.id;
    return subjectId ? (nextClassDate(subjectId, lessonDate || today, scheduleData) ?? '') : '';
  }

  useEffect(() => {
    if (!target) return;
    setSubject(item?.subject ?? lesson?.subject ?? '');
    setText(item?.text ?? '');
    setLinks(linksToText(item?.links ?? []));
    setError('');
    setDue(item ? item.due : lesson ? nextLesson(lesson.subject) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  function handleSubmit() {
    const parsedLinks = parseLinks(links);
    if (!subject.trim() || !text.trim()) return setError('Заполните предмет и задание.');
    if (!parsedLinks) return setError('Ссылки должны начинаться с http:// или https://');
    const now = new Date().toISOString();
    saveItem({
      id: item?.id ?? crypto.randomUUID(),
      subject: subject.trim(),
      lessonDate,
      lessonId: item?.lessonId ?? lesson?.id ?? '',
      lessonStart: item?.lessonStart ?? lesson?.start ?? '',
      text: text.trim(),
      due,
      links: parsedLinks,
      createdAt: item?.createdAt ?? now,
      updatedAt: now,
    });
    onClose();
  }

  return (
    <Modal
      open={target !== null}
      onClose={onClose}
      title={item ? 'Изменить задание' : 'Новое задание'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" type="submit" form={FORM_ID}>
            Сохранить задание
          </Button>
        </>
      }
    >
      <form
        id={FORM_ID}
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
      >
        <Field label="Предмет" htmlFor="hw-subject">
          <Input id="hw-subject" list="hw-subjects" required maxLength={120} value={subject} onChange={(event) => setSubject(event.target.value)} />
          <datalist id="hw-subjects">
            {subjects.map((entry) => (
              <option key={entry.id} value={entry.name} />
            ))}
          </datalist>
        </Field>
        <Field label="Задание" htmlFor="hw-text" hint="Работают **жирный**, *курсив*, `код`, списки, ссылки и формулы $…$">
          <Textarea id="hw-text" rows={5} required maxLength={5000} value={text} onChange={(event) => setText(event.target.value)} />
        </Field>
        <Field label="Срок сдачи" htmlFor="hw-due" optional>
          <Input id="hw-due" type="date" value={due} onChange={(event) => setDue(event.target.value)} />
        </Field>
        <div className={styles.presets}>
          <Button size="sm" variant="secondary" onClick={() => setDue(nextLesson(subject))}>
            К следующей паре
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setDue(addDays(lessonDate || today, 7))}>
            Через неделю
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setDue('')}>
            Без срока
          </Button>
        </div>
        <Field label="Ссылки на материалы" htmlFor="hw-links" hint="По одной на строку: название | https://…" optional>
          <Textarea
            id="hw-links"
            rows={3}
            value={links}
            placeholder="Листок | https://example.com/file.pdf"
            onChange={(event) => setLinks(event.target.value)}
          />
        </Field>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
