import { ArrowDownUp, ListFilter, NotebookPen, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Dropdown, type DropdownOption } from '../../components/ui/Dropdown';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { List } from '../../components/ui/List';
import { PageHeader } from '../../components/ui/PageHeader';
import { pluralize } from '../../lib/pluralize';
import { useClock } from '../../lib/useClock';
import { useEditMode } from '../settings/EditModeContext';
import { useSubjectsStore } from '../subjects/subjectsStore';
import { NoteDialog } from './NoteDialog';
import { searchNotes, sortNotes, type NoteSort } from './noteFilters';
import { NoteRow } from './NoteRow';
import { useNoteDialog } from './useNoteDialog';
import { useNotesStore } from './notesStore';
import styles from './NotesPage.module.css';

const SORT_LABELS: Record<NoteSort, string> = {
  updated: 'По дате изменения',
  title: 'По названию',
};

/**
 * Все заметки всех предметов — простой список: поиск, фильтр по предмету, сортировка.
 * Без папок, тегов и вложенных страниц — заметка это заголовок и текст, не более того.
 */
export function NotesPage() {
  const { isEditMode } = useEditMode();
  const { today } = useClock();
  const notes = useNotesStore((state) => state.notes);
  const subjects = useSubjectsStore((state) => state.subjects);
  const dialog = useNoteDialog();

  const [query, setQuery] = useState('');
  const [subjectId, setSubjectId] = useState('all');
  const [sort, setSort] = useState<NoteSort>('updated');

  const subjectFiltered = subjectId === 'all' ? notes : notes.filter((note) => note.subjectId === subjectId);
  const visibleNotes = sortNotes(searchNotes(subjectFiltered, query), sort);

  const subjectOptions: DropdownOption[] = [
    { value: 'all', label: 'Все предметы' },
    ...subjects.map((subject) => ({ value: subject.id, label: subject.name })),
  ];
  const sortOptions: DropdownOption[] = (Object.keys(SORT_LABELS) as NoteSort[]).map((value) => ({
    value,
    label: SORT_LABELS[value],
  }));

  return (
    <>
      <PageHeader
        title="Заметки"
        subtitle={pluralize(notes.length, ['заметка', 'заметки', 'заметок'])}
        actions={
          isEditMode && (
            <Button variant="primary" icon={Plus} onClick={() => dialog.openCreate()}>
              Добавить заметку
            </Button>
          )
        }
      />

      <div className={styles.toolbar}>
        <Input
          icon={Search}
          value={query}
          placeholder="Поиск заметок…"
          aria-label="Поиск заметок"
          className={styles.search}
          onChange={(event) => setQuery(event.target.value)}
        />

        <div className={styles.controls}>
          <Dropdown
            variant="ghost"
            icon={ListFilter}
            aria-label="Фильтр по предмету"
            options={subjectOptions}
            value={subjectId}
            onChange={setSubjectId}
          />

          <Dropdown
            variant="ghost"
            icon={ArrowDownUp}
            aria-label="Сортировка"
            options={sortOptions}
            value={sort}
            onChange={(value) => setSort(value as NoteSort)}
          />
        </div>
      </div>

      {visibleNotes.length === 0 ? (
        <EmptyState
          icon={NotebookPen}
          title="Здесь пока нет заметок"
          description={query ? `Ничего не найдено по запросу «${query.trim()}».` : 'Храните здесь всё, что стоит запомнить.'}
        />
      ) : (
        <List>
          {visibleNotes.map((note) => (
            <NoteRow key={note.id} note={note} today={today} onEdit={dialog.openEdit} showSubject />
          ))}
        </List>
      )}

      <NoteDialog target={dialog.target} onClose={dialog.close} />
    </>
  );
}
