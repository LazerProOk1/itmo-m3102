import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Button } from '../../components/ui/Button';
import { Swap, useDirection } from '../../components/ui/Swap';
import { ConfirmDeleteModal } from '../../components/ui/ConfirmDeleteModal';
import { PageHeader } from '../../components/ui/PageHeader';
import { addDays, formatWeekRange, getWeekDates, startOfWeek } from '../../lib/dates';
import { getStudyWeek, WEEK_PARITY_LABELS } from '../../lib/studyWeek';
import { useClock } from '../../lib/useClock';
import type { ISODate } from '../../types/models';
import { CalendarSyncButton } from './CalendarSyncDialog';
import { ClassDialog } from './ClassDialog';
import { DayView } from './DayView';
import { ExceptionDialog } from './ExceptionDialog';
import { getOccurrencesForDate, type DaySchedule } from './occurrences';
import { ScheduleToolbar, type ScheduleView } from './ScheduleToolbar';
import { useEditMode } from '../settings/EditModeContext';
import { useScheduleData } from './scheduleStore';
import { useScheduleDialogs } from './useScheduleDialogs';
import { WeekView } from './WeekView';

/** Индекс субботы в неделе, которая начинается с понедельника */

/** На телефоне удобнее начинать с одного дня */
function getDefaultView(): ScheduleView {
  return window.matchMedia('(max-width: 767px)').matches ? 'day' : 'week';
}

export function SchedulePage() {
  const { isEditMode } = useEditMode();
  const { today, time } = useClock();
  const scheduleData = useScheduleData();
  const dialogs = useScheduleDialogs();
  const [view, setView] = useState<ScheduleView>(getDefaultView);

  // Выбранный день. На экране — неделя, в которую он попадает. ?date=2026-09-24 — открыть нужный день (ссылка из ДЗ)
  const [searchParams] = useSearchParams();
  const [selectedDate, setSelectedDate] = useState<ISODate>(() => {
    const requested = searchParams.get('date') ?? '';
    return /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : today;
  });

  const weekStart = startOfWeek(selectedDate);
  const week = getStudyWeek(weekStart, scheduleData.semesterStart, scheduleData.weekOneStart);
  // Следующая неделя приезжает справа, предыдущая — слева
  const direction = useDirection(Date.parse(weekStart));

  const days: DaySchedule[] = getWeekDates(weekStart).map((date) => ({ date, occurrences: getOccurrencesForDate(date, scheduleData) }));

  function moveWeeks(count: number) {
    setSelectedDate(addDays(selectedDate, 7 * count));
  }

  const subtitle =
    week.number >= 1
      ? `${WEEK_PARITY_LABELS[week.weekInCycle]} · ${formatWeekRange(weekStart)}`
      : `${formatWeekRange(weekStart)} · До начала семестра`;

  return (
    <>
      <PageHeader
        title="Расписание"
        subtitle={subtitle}
        actions={
          <>
            <CalendarSyncButton />
            {isEditMode && (
              <Button variant="primary" icon={Plus} onClick={() => dialogs.openNewClass(selectedDate)}>
                Добавить пару
              </Button>
            )}
          </>
        }
      />

      <ScheduleToolbar
        weekInCycle={week.weekInCycle}
        view={view}
        onPrevious={() => moveWeeks(-1)}
        onNext={() => moveWeeks(1)}
        onToday={() => setSelectedDate(today)}
        onViewChange={setView}
      />

      <Swap id={`${view}-${weekStart}`} direction={direction}>
        {view === 'week' ? (
          <WeekView days={days} today={today} time={time} onAddDate={dialogs.openNewClass} onAction={dialogs.handleAction} />
        ) : (
          <DayView days={days} selectedDate={selectedDate} today={today} time={time} onSelectDate={setSelectedDate} onAction={dialogs.handleAction} />
        )}
      </Swap>

      <ClassDialog target={dialogs.classTarget} onClose={dialogs.closeClassDialog} />
      <ExceptionDialog target={dialogs.exceptionTarget} onClose={dialogs.closeExceptionDialog} />
      <ConfirmDeleteModal
        open={dialogs.isDeleteConfirmOpen}
        title={dialogs.deleteConfirmTitle}
        onCancel={dialogs.cancelDelete}
        onConfirm={dialogs.confirmDelete}
      />
    </>
  );
}
