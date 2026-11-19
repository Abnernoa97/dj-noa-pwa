import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');

test('Events, Calendar and Tasks have unique chapter source files and no root clones',()=>{
const moved={
  'src/EventWorkspace.tsx':'src/features/events/EventWorkspace.tsx',
  'src/CalendarWorkspace.tsx':'src/features/calendar/CalendarWorkspace.tsx',
  'src/ReminderWorkspace.tsx':'src/features/tasks/ReminderWorkspace.tsx',
  'src/eventIntegrity.ts':'src/domains/events/eventIntegrity.ts',
  'src/eventMutations.ts':'src/domains/events/eventMutations.ts',
  'src/eventSchedule.ts':'src/domains/events/eventSchedule.ts',
  'src/reminderNotifications.ts':'src/features/tasks/reminderNotifications.ts'
};
for(const [oldPath,canonical] of Object.entries(moved)){
 assert.equal(existsSync(new URL(oldPath,root)),false,'Old copy present '+oldPath);
 assert.equal(existsSync(new URL(canonical,root)),true,'Chapter missing '+canonical);
}
});
test('Event mutation contract stays single and Event/Calendar/Tasks routes remain wired',()=>{
const app=read('src/app/App.tsx');
assert.match(app,/from '\.\.\/domains\/events\/eventMutations'/);
assert.match(app,/from '\.\.\/features\/events\/EventWorkspace'/);
assert.match(app,/lazy\(\(\) => import\('\.\.\/features\/calendar\/CalendarWorkspace'\)\)/);
assert.match(app,/lazy\(\(\) => import\('\.\.\/features\/tasks\/ReminderWorkspace'\)\)/);
const mutations=read('src/domains/events/eventMutations.ts');
assert.match(mutations,/db\.transaction\('rw', \[db\.events, db\.sheetRows, db\.reminders\]/);
assert.match(mutations,/eventLinkedReminderPatch\(/);
const schedule=read('src/domains/events/eventSchedule.ts');
assert.match(schedule,/eventLinkedReminderPatch/);
});
