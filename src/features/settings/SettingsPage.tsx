import { useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Tabs, type TabItem } from '../../components/ui/Tabs';
import { AppearanceSettings } from './AppearanceSettings';
import { DataSettings } from './DataSettings';
import { GeneralSettings } from './GeneralSettings';
import styles from './settings.module.css';

type SettingsTab = 'general' | 'appearance' | 'data';

const TABS: TabItem<SettingsTab>[] = [
  { value: 'general', label: 'Общие' },
  { value: 'appearance', label: 'Оформление' },
  { value: 'data', label: 'Данные' },
];

export function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('general');

  return (
    <>
      <PageHeader title="Настройки" />
      <div className={styles.page}>
        <Tabs label="Разделы настроек" items={TABS} value={tab} onChange={setTab} />
        <div role="tabpanel">
          {tab === 'general' && <GeneralSettings />}
          {tab === 'appearance' && <AppearanceSettings />}
          {tab === 'data' && <DataSettings />}
        </div>
      </div>
    </>
  );
}
