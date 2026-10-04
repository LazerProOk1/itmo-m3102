import { ArrowDownUp, ArrowLeft, Folder, NotebookText, Plus, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Button } from '../../components/ui/Button';
import { Swap, useDirection } from '../../components/ui/Swap';
import { Dropdown, type DropdownOption } from '../../components/ui/Dropdown';
import { EmptyState } from '../../components/ui/EmptyState';
import { List, ListItem } from '../../components/ui/List';
import { cn } from '../../lib/cn';
import { pluralize } from '../../lib/pluralize';
import { useClock } from '../../lib/useClock';
import { COLLECTION_LABELS, REPOS } from '../../services/githubContent';
import { useSyncStore } from '../../services/syncStore';
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

const COLLECTIONS: LectureNoteCollection[] = ['group', 'stream'];

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

  // Папка и предмет — в адресе (?c=group&s=aisd): «Назад» и выход из конспекта возвращают сюда же, а не в начало
  const [params, setParams] = useSearchParams();
  const collection = COLLECTIONS.find((item) => item === params.get('c')) ?? null;
  const subjectId = collection ? params.get('s') : null;
  // Папка занятия (Лекция_1, Практика_2, Доп_Материалы) — как в репозитории группы: по ней ищут быстрее, чем по теме
  const folder = subjectId ? params.get('f') : null;
  const setCollection = (value: LectureNoteCollection | null) => setParams(value ? { c: value } : {});
  const setSubjectId = (value: string | null) => setParams(value ? { c: collection!, s: value } : { c: collection! });
  const setFolder = (value: string | null) =>
    setParams(value !== null ? { c: collection!, s: subjectId!, f: value } : { c: collection!, s: subjectId! });
  const [sort, setSort] = useState<LectureNoteSort>('number');
  // Глубже (папка → предмет → конспекты) — листаем вправо, назад — влево
  const direction = useDirection(collection ? (subjectId ? (folder !== null ? 3 : 2) : 1) : 0);

  const activeNotes = lectureNotes.filter((note) => !note.archived);
  const subject = subjectId ? subjects.find((item) => item.id === subjectId) : undefined;
  const dialogElement = <LectureNoteDialog target={dialog.target} onClose={dialog.close} />;

  if (!collection) {
    return (
      <Swap id={`${collection ?? ''}|${subjectId ?? ''}`} direction={direction}>
        <CollectionPicker notes={activeNotes} onSelect={setCollection} />
        {dialogElement}
      </Swap>
    );
  }

  const collectionNotes = activeNotes.filter((note) => (note.collection ?? 'group') === collection);

  if (!subject) {
    return (
      <Swap id={`${collection ?? ''}|${subjectId ?? ''}`} direction={direction}>
        <div className={styles.subjectToolbar}>
          <button type="button" className={styles.backButton} onClick={() => setCollection(null)}>
            <ArrowLeft size={14} strokeWidth={1.75} aria-hidden />
            {COLLECTION_LABELS[collection]}
          </button>
        </div>
        <SubjectPicker subjects={subjects} notes={collectionNotes} onSelect={setSubjectId} />
        {dialogElement}
      </Swap>
    );
  }

  const subjectNotes = collectionNotes.filter((note) => note.subjectId === subject.id);
  // По номеру занятия — сначала папки; по дате и названию — все конспекты подряд
  const byFolders = sort === 'number';
  const inFolder = folder !== null && byFolders;
  const sorted = subjectNotes
    .filter((note) => !inFolder || note.lectureNumber === folder)
    .sort((a, b) =>
      sort === 'number' ? compareLessons(a, b) : sort === 'name' ? a.title.localeCompare(b.title) : b.createdAt.localeCompare(a.createdAt),
    );

  const sortOptions: DropdownOption[] = (Object.keys(SORT_LABELS) as LectureNoteSort[]).map((value) => ({
    value,
    label: SORT_LABELS[value],
  }));

  return (
    <Swap id={`${collection ?? ''}|${subjectId ?? ''}|${inFolder ? folder : ''}`} direction={direction}>
      <div className={styles.subjectToolbar}>
        <button type="button" className={styles.backButton} onClick={() => (inFolder ? setFolder(null) : setSubjectId(null))}>
          <ArrowLeft size={14} strokeWidth={1.75} aria-hidden />
          {inFolder ? folder || 'Без папки' : subject.name}
          <span className={styles.crumb}>· {inFolder ? subject.name : COLLECTION_LABELS[collection]}</span>
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
      ) : byFolders && !inFolder ? (
        <FolderList notes={sorted} onSelect={setFolder} />
      ) : (
        <List className={styles.bigList}>
          {sorted.map((note) => (
            <LectureNoteRow key={note.id} note={note} today={today} onEdit={dialog.openEdit} />
          ))}
        </List>
      )}

      {dialogElement}
    </Swap>
  );
}

/** Папки занятий предмета по порядку (Лекция 1, Практика 1, Лекция 2…) с числом конспектов в каждой */
function FolderList({ notes, onSelect }: { notes: LectureNote[]; onSelect: (folder: string) => void }) {
  const folders = [...new Set(notes.map((note) => note.lectureNumber))];
  return (
    <List className={styles.bigList}>
      {folders.map((folder) => {
        const inside = notes.filter((note) => note.lectureNumber === folder);
        return (
          <ListItem
            key={folder}
            leading={
              <span className={styles.monogram} aria-hidden>
                <Folder size={16} strokeWidth={1.75} />
              </span>
            }
            title={
              <button type="button" className={styles.subjectButton} onClick={() => onSelect(folder)}>
                {folder || 'Без папки'}
              </button>
            }
            meta={inside.map((note) => note.title).join(' · ')}
            trailing={<span className={styles.count}>{pluralize(inside.length, NOTE_FORMS)}</span>}
          />
        );
      })}
    </List>
  );
}

interface CollectionPickerProps {
  notes: LectureNote[];
  onSelect: (collection: LectureNoteCollection) => void;
}

/** Две папки конспектов + синхронизация обоих репозиториев */
function CollectionPicker({ notes, onSelect }: CollectionPickerProps) {
  const status = useSyncStore((state) => state.status);
  const summary = useSyncStore((state) => state.summary);
  const error = useSyncStore((state) => state.error);
  const run = useSyncStore((state) => state.run);
  const syncing = status === 'syncing';
  const message =
    status === 'error' ? error : status === 'done' && summary ? `Синхронизировано: ${pluralize(summary.stream + summary.group, NOTE_FORMS)}` : '';

  return (
    <>
      <div className={styles.subjectToolbar}>
        {message ? <p className={styles.syncMessage}>{message}</p> : <span />}
        <div className={styles.controls}>
          <Button variant="ghost" onClick={run} disabled={syncing}>
            <RefreshCw size={14} strokeWidth={2} className={cn(syncing && styles.spinning)} aria-hidden />
            {syncing ? 'Синхронизация…' : 'Синхронизировать'}
          </Button>
        </div>
      </div>

      <List className={styles.bigList}>
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
    <List className={styles.bigList}>
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
