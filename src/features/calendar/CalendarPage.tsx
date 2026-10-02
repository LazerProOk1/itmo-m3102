import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { ConfirmDeleteModal } from '../../components/ui/ConfirmDeleteModal';
import { PageHeader } from '../../components/ui/PageHeader';
import { Swap, useDirection } from '../../components/ui/Swap';
import { addDays, addMonths, formatFullDate, formatMonthLabel, formatWeekRange, getWeekDates, getWeekdayName, startOfWeek } from '../../lib/dates';
import { getStudyWeek, WEEK_PARITY_LABELS } from '../../lib/studyWeek';
import { useClock } from '../../lib/useClock';
import type { ISODate } from '../../types/models';
import { ClassDialog } from '../schedule/ClassDialog';
import { ExceptionDialog } from '../schedule/ExceptionDialog';
import { useEditMode } from '../settings/EditModeContext';
import { useScheduleData } from '../schedule/scheduleStore';
import { useScheduleDialogs } from '../schedule/useScheduleDialogs';
import { TaskDialog } from '../tasks/TaskDialog';
import { useTaskDialog } from '../tasks/useTaskDialog';
import { useTasksStore } from '../tasks/tasksStore';
import type { CalendarData } from './calendarEntries';
import { CalendarMonthView } from './CalendarMonthView';
import { CalendarToolbar, type CalendarMode } from './CalendarToolbar';
import { EventDialog } from './EventDialog';
import { useEventDialog } from './useEventDialog';
import { useEventsStore } from './eventsStore';
import { TimeGrid } from './TimeGrid';

/** На телефоне сетке месяца и недели не хватает ширины — начинаем с одного дня */
function getDefaultMode(): CalendarMode {
  return window.matchMedia('(max-width: 767px)').matches ? 'day' : 'month';
}

/**
 * Календарь объединяет Classes (из Schedule), дедлайны задач и обычные события на одном экране.
 * Все данные — общие с остальным приложением: расписание считается той же функцией
 * getOccurrencesForDate, что и на странице Schedule, а не отдельной копией.
 */
export function CalendarPage() {
  const { isEditMode } = useEditMode();
  const { today, time } = useClock();
  const scheduleData = useScheduleData();
  const tasks = useTasksStore((state) => state.tasks);
  const events = useEventsStore((state) => state.events);

  const scheduleDialogs = useScheduleDialogs();
  const taskDialog = useTaskDialog();
  const eventDialog = useEventDialog();

  const [mode, setMode] = useState<CalendarMode>(getDefaultMode);
  const [anchor, setAnchor] = useState<ISODate>(today);

  const data: CalendarData = { schedule: scheduleData, tasks, events };

  function moveBy(monthDelta: number, dayDelta: number) {
    setAnchor((current) => (mode === 'month' ? addMonths(current, monthDelta) : addDays(current, dayDelta)));
  }

  function goToPrevious() {
    moveBy(-1, mode === 'week' ? -7 : -1);
  }

  function goToNext() {
    moveBy(1, mode === 'week' ? 7 : 1);
  }

  function openDay(date: ISODate) {
    setAnchor(date);
    setMode('day');
  }

  const week = getStudyWeek(anchor, scheduleData.semesterStart, scheduleData.weekOneStart);
  const weekStart = startOfWeek(anchor);
  const period = mode === 'month' ? anchor.slice(0, 7) : mode === 'week' ? weekStart : anchor;
  const direction = useDirection(Date.parse(mode === 'month' ? `${period}-01` : period));

  const subtitle =
    mode === 'month'
      ? formatMonthLabel(anchor)
      : mode === 'week'
        ? week.number >= 1
          ? `${WEEK_PARITY_LABELS[week.weekInCycle]} · ${formatWeekRange(weekStart)}`
          : `${formatWeekRange(weekStart)} · До начала семестра`
        : `${getWeekdayName(anchor)}, ${formatFullDate(anchor)}`;

  return (
    <>
      <PageHeader
        title="Календарь"
        subtitle={subtitle}
        actions={
          isEditMode && (
            <Button variant="primary" icon={Plus} onClick={() => eventDialog.openCreate(anchor)}>
              Добавить событие
            </Button>
          )
        }
      />

      <CalendarToolbar mode={mode} onModeChange={setMode} onPrevious={goToPrevious} onNext={goToNext} onToday={() => setAnchor(today)} />

      {/* Смена месяца/недели/дня — «перелистывание» в сторону перехода */}
      <Swap id={`${mode}-${period}`} direction={direction}>
        {mode === 'month' ? (
          <CalendarMonthView
            anchor={anchor}
            today={today}
            data={data}
            onOpenDay={openDay}
            onEditTask={taskDialog.openEdit}
            onEditEvent={eventDialog.openEdit}
            onAddEvent={eventDialog.openCreate}
          />
        ) : (
          <TimeGrid
            days={mode === 'week' ? getWeekDates(weekStart) : [anchor]}
            today={today}
            time={time}
            data={data}
            onClassAction={scheduleDialogs.handleAction}
            onEditTask={taskDialog.openEdit}
            onEditEvent={eventDialog.openEdit}
            onAddEvent={eventDialog.openCreate}
          />
        )}
      </Swap>

      <ClassDialog target={scheduleDialogs.classTarget} onClose={scheduleDialogs.closeClassDialog} />
      <ExceptionDialog target={scheduleDialogs.exceptionTarget} onClose={scheduleDialogs.closeExceptionDialog} />
      <TaskDialog target={taskDialog.target} onClose={taskDialog.close} />
      <EventDialog target={eventDialog.target} onClose={eventDialog.close} />
      <ConfirmDeleteModal
        open={scheduleDialogs.isDeleteConfirmOpen}
        title={scheduleDialogs.deleteConfirmTitle}
        onCancel={scheduleDialogs.cancelDelete}
        onConfirm={scheduleDialogs.confirmDelete}
      />
    </>
  );
}
