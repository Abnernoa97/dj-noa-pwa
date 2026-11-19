import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { blobToDataUrl } from '../src/services/media/blobDataUrl.ts';

test('both consumers use canonical blob reader and retain distinct failure policies',()=>{
 for(const f of ['src/features/noah/NoahImageIntake.tsx','src/services/storage/dataBackup.ts']){
  const s=readFileSync(new URL('../'+f,import.meta.url),'utf8');
  assert.match(s,/import \{ blobToDataUrl \} from/);
  assert.doesNotMatch(s,/function blobToDataUrl\(/);
 }
 const backup=readFileSync(new URL('../src/services/storage/dataBackup.ts',import.meta.url),'utf8');
 assert.match(backup,/preferNativeError: true/);
 assert.match(backup,/errorMessage: 'photo_read_failed'/);
});
test('FileReader succeeds with same data URL and defaults to original AI error code',async()=>{
 const prior=globalThis.FileReader;
 try {
  globalThis.FileReader=class {
   readAsDataURL(_blob){this.result='data:image/png;base64,QUJD';this.onload();}
  };
  assert.equal(await blobToDataUrl(new Blob(['ABC'])),'data:image/png;base64,QUJD');
  globalThis.FileReader=class {
   error=null;
   readAsDataURL(_blob){this.onerror();}
  };
  await assert.rejects(blobToDataUrl(new Blob(['x'])),/file_read_failed/);
  await assert.rejects(blobToDataUrl(new Blob(['x']),{errorMessage:'photo_read_failed',preferNativeError:true}),/photo_read_failed/);
 } finally {globalThis.FileReader=prior;}
});
