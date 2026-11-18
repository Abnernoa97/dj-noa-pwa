import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');

test('Noah UI, business rules and shared media are in canonical chapters, with no root mirrors',()=>{
 const files={
  'src/NoahVoice.tsx':'src/features/noah/NoahVoice.tsx',
  'src/NoahImageIntake.tsx':'src/features/noah/NoahImageIntake.tsx',
  'src/NoahActionOverlay.tsx':'src/features/noah/NoahActionOverlay.tsx',
  'src/noahEvents.ts':'src/domains/noah/noahEvents.ts',
  'src/noahExcel.ts':'src/domains/noah/noahExcel.ts',
  'src/noahImageReconcile.ts':'src/domains/noah/noahImageReconcile.ts',
  'src/noahVisionCommit.ts':'src/domains/noah/noahVisionCommit.ts',
  'src/photoOptimization.ts':'src/services/media/photoOptimization.ts'
 };
 for(const [oldPath,newPath] of Object.entries(files)){
  assert.equal(existsSync(new URL(oldPath,root)),false,'duplicate legacy source '+oldPath);
  assert.ok(existsSync(new URL(newPath,root)),'missing new chapter source '+newPath);
 }
});
test('App routes Noah actions to the same canonical implementation and storage identity is unchanged',()=>{
 const app=read('src/app/App.tsx');
 assert.match(app,/from '\.\.\/features\/noah\/NoahVoice'/);
 assert.match(app,/from '\.\.\/features\/noah\/NoahImageIntake'/);
 assert.match(app,/from '\.\.\/domains\/noah\/noahVisionCommit'/);
 const db=read('src/db.ts');
 assert.match(db,/super\('dj-noa-local'\)/);
 const commit=read('src/domains/noah/noahVisionCommit.ts');
 assert.match(commit,/db\.transaction/);
});
