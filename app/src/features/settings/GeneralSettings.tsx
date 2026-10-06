import { DateInput } from '../../components/ui/DateInput';
import { EDITING_ENABLED } from './EditModeContext';
import { useSemesterSettingsStore } from './semesterSettingsStore';
import { SettingsRow } from './SettingsRow';
import styles from './settings.module.css';

export function GeneralSettings() {
  const semesterStart = useSemesterSettingsStore((state) => state.semesterStart);
  const weekOneStart = useSemesterSettingsStore((state) => state.weekOneStart);
  const updateSemesterSettings = useSemesterSettingsStore((state) => state.updateSemesterSettings);

  return (
    <>
      {/* Даты семестра и чётность задаёт синхронизация с расписанием группы — вручную только в react-app-dev
          (вкладка «Общие» есть только там, см. SettingsPage) */}
      {EDITING_ENABLED && (
        <>
          <SettingsRow label="Начало семестра" description="От этой даты считаются номера недель в расписании." htmlFor="semester-start">
            <DateInput
              id="semester-start"
              className={styles.dateInput}
              value={semesterStart}
              onChange={(value) => {
                // Пустую дату не сохраняем — поле вернётся к прежнему значению
                if (value) updateSemesterSettings({ semesterStart: value });
              }}
            />
          </SettingsRow>

          <SettingsRow
            label="Нечётная неделя"
            description="Любой день нечётной недели — от него считается чётность всех остальных."
            htmlFor="week-one-start"
          >
            <DateInput
              id="week-one-start"
              className={styles.dateInput}
              value={weekOneStart}
              onChange={(value) => {
                if (value) updateSemesterSettings({ weekOneStart: value });
              }}
            />
          </SettingsRow>
        </>
      )}
    </>
  );
}
