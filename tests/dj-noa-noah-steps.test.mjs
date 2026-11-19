import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { financeText, patchEntries, progressSteps, matrixSteps, calendarSeriesSteps } from '../src/features/noah/noahActionSteps.ts';

test('Noah progress formatting retains the previous field list and step states', () => {
 const entries = patchEntries({ title:'Evento', time:'20:00', showTime:'21:00' });
 assert.deepEqual(entries, [['title','Evento'], ['showTime','21:00']]);
 const pending = progressSteps(entries, 'create', 1);
 assert.equal(pending.length, 4);
 assert.deepEqual(pending.map(x=>x.state), ['done','active','pending','pending']);
 const complete = progressSteps(entries, 'create', 4, true);
 assert.ok(complete.every(x=>x.state==='done'));
 assert.equal(complete[2].label, 'Show');
});

test('Noah matrix and calendar series keep the same finance/currency display without writes', () => {
 const finance = { amount: 1250, currency:'USD' };
 assert.ok(financeText(finance).includes('1,250') || financeText(finance).includes('1250') || financeText(finance).includes('1250'));
 const matrix = matrixSteps('Boda', '2027-01-01', finance, 0);
 assert.deepEqual(matrix.map(x=>x.id), ['matrix-calendar','matrix-event','matrix-excel','matrix-link']);
 assert.equal(matrix[0].state,'active');
 assert.equal(matrixSteps('Boda','2027-01-01',undefined,4,true).length, 3);
 const series = calendarSeriesSteps(2,3,'Enero',finance);
 assert.deepEqual(series.map(x=>x.id), ['series-pattern','series-calendar','series-write','series-excel','series-save']);
 assert.equal(series[2].state,'active');
});

test('Noah step presentations have a single implementation outside the App coordinator',()=>{
 const app=readFileSync(new URL('../src/app/App.tsx', import.meta.url),'utf8');
 const coordinator=readFileSync(new URL('../src/app/controllers/noahActionCoordinator.ts',import.meta.url),'utf8');
 const steps=readFileSync(new URL('../src/features/noah/noahActionSteps.ts', import.meta.url),'utf8');
 assert.match(app,/createNoahActionExecutor\(/);
 assert.match(coordinator,/from '\.\.\/\.\.\/features\/noah\/noahActionSteps'/);
 for(const fn of ['financeText','patchEntries','progressSteps','matrixSteps','calendarSeriesSteps']){
  assert.doesNotMatch(app,new RegExp('function '+fn+'\\('),fn);
  assert.match(steps,new RegExp('export function '+fn+'\\('),fn);
 }
 assert.doesNotMatch(steps,/db\.transaction|indexedDB|createEventWithRelations|fetch\(/);
});
