import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nextReminderOccurrence } from '../src/domains/reminders/reminderRecurrence.ts';
import { odd, impliedProbability, shortTeamName } from '../src/features/sports/sportsPresentation.ts';
test('daily/weekly/monthly reminders keep the same date increments',()=>{
 assert.equal(nextReminderOccurrence('2026-11-18T12:30:00.000Z','daily'),'2026-11-19T12:30:00.000Z');
 assert.equal(nextReminderOccurrence('2026-11-18T12:30:00.000Z','weekly'),'2026-11-25T12:30:00.000Z');
 assert.equal(nextReminderOccurrence('2026-11-18T12:30:00.000Z','monthly'),'2026-12-18T12:30:00.000Z');
 assert.equal(nextReminderOccurrence('2026-11-18T12:30:00.000Z','none'),'2026-11-18T12:30:00.000Z');
});
test('App and ReminderWorkspace use one recurrence implementation',()=>{
 const a=readFileSync(new URL('../src/app/App.tsx',import.meta.url),'utf8');
 const b=readFileSync(new URL('../src/features/tasks/ReminderWorkspace.tsx',import.meta.url),'utf8');
 assert.match(a,/nextReminderOccurrence\(/); assert.match(b,/nextReminderOccurrence\(/);
 assert.doesNotMatch(a,/function nextReminderDate\(/);assert.doesNotMatch(b,/function nextOccurrence\(/);
});
test('SportsGameDetail delegates three helpers to the canonical sports presentation',()=>{
 const code=readFileSync(new URL('../src/features/sports/SportsGameDetail.tsx',import.meta.url),'utf8');
 assert.match(code,/impliedProbability as implied/); assert.match(code,/shortTeamName as shortTeam/);
 for(const fn of ['odd','implied','shortTeam'])assert.doesNotMatch(code,new RegExp('\\bfunction '+fn+'\\('));
 assert.equal(odd(110),'+110');assert.equal(impliedProbability(-110),110/210);assert.equal(shortTeamName('New York Yankees'),'Yankees');
});
