import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const root=new URL('../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8');
test('safety interface and backup service have one canonical folder per role',()=>{
const files={
 'src/AppMaintenance.tsx':'src/features/safety/AppMaintenance.tsx',
 'src/DataSafetyPanel.tsx':'src/features/safety/DataSafetyPanel.tsx',
 'src/dataBackup.ts':'src/services/storage/dataBackup.ts'
};
for(const [old,canonical] of Object.entries(files)){
 assert.equal(existsSync(new URL(old,root)),false,'duplicate old '+old);
 assert.ok(existsSync(new URL(canonical,root)),'missing '+canonical);
}
});
test('entry loads the safety chapter and backup remains tied to original DB',()=>{
const entry=read('src/main.tsx'),panel=read('src/features/safety/DataSafetyPanel.tsx');
assert.match(entry,/from '\.\/features\/safety\/DataSafetyPanel'/);
assert.match(entry,/from '\.\/features\/safety\/AppMaintenance'/);
assert.match(panel,/services\/storage\/dataBackup/);
const backup=read('src/services/storage/dataBackup.ts');
assert.match(backup,/downloadDjNoaBackup/);
assert.match(backup,/restoreDjNoaBackup/);
assert.match(read('src/db.ts'),/super\('dj-noa-local'\)/);
});
