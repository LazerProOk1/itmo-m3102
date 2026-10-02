import { Input } from '../../components/ui/Input';
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
            <Input
              id="semester-start"
              type="date"
              className={styles.dateInput}
              value={semesterStart}
              onChange={(event) => {
                // Пустую дату не сохраняем — поле вернётся к прежнему значению
                if (event.target.value) updateSemesterSettings({ semesterStart: event.target.value });
              }}
            />
          </SettingsRow>

          <SettingsRow
            label="Нечётная неделя"
            description="Любой день нечётной недели — от него считается чётность всех остальных."
            htmlFor="week-one-start"
          >
            <Input
              id="week-one-start"
              type="date"
              className={styles.dateInput}
              value={weekOneStart}
              onChange={(event) => {
                if (event.target.value) updateSemesterSettings({ weekOneStart: event.target.value });
              }}
            />
          </SettingsRow>
        </>
      )}
    </>
  );
}
