// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { useGroupStore } from '../group/groupStore';
import { useHomeworkStore } from '../homework/homeworkStore';
import { syncClassicMarks } from './classicMarksSync';

beforeEach(() => {
  localStorage.clear();
  useHomeworkStore.setState({ done: {} });
  useGroupStore.setState({ deadlinesDone: {} });
});

function setClassic() {
  localStorage.setItem('m3102-hw-done-v1', JSON.stringify({ 'hw-1': '2026-10-08T23:00:52.587Z', 'hw-2': null }));
  localStorage.setItem('m3102-study-plan-v1', JSON.stringify({ tasks: [], done: { 'deadline:dm-hw': true, 'deadline:op-lab1': false } }));
}

describe('отметки из классической версии подхватываются сами', () => {
  it('добавляет выполненные ДЗ и дедлайны, её ключи не меняет, повторно ничего не дублирует', () => {
    setClassic();
    const before = [localStorage.getItem('m3102-hw-done-v1'), localStorage.getItem('m3102-study-plan-v1')];
    expect(syncClassicMarks()).toBe(2);
    expect(useHomeworkStore.getState().done).toEqual({ 'hw-1': '2026-10-08T23:00:52.587Z' });
    expect(useGroupStore.getState().deadlinesDone).toEqual({ 'dm-hw': true });
    expect([localStorage.getItem('m3102-hw-done-v1'), localStorage.getItem('m3102-study-plan-v1')]).toEqual(before);
    expect(syncClassicMarks()).toBe(0);
  });

  it('снял отметку в приложении — при следующем открытии она не возвращается', () => {
    setClassic();
    syncClassicMarks();
    useHomeworkStore.getState().toggleDone('hw-1', false);
    useGroupStore.setState({ deadlinesDone: {} });
    expect(syncClassicMarks()).toBe(0);
    expect(useHomeworkStore.getState().done).toEqual({});
    expect(useGroupStore.getState().deadlinesDone).toEqual({});
  });

  it('новая отметка, поставленная в классической позже, подхватывается; значение приложения побеждает', () => {
    setClassic();
    syncClassicMarks();
    localStorage.setItem('m3102-hw-done-v1', JSON.stringify({ 'hw-1': '2026-10-08T23:00:52.587Z', 'hw-3': '2026-10-16T10:00:00.000Z' }));
    expect(syncClassicMarks()).toBe(1);
    expect(useHomeworkStore.getState().done['hw-3']).toBe('2026-10-16T10:00:00.000Z');
  });

  it('классической нет — ничего не происходит', () => {
    expect(syncClassicMarks()).toBe(0);
  });
});
