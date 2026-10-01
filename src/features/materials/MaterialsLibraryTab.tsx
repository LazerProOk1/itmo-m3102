import { ArrowDownUp, FolderOpen, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Dropdown, type DropdownOption } from '../../components/ui/Dropdown';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { List } from '../../components/ui/List';
import { Tabs, type TabItem } from '../../components/ui/Tabs';
import { useClock } from '../../lib/useClock';
import { useEditMode } from '../settings/EditModeContext';
import { MaterialDialog } from './MaterialDialog';
import { filterMaterials, searchMaterials, sortMaterials, type MaterialFilter, type MaterialSort } from './materialFilters';
import { MaterialRow } from './MaterialRow';
import { useMaterialDialog } from './useMaterialDialog';
import { useMaterialsStore } from './materialsStore';
import styles from './MaterialsPage.module.css';

const FILTER_ORDER: MaterialFilter[] = ['all', 'literature', 'assignments', 'google'];

const FILTER_LABELS: Record<MaterialFilter, string> = {
  all: 'Все',
  literature: 'Литература',
  assignments: 'Задания',
  google: 'Google Drive',
};

const SORT_LABELS: Record<MaterialSort, string> = {
  date: 'По дате добавления',
  name: 'По названию',
};

/** Материалы всех предметов: поиск, фильтр по категории, сортировка. */
export function MaterialsLibraryTab() {
  const { isEditMode } = useEditMode();
  const { today } = useClock();
  const materials = useMaterialsStore((state) => state.materials);
  const dialog = useMaterialDialog();

  const [filter, setFilter] = useState<MaterialFilter>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<MaterialSort>('date');

  const searched = searchMaterials(materials, query);
  const countFor = (value: MaterialFilter) => filterMaterials(searched, value).length;
  const tabs: TabItem<MaterialFilter>[] = FILTER_ORDER.map((value) => ({
    value,
    label: FILTER_LABELS[value],
    count: countFor(value),
  }));
  const visibleMaterials = sortMaterials(filterMaterials(searched, filter), sort);
  const sortOptions: DropdownOption[] = (Object.keys(SORT_LABELS) as MaterialSort[]).map((value) => ({
    value,
    label: SORT_LABELS[value],
  }));

  return (
    <>
      <div className={styles.toolbar}>
        <Tabs label="Фильтр материалов" items={tabs} value={filter} onChange={setFilter} className={styles.tabs} />

        <div className={styles.controls}>
          <Input
            icon={Search}
            value={query}
            placeholder="Поиск материалов…"
            aria-label="Поиск материалов"
            className={styles.search}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Dropdown
            variant="ghost"
            icon={ArrowDownUp}
            aria-label="Сортировка"
            options={sortOptions}
            value={sort}
            onChange={(value) => setSort(value as MaterialSort)}
          />
          {isEditMode && (
            <Button variant="primary" icon={Plus} onClick={() => dialog.openCreate()}>
              Добавить материал
            </Button>
          )}
        </div>
      </div>

      {visibleMaterials.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Здесь пока нет материалов"
          description={query ? `Ничего не найдено по запросу «${query.trim()}».` : 'Здесь появятся материалы, подходящие под этот фильтр.'}
        />
      ) : (
        <List>
          {visibleMaterials.map((material) => (
            <MaterialRow key={material.id} material={material} today={today} onEdit={dialog.openEdit} showSubject />
          ))}
        </List>
      )}

      <MaterialDialog target={dialog.target} onClose={dialog.close} />
    </>
  );
}
