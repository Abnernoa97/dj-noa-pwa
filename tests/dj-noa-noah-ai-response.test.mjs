import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readText, parseJsonObject } from '../worker/src/noah/aiResponse.ts';
test('Noah chat and vision extract the same text from Cloudflare model responses',()=>{
 assert.equal(readText({choices:[{message:{content:'  Hola  '}}]}),'Hola');
 assert.equal(readText({response:'  Respaldo  '}),'Respaldo');
 assert.equal(readText({choices:[{message:{content:''}}],response:'fallback'}),'fallback');
 assert.equal(readText(null),'');
});
test('same strict/fenced JSON fallback and invalid response semantics',()=>{
 assert.deepEqual(parseJsonObject('{"ok":true}'),{ok:true});
 assert.deepEqual(parseJsonObject('texto previo {"value":2} comentario'),{value:2});
 assert.equal(parseJsonObject('sin datos'),null);
 assert.equal(parseJsonObject('{"bad":'),null);
});
test('Noah chat and vision both delegate without local text/JSON parser clones',()=>{
 for(const name of ['noahChat','noahImage']){
  const code=readFileSync(new URL('../worker/src/noah/'+name+'.ts',import.meta.url),'utf8');
  assert.match(code,/import \{ readText, parseJsonObject \} from '\.\/aiResponse'/);
  assert.doesNotMatch(code,/function readText\(/);
  assert.doesNotMatch(code,/function parseJsonObject\(/);
 }
});
