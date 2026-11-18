import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
const file=new URL('../scripts/audit-semantic.mjs',import.meta.url);
test('semantic duplication scanner is read-only and scans separate production and paused cloud scopes',()=>{
 const src=readFileSync(file,'utf8');
 for(const scope of ["'src'","'worker/src'","'dj-noa-cloud/src'"])assert.ok(src.includes(scope));
 assert.match(src,/READ-ONLY|Read-only|read-only/);
 assert.doesNotMatch(src,/\b(?:writeFile|unlink|rmSync|rmdir|execSync|spawnSync|fork)\s*\(/);
 assert.doesNotMatch(src,/\b(?:fetch|XMLHttpRequest)\s*\(/);
 assert.match(src,/postcss\.parse/);
 assert.match(src,/ts\.createSourceFile/);
});
test('semantic auditor is repeatable via Cloudflare build but never gates build on a CSS match',()=>{
 const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
 assert.equal(pkg.scripts['audit:semantics'],'node scripts/audit-semantic.mjs');
 assert.match(pkg.scripts.build,/npm run audit:semantics/);
 assert.ok(existsSync(file));
});
