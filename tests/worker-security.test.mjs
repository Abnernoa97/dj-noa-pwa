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

test('new Noah voice chat is same-origin and legacy assistant routes are gone', () => {
  const voice = read('src/NoahVoice.tsx');
  const entry = read('worker/src/entry.ts');

  assert.match(voice, /fetch\('\/api\/noah-chat'/);
  assert.equal(voice.includes('VITE_DJNOA_WORKER_URL'), false);
  assert.equal(entry.includes("'/api/assistant'"), false);
  assert.equal(entry.includes("'/api/transcribe'"), false);
  assert.equal((entry.match(/url\.pathname === '\/api\/noah-chat'/g) || []).length, 1);
  assert.equal((entry.match(/url\.pathname === '\/api\/noah-image'/g) || []).length, 1);
  assert.match(entry, /requestComesFromApp/);
  assert.match(entry, /enforceRateLimit/);
});

test('legacy wake-word and recorder frontend modules are deleted', () => {
  assert.equal(existsSync(new URL('../src/useDjNoaVoice.ts', import.meta.url)), false);
  assert.equal(existsSync(new URL('../src/ConversationDock.tsx', import.meta.url)), false);
  assert.equal(existsSync(new URL('../src/voice/transcript.ts', import.meta.url)), false);
  assert.equal(existsSync(new URL('../src/voice/recognitionTypes.ts', import.meta.url)), false);
});

test('base Worker owns only health, push, reminders and assets', () => {
  const base = read('worker/src/index.ts');
  assert.match(base, /'\/api\/health'/);
  assert.match(base, /startsWith\('\/api\/push\/'\)/);
  assert.match(base, /startsWith\('\/api\/reminders\/'\)/);
  assert.match(base, /env\.ASSETS\.fetch\(request\)/);
  assert.equal(base.includes('dj-noa-ai'), false);
});


test('Noah image analysis is grounded in a real multimodal vision pass', () => {
  const imageWorker = read('worker/src/noahImage.ts');
  assert.match(imageWorker, /type: 'image_url'/);
  assert.match(imageWorker, /image_url: \{ url: image \}/);
  assert.match(imageWorker, /visionPrompt\(\)/);
  assert.match(imageWorker, /planningPrompt\(contextText, visualGrounding\)/);
  assert.match(imageWorker, /actionGrounded/);
  assert.equal(/\n\s*image,\n/.test(imageWorker), false);
});
