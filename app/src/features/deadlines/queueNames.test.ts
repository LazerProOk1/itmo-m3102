import { M3102_STUDENTS } from '../../data/m3102';
import { describe, expect, it } from 'vitest';
import { hasExtraText, queueLogin, queuePerson, studentName } from './queueNames';

describe('очередь: кто стоит', () => {
  it('логин без учёта регистра → «Имя Фамилия»; чужой логин — нет', () => {
    expect(studentName('alexgromov63')).toBe('Алексей Громов');
    expect(studentName('someone-else')).toBeUndefined();
  });

  it('приписка — только если в ней что-то сверх имени', () => {
    const name = 'Алексей Громов';
    expect(hasExtraText('Алексей Громов...(', name)).toBe(false);
    expect(hasExtraText('Алексей Г.', name)).toBe(false);
    expect(hasExtraText('алексей (10.10.26)', name)).toBe(true);
    expect(hasExtraText('Ладно Федя, я начну', name)).toBe(true);
    expect(hasExtraText('Серёжа', 'Сергей Долинский')).toBe(false);
    expect(hasExtraText('даня', 'Даниил Дрей')).toBe(false);
  });

  it('записал друга — показываем друга (по фамилии), автор — припиской', () => {
    expect(queuePerson('максим еланский', 'zur1kov')).toEqual({ name: 'Максим Еланский', note: 'записал(а) Андрей Зюриков' });
    expect(queuePerson('андрей (10.10.26)', 'zur1kov')).toEqual({ name: 'Андрей Зюриков', note: 'андрей (10.10.26)' });
    expect(queuePerson('Артём Д', 'artemiks727')).toEqual({ name: 'Артём Давалов', note: undefined });
    expect(queuePerson('Гость', 'stranger')).toEqual({ name: 'Гость', note: '@stranger', outside: true });
    // Имя и инициал, уменьшительное; а «Артём Д» подходит двоим — это не друг, а автор
    expect(queuePerson('Макс Е.', 'zur1kov')).toEqual({ name: 'Максим Еланский', note: 'записал(а) Андрей Зюриков' });
    expect(queuePerson('Артём Д', 'zur1kov')).toEqual({ name: 'Андрей Зюриков', note: 'Артём Д' });
    // Без имени — по автору; аккаунт не из группы получает значок, даже когда записал студента
    expect(queuePerson('', 'zur1kov')).toEqual({ name: 'Андрей Зюриков', note: undefined });
    expect(queuePerson('', 'stranger')).toEqual({ name: '(без имени)', note: '@stranger', outside: true });
    expect(queuePerson('максим еланский', 'stranger')).toEqual({
      name: 'Максим Еланский',
      note: 'записал(а) @stranger',
      outside: true,
    });
    // Профиль — того, кто стоит, а не того, кто записал
    expect(queueLogin('максим еланский', 'zur1kov')).toBe(M3102_STUDENTS.find((student) => student.name.startsWith('Еланский'))?.github);
    expect(queueLogin('андрей (10.10.26)', 'zur1kov')).toBe('zur1kov');
    expect(queueLogin('Гость', 'stranger')).toBeUndefined();
  });
});
