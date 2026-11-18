import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('the dependency inventory is read-only and never deletes unreferenced files', () => {
  const path=new URL('../scripts/audit-candidates.mjs',import.meta.url);
  const code=readFileSync(path,'utf8');
  assert.match(code,/reviewOnlyCandidates/);
  assert.match(code,/Ningun archivo se borra/);
  assert.doesNotMatch(code,/\b(?:unlink|rmdir|rmSync|writeFile|execSync|spawnSync)\s*\(/);
  assert.doesNotMatch(code,/\b(?:fetch|XMLHttpRequest)\s*\(/);
  const p=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
  assert.match(p.scripts.build,/npm run audit:structure && npm run audit:candidates &&/);
  assert.match(p.scripts.build,/&& npm run audit:semantics && npm run typecheck/);
});

test('Cloudflare is responsible for build and deploy; GitHub Actions stays disabled', () => {
  const audit=readFileSync(new URL('../scripts/audit-structure.mjs',import.meta.url),'utf8');
  const wrangler=readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8');
  assert.match(audit,/GitHub Actions no autorizado/);
  assert.match(wrangler,/"name"\s*:\s*"dj-noa-pwa"/);
});
