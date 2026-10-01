import { ArrowDownUp, ArrowLeft, Folder, NotebookText, Plus, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Dropdown, type DropdownOption } from '../../components/ui/Dropdown';
import { EmptyState } from '../../components/ui/EmptyState';
import { List, ListItem } from '../../components/ui/List';
import { cn } from '../../lib/cn';
import { pluralize } from '../../lib/pluralize';
import { useClock } from '../../lib/useClock';
import { COLLECTION_LABELS, REPOS, syncGithubContent } from '../../services/githubContent';
import type { LectureNote, LectureNoteCollection, Subject } from '../../types/models';
import { useEditMode } from '../settings/EditModeContext';
import { useSubjectsStore } from '../subjects/subjectsStore';
import { LectureNoteDialog } from './LectureNoteDialog';
import { LectureNoteRow } from './LectureNoteRow';
import { compareLessons } from './NoteReader';
import { useLectureNoteDialog } from './useLectureNoteDialog';
import { useLectureNotesStore } from './lectureNotesStore';
import styles from './MaterialsPage.module.css';

type LectureNoteSort = 'number' | 'date' | 'name';

const SORT_LABELS: Record<LectureNoteSort, string> = {
  number: 'По номеру занятия',
  date: 'По дате',
  name: 'По названию',
};

const COLLECTIONS: LectureNoteCollection[] = ['stream', 'group'];

const NOTE_FORMS: [string, string, string] = ['конспект', 'конспекта', 'конспектов'];

/**
 * Конспекты: папка (1 поток / группа) → предмет → конспекты предмета в этой папке.
 * Конспект всегда читают в контексте конкретного предмета, так и находить проще.
 */
export function LectureNotesTab() {
  const { isEditMode } = useEditMode();
  const { today } = useClock();
  const lectureNotes = useLectureNotesStore((state) => state.lectureNotes);
  const subjects = useSubjectsStore((state) => state.subjects);
  const dialog = useLectureNoteDialog();

  const [collection, setCollection] = useState<LectureNoteCollection | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [sort, setSort] = useState<LectureNoteSort>('number');

  const activeNotes = lectureNotes.filter((note) => !note.archived);
  const subject = subjectId ? subjects.find((item) => item.id === subjectId) : undefined;
  const dialogElement = <LectureNoteDialog target={dialog.target} onClose={dialog.close} />;

  if (!collection) {
    return (
      <>
        <CollectionPicker notes={activeNotes} onSelect={setCollection} />
        {dialogElement}
      </>
    );
  }

  const collectionNotes = activeNotes.filter((note) => (note.collection ?? 'group') === collection);

  if (!subject) {
    return (
      <>
        <div className={styles.subjectToolbar}>
          <button type="button" className={styles.backButton} onClick={() => setCollection(null)}>
            <ArrowLeft size={14} strokeWidth={1.75} aria-hidden />
            {COLLECTION_LABELS[collection]}
          </button>
        </div>
        <SubjectPicker subjects={subjects} notes={collectionNotes} onSelect={setSubjectId} />
        {dialogElement}
      </>
    );
  }

  const sorted = collectionNotes
    .filter((note) => note.subjectId === subject.id)
    .sort((a, b) =>
      sort === 'number'
        ? compareLessons(a, b)
        : sort === 'name'
          ? a.title.localeCompare(b.title)
          : b.createdAt.localeCompare(a.createdAt),
    );

  const sortOptions: DropdownOption[] = (Object.keys(SORT_LABELS) as LectureNoteSort[]).map((value) => ({
    value,
    label: SORT_LABELS[value],
  }));

  return (
    <>
      <div className={styles.subjectToolbar}>
        <button type="button" className={styles.backButton} onClick={() => setSubjectId(null)}>
          <ArrowLeft size={14} strokeWidth={1.75} aria-hidden />
          {subject.name}
          <span className={styles.crumb}>· {COLLECTION_LABELS[collection]}</span>
        </button>

        <div className={styles.controls}>
          <Dropdown
            variant="ghost"
            icon={ArrowDownUp}
            aria-label="Сортировка"
            options={sortOptions}
            value={sort}
            onChange={(value) => setSort(value as LectureNoteSort)}
          />
          {isEditMode && (
            <Button variant="primary" icon={Plus} onClick={() => dialog.openCreate(subject.id, collection)}>
              Добавить конспект
            </Button>
          )}
        </div>
      </div>

      {sorted.length === 0 ? (
        <EmptyState icon={NotebookText} title="Пока нет конспектов" description="Нажмите «Синхронизировать» или добавьте конспект вручную." />
      ) : (
        <List>
          {sorted.map((note) => (
            <LectureNoteRow key={note.id} note={note} today={today} onEdit={dialog.openEdit} />
          ))}
        </List>
      )}

      {dialogElement}
    </>
  );
}

interface CollectionPickerProps {
  notes: LectureNote[];
  onSelect: (collection: LectureNoteCollection) => void;
}

/** Две папки конспектов + синхронизация обоих репозиториев */
function CollectionPicker({ notes, onSelect }: CollectionPickerProps) {
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');

  async function handleSync() {
    setSyncing(true);
    setMessage('');
    try {
      const summary = await syncGithubContent();
      setMessage(`Синхронизировано: ${pluralize(summary.stream + summary.group, NOTE_FORMS)}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось синхронизироваться с GitHub.');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <>
      <div className={styles.subjectToolbar}>
        {message ? <p className={styles.syncMessage}>{message}</p> : <span />}
        <div className={styles.controls}>
          <Button variant="ghost" onClick={handleSync} disabled={syncing}>
            <RefreshCw size={14} strokeWidth={2} className={cn(syncing && styles.spinning)} aria-hidden />
            {syncing ? 'Синхронизация…' : 'Синхронизировать'}
          </Button>
        </div>
      </div>

      <List>
        {COLLECTIONS.map((collection) => {
          const count = notes.filter((note) => (note.collection ?? 'group') === collection).length;
          return (
            <ListItem
              key={collection}
              leading={
                <span className={styles.monogram} aria-hidden>
                  <Folder size={16} strokeWidth={1.75} />
                </span>
              }
              title={
                <button type="button" className={styles.subjectButton} onClick={() => onSelect(collection)}>
                  {COLLECTION_LABELS[collection]}
                </button>
              }
              meta={REPOS[collection].name}
              trailing={<span className={styles.count}>{pluralize(count, NOTE_FORMS)}</span>}
            />
          );
        })}
      </List>
    </>
  );
}

interface SubjectPickerProps {
  subjects: Subject[];
  notes: LectureNote[];
  onSelect: (subjectId: string) => void;
}

/** Список предметов с количеством конспектов у каждого — выбор предмета открывает его конспекты. */
function SubjectPicker({ subjects, notes, onSelect }: SubjectPickerProps) {
  if (subjects.length === 0) {
    return (
      <EmptyState
        icon={NotebookText}
        title="Сначала добавьте предмет"
        description="Конспекты привязаны к предмету — добавьте его на странице «Предметы»."
      />
    );
  }

  return (
    <List>
      {subjects.map((subject) => {
        const count = notes.filter((note) => note.subjectId === subject.id).length;
        return (
          <ListItem
            key={subject.id}
            leading={
              <span className={styles.monogram} aria-hidden>
                {subject.name.charAt(0)}
              </span>
            }
            title={
              <button type="button" className={styles.subjectButton} onClick={() => onSelect(subject.id)}>
                {subject.name}
              </button>
            }
            trailing={<span className={styles.count}>{pluralize(count, NOTE_FORMS)}</span>}
          />
        );
      })}
    </List>
  );
}
