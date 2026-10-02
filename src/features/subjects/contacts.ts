import type { ClassSession, ID, SubjectContact } from '../../types/models';

/** "@ivanova" или "ivanova" → полная ссылка; уже полную ссылку возвращает как есть */
export function telegramUrl(handle: string): string {
  const trimmed = handle.trim();
  if (/^https?:\/\//.test(trimmed)) return trimmed;
  return `https://t.me/${trimmed.replace(/^@/, '')}`;
}

/** Уникальные пары (тип занятия → преподаватель) из реального расписания предмета, без дублей */
export function getSubjectContacts(subjectId: ID, classes: ClassSession[]): SubjectContact[] {
  const seen = new Set<string>();
  const result: SubjectContact[] = [];

  for (const session of classes) {
    if (session.subjectId !== subjectId) continue;
    const key = `${session.type}:${session.teacher}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ role: session.type, teacherName: session.teacher });
  }

  return result;
}

function sameTeacher(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Контакты предмета для отображения: если в расписании есть занятия этого предмета, роль и имя
 * преподавателя всегда берутся из него (Exception важнее обычного занятия — сюда не попадают,
 * это агрегат по регулярному расписанию). Ручные записи в этом случае используются только как
 * источник email/telegram для того же преподавателя и той же роли. Если занятий ещё нет —
 * ручные записи остаются как есть (fallback).
 */
export function resolveSubjectContacts(subjectId: ID, classes: ClassSession[], manualContacts: SubjectContact[]): SubjectContact[] {
  const computed = getSubjectContacts(subjectId, classes);
  if (computed.length === 0) return manualContacts;

  return computed.map((contact) => {
    const manual = manualContacts.find((entry) => entry.role === contact.role && sameTeacher(entry.teacherName, contact.teacherName));
    return { ...contact, email: manual?.email, telegram: manual?.telegram };
  });
}
