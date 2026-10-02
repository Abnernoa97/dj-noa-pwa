import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/NoahImageIntake.tsx', import.meta.url), 'utf8');

test('Noah image intake supports a guarded batch of up to five images', () => {
  assert.match(source, /multiple/);
  assert.match(source, /slice\(0, 5\)/);
  assert.match(source, /for \(let index = 0; index < files\.length; index \+= 1\)/);
  assert.match(source, /Cada imagen se analiza por separado/);
  assert.match(source, /new Map<string, NoahChatAction>\(\)/);
});
