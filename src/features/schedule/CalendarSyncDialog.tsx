import { CalendarPlus, Check, Copy, Download } from 'lucide-react';
import { useState } from 'react';
import { Button, buttonClass } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { addDays } from '../../lib/dates';
import { saveBlob } from '../../lib/download';
import { buildIcs } from '../../lib/ics';
import { useClock } from '../../lib/useClock';
import { useEventsStore } from '../calendar/eventsStore';
import { useGroupStore } from '../group/groupStore';
import { useHomeworkStore } from '../homework/homeworkStore';
import { useSubjectsStore } from '../subjects/subjectsStore';
import { useTasksStore } from '../tasks/tasksStore';
import { groupCalendarEvents, personalCalendarEvents, SUBSCRIPTION_URL } from './calendarExport';
import { useScheduleData } from './scheduleStore';
import styles from './CalendarSyncDialog.module.css';

const WEBCAL = SUBSCRIPTION_URL.replace(/^https:/, 'webcal:');
const GOOGLE = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(WEBCAL)}`;

/**
 * Пары, дедлайны и ДЗ в Google / Apple Календаре. Подписка по ссылке обновляется сама (файл пересобирает GitHub
 * раз в сутки и при каждом обновлении сайта); «Скачать .ics» — разовый снимок, в нём ещё и личное из этого браузера.
 */
export function CalendarSyncDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { today } = useClock();
  const schedule = useScheduleData();
  const subjects = useSubjectsStore((state) => state.subjects);
  const deadlines = useGroupStore((state) => state.deadlines);
  const homework = useHomeworkStore((state) => state.items);
  const events = useEventsStore((state) => state.events);
  const tasks = useTasksStore((state) => state.tasks);
  const [copied, setCopied] = useState(false);

  const download = () => {
    const from = addDays(today, -7) > schedule.semesterStart ? addDays(today, -7) : schedule.semesterStart;
    const text = buildIcs(
      [...groupCalendarEvents({ schedule, subjects, deadlines, homework, from, days: 200 }), ...personalCalendarEvents(events, tasks)],
      { name: 'М3102 — моё расписание' },
    );
    saveBlob(new Blob([text], { type: 'text/calendar;charset=utf-8' }), 'm3102.ics');
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Добавить в календарь"
      description="Пары с переносами и заменами, дедлайны группы и ДЗ — в Google или Apple Календаре."
    >
      <div className={styles.body}>
        <section className={styles.option}>
          <h3 className={styles.heading}>Подписка — обновляется сама</h3>
          <p className={styles.text}>
            Перенесли пару или добавили дедлайн — календарь подтянет сам: Apple — через несколько часов, Google — до суток.
          </p>
          <div className={styles.actions}>
            <a className={buttonClass('primary', 'md')} href={GOOGLE} target="_blank" rel="noopener noreferrer">
              Google Календарь
            </a>
            <a className={buttonClass('secondary', 'md')} href={WEBCAL}>
              Apple Календарь
            </a>
          </div>
          <div className={styles.link}>
            <code>{SUBSCRIPTION_URL}</code>
            <Button
              variant="ghost"
              size="sm"
              icon={copied ? Check : Copy}
              onClick={() =>
                void navigator.clipboard.writeText(SUBSCRIPTION_URL).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                })
              }
            >
              {copied ? 'Скопировано' : 'Ссылка'}
            </Button>
          </div>
          <p className={styles.hint}>
            Другой календарь (Outlook, Яндекс) — «Добавить календарь по ссылке» и вставить ссылку. Без своих событий: подписка общая для группы.
          </p>
        </section>

        <section className={styles.option}>
          <h3 className={styles.heading}>Файл — один раз</h3>
          <p className={styles.text}>То же плюс ваши события и задачи учебного плана из этого браузера. Сам не обновляется.</p>
          <div className={styles.actions}>
            <Button variant="secondary" icon={Download} onClick={download}>
              Скачать .ics
            </Button>
          </div>
        </section>
      </div>
    </Modal>
  );
}

/** Кнопка «В календарь» для шапки страницы — вместе со своим окном */
export function CalendarSyncButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" icon={CalendarPlus} onClick={() => setOpen(true)}>
        В календарь
      </Button>
      <CalendarSyncDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
