import { Copy, Download, FileText } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { DropdownItem, DropdownMenu } from '../../components/ui/DropdownMenu';
import { formatShortDate } from '../../lib/dates';
import { saveBlob } from '../../lib/download';
import { noteSourceUrl } from '../../services/githubContent';
import type { LectureNote, Material, Note, SubjectInfo } from '../../types/models';
import { loadPdfTexts } from '../search/searchIndex';
import { buildSubjectDigest, estimateTokens } from './aiDigest';

interface AiDigestButtonProps {
  subjectName: string;
  info: SubjectInfo[];
  notes: LectureNote[];
  materials: Material[];
  links: { title: string; url: string }[];
  personalNotes: Note[];
  today: string;
}

/** «Для ИИ»: все конспекты и материалы предмета одним .md — скачать или скопировать и отдать ChatGPT / Claude */
export function AiDigestButton({ today, ...data }: AiDigestButtonProps) {
  const [status, setStatus] = useState('');

  async function build() {
    // Текст PDF — из индекса поиска группы (~1,6 МБ), грузится, только если у предмета есть PDF
    const pdf = data.notes.some((note) => note.contentType === 'pdf') ? await loadPdfTexts() : new Map<string, string>();
    return buildSubjectDigest({
      ...data,
      sourceUrl: noteSourceUrl,
      pdfText: (note) => (note.sourceRef ? pdf.get(note.sourceRef) : undefined),
      date: formatShortDate(today, 'long'),
    });
  }

  function done(text: string, action: string) {
    setStatus(`${action} · ≈ ${Math.max(1, Math.round(estimateTokens(text) / 1000))} тыс. токенов`);
    setTimeout(() => setStatus(''), 4000);
  }

  return (
    <DropdownMenu
      align="end"
      trigger={(props) => (
        <Button variant="secondary" icon={FileText} {...props}>
          {status || 'Для ИИ'}
        </Button>
      )}
    >
      <DropdownItem
        icon={Download}
        onSelect={() =>
          void build().then((text) => {
            saveBlob(new Blob([text], { type: 'text/markdown;charset=utf-8' }), `${data.subjectName.replace(/[\\/:*?"<>|]/g, '_')} — для ИИ.md`);
            done(text, 'Скачано');
          })
        }
      >
        Скачать .md
      </DropdownItem>
      <DropdownItem
        icon={Copy}
        onSelect={() =>
          void build().then(async (text) => {
            await navigator.clipboard.writeText(text);
            done(text, 'Скопировано');
          })
        }
      >
        Скопировать текст
      </DropdownItem>
    </DropdownMenu>
  );
}
