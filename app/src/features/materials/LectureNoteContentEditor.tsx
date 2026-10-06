import { HardDrive, Link2, Type, Upload } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Textarea } from '../../components/ui/Textarea';
import { googleDriveService } from '../../services/googleDrive';
import type { LectureNoteContentType } from '../../types/models';
import styles from './LectureNoteContentEditor.module.css';

/** Больше — не имеет смысла хранить как base64 в localStorage, лучше ссылка на Google Drive */
const MAX_PDF_BYTES = 3 * 1024 * 1024;

const CONTENT_TYPE_OPTIONS = [
  { value: 'markdown' as const, label: 'Текст', icon: Type },
  { value: 'pdf' as const, label: 'PDF', icon: Upload },
  { value: 'link' as const, label: 'Ссылка', icon: Link2 },
];

interface LectureNoteContentEditorProps {
  contentType: LectureNoteContentType;
  content: string;
  onContentTypeChange: (type: LectureNoteContentType) => void;
  onContentChange: (content: string) => void;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Что показать про уже выбранный PDF: имени файла модель не хранит, только сам content */
function describePdfContent(content: string): string {
  if (!content) return '';
  if (content.startsWith('data:')) {
    const approxKb = Math.round((content.length * 3) / 4 / 1024);
    return `Файл загружен (~${approxKb} КБ)`;
  }
  return content;
}

/** Наполнение конспекта: markdown-текст, загрузка PDF (локально или из Google Drive) или ссылка. */
export function LectureNoteContentEditor({ contentType, content, onContentTypeChange, onContentChange }: LectureNoteContentEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pdfError, setPdfError] = useState('');

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (file.size > MAX_PDF_BYTES) {
      setPdfError('Файл больше 3 МБ — для больших файлов лучше вставить ссылку на Google Drive.');
      return;
    }

    setPdfError('');
    onContentChange(await readAsDataUrl(file));
  }

  async function handlePickFromDrive() {
    setPdfError('');
    try {
      const result = await googleDriveService.pickFile();
      if (!result) return; // пользователь отменил выбор
      onContentChange(result.file.url);
    } catch {
      setPdfError('Google Drive пока не подключён — загрузите файл вручную или вставьте ссылку ниже.');
    }
  }

  return (
    <Field label="Содержание" optional>
      <SegmentedControl label="Тип содержимого" options={CONTENT_TYPE_OPTIONS} value={contentType} onChange={onContentTypeChange} />

      {contentType === 'markdown' && (
        <Textarea
          rows={14}
          className={styles.textarea}
          value={content}
          placeholder="Запишите содержание лекции — обычный markdown: заголовки, списки, **жирный текст**, код, таблицы, ссылки."
          onChange={(event) => onContentChange(event.target.value)}
        />
      )}

      {contentType === 'pdf' && (
        <div className={styles.pdfField}>
          <div className={styles.pdfActions}>
            <Button type="button" size="sm" icon={Upload} onClick={() => fileInputRef.current?.click()}>
              Загрузить PDF
            </Button>
            <Button type="button" variant="secondary" size="sm" icon={HardDrive} onClick={handlePickFromDrive}>
              Выбрать из Google Drive
            </Button>
            <input ref={fileInputRef} type="file" accept="application/pdf" className={styles.hiddenInput} onChange={handleFileSelected} />
          </div>
          {content && <p className={styles.pdfStatus}>{describePdfContent(content)}</p>}
          {pdfError ? (
            <p className={styles.pdfError}>{pdfError}</p>
          ) : (
            <p className={styles.pdfHint}>До 3 МБ — храним прямо в приложении. Для больших файлов используйте ссылку на Google Drive.</p>
          )}
        </div>
      )}

      {contentType === 'link' && (
        <Input type="url" value={content} placeholder="https://docs.google.com/…" onChange={(event) => onContentChange(event.target.value)} />
      )}
    </Field>
  );
}
