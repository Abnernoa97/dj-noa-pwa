import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const read=(path)=>readFileSync(new URL(path,root),'utf8');
test('one canonical Noah Worker chapter preserves both routes and shared action sanitizer',()=>{
 const paths=['noahChat','noahImage'];
 const entry=read('worker/src/entry.ts');
 for(const name of paths){
  assert.equal(existsSync(new URL('worker/src/'+name+'.ts',root)),false);
  assert.ok(existsSync(new URL('worker/src/noah/'+name+'.ts',root)));
  assert.ok(entry.includes("'./noah/"+name+"'"));
 }
 assert.match(entry,/url\.pathname === '\/api\/noah-chat'/);
 assert.match(entry,/url\.pathname === '\/api\/noah-image'/);
 assert.match(entry,/requestComesFromApp/);
 assert.match(entry,/enforceRateLimit/);
 const image=read('worker/src/noah/noahImage.ts');
 assert.match(image,/from '\.\/noahChat'/);
 assert.match(image,/sanitizeActions\(/);
 const config=JSON.parse(read('wrangler.jsonc'));
 assert.equal(config.main,'worker/src/entry.ts');
});
