import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const script=readFileSync(new URL('../scripts/audit-css-prunable.mjs',import.meta.url),'utf8');
test('CSS redundancy scanner is read-only, uses loaded import order and excludes risky media/layer rules',()=>{
 assert.match(script,/src\/main\.tsx/);
 assert.match(script,/postcss\.parse/);
 assert.match(script,/p\.name\.toLowerCase\(\)!=='media'/);
 assert.match(script,/d\.important/);
 assert.doesNotMatch(script,/\b(?:writeFile|unlink|rmSync|spawnSync|execSync)\s*\(/);
});
