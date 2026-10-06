import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const visibility = html.split('const HIDDEN_FILE_NAMES=')[1].split('function ext(')[0];
const planner = html.split('const PLAN_KEY=')[1].split('function renderPlan(){')[0];
const storage = new Map();
const localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
};
const code = `const PLAN_KEY=${planner};({readPlan})`;
const { readPlan } = vm.runInNewContext(code, { Date, localStorage });
const { isHiddenPath } = vm.runInNewContext(`const HIDDEN_FILE_NAMES=${visibility};({isHiddenPath})`);

for (const path of ['README.md', '.gitignore', 'package.json', 'data/schedule.json', 'js/schedule.js', 'css/schedule.css']) assert.equal(isHiddenPath(path), true, path);
assert.equal(isHiddenPath('Конспекты/ДМ/main.md'), false);

storage.set('m3102-study-plan-v1', '{broken');
assert.deepEqual(JSON.parse(JSON.stringify(readPlan())), { tasks: [], done: {} });
storage.set('m3102-study-plan-v1', JSON.stringify({ tasks: [{ id: 'a', name: 'Задача' }], done: { a: true } }));
assert.equal(readPlan().done.a, true);
console.log('Smoke checks passed');
