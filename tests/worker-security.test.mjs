import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('uses one canonical Wrangler config and one Worker entrypoint', () => {
  const wrangler = JSON.parse(read('wrangler.jsonc'));
  assert.equal(wrangler.name, 'dj-noa-pwa');
  assert.equal(wrangler.main, 'worker/src/entry.ts');
  assert.equal(wrangler.assets?.binding, 'ASSETS');
  assert.deepEqual(wrangler.assets?.run_worker_first, ['/api/*']);
  assert.equal(existsSync(new URL('../worker/wrangler.jsonc', import.meta.url)), false);
  assert.equal(existsSync(new URL('../worker/wrangler.toml', import.meta.url)), false);
  assert.equal(existsSync(new URL('../worker/package.json', import.meta.url)), false);
});

test('frontend API calls are same-origin and have no legacy Worker URL override', () => {
  const memory = read('src/assistantMemory.ts');
  const voice = read('src/useDjNoaVoice.ts');
  const reminders = read('src/reminderNotifications.ts');

  assert.equal(memory.includes('VITE_DJNOA_WORKER_URL'), false);
  assert.equal(memory.includes('djnoa.workerUrl'), false);
  assert.match(memory, /fetch\('\/api\/assistant'/);
  assert.equal(voice.includes('VITE_DJNOA_WORKER_URL'), false);
  assert.equal(voice.includes('/api/transcribe'), false);
  assert.equal(voice.includes('fetch('), false);
  assert.match(reminders, /fetch\('\/api\/push\/key'/);
  assert.match(reminders, /fetch\('\/api\/push\/subscribe'/);
  assert.match(reminders, /fetch\('\/api\/reminders\/sync'/);
  assert.match(reminders, /fetch\('\/api\/push\/test'/);
  assert.equal(reminders.includes('window.location.origin'), false);
});

test('sensitive AI routes have a single owner in the Worker router', () => {
  const entry = read('worker/src/entry.ts');
  const base = read('worker/src/index.ts');

  assert.equal((entry.match(/url\.pathname === '\/api\/assistant'/g) || []).length, 1);
  assert.equal((entry.match(/url\.pathname === '\/api\/transcribe'/g) || []).length, 1);
  assert.equal(base.includes("url.pathname === '/api/assistant'"), false);
  assert.equal(base.includes("url.pathname === '/api/transcribe'"), false);
  assert.match(entry, /requestComesFromApp/);
  assert.match(entry, /enforceRateLimit/);
  assert.match(entry, /MAX_ASSISTANT_BYTES/);
  assert.match(entry, /MAX_AUDIO_BYTES/);
});

test('base Worker owns only health, push, reminders and assets', () => {
  const base = read('worker/src/index.ts');
  assert.match(base, /'\/api\/health'/);
  assert.match(base, /startsWith\('\/api\/push\/'\)/);
  assert.match(base, /startsWith\('\/api\/reminders\/'\)/);
  assert.match(base, /env\.ASSETS\.fetch\(request\)/);
  assert.equal(base.includes('dj-noa-ai'), false);
});
