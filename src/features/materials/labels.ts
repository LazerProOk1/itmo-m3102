import { File, FileText, FileType, HardDrive, Image, Link2, NotebookPen, Presentation, type LucideIcon } from 'lucide-react';
import type { LectureNoteContentType, MaterialCategory, MaterialType } from '../../types/models';

export const MATERIAL_TYPES: Record<MaterialType, { label: string; icon: LucideIcon }> = {
  pdf: { label: 'PDF', icon: FileText },
  document: { label: 'Документ', icon: File },
  presentation: { label: 'Презентация', icon: Presentation },
  image: { label: 'Изображение', icon: Image },
  link: { label: 'Ссылка', icon: Link2 },
  google_drive: { label: 'Google Drive', icon: HardDrive },
  google_docs: { label: 'Google Docs', icon: FileType },
  other: { label: 'Другое', icon: File },
};

/** Типы, которые в Google Picker/Drive открылись бы через выбор файла Google Drive */
export const GOOGLE_MATERIAL_TYPES: MaterialType[] = ['google_drive', 'google_docs'];

export const MATERIAL_CATEGORIES: Record<MaterialCategory, string> = {
  literature: 'Литература',
  assignments: 'Задания',
  presentations: 'Презентации',
  other: 'Прочее',
};

/** Маленькая иконка рядом с конспектом — сразу видно, что внутри: текст, PDF или ссылка */
export const LECTURE_NOTE_CONTENT_ICONS: Record<LectureNoteContentType, LucideIcon> = {
  markdown: NotebookPen,
  pdf: FileText,
  link: Link2,
};
