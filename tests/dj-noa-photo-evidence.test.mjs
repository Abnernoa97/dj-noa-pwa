import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reconcilePhotoReads } from '../src/noahImageReconcile.ts';

const image = (fileName, ...visualItems) => ({ fileName, visualItems });
const event = (title, dateISO, details={}) => ({
  kind:'event', title, dateISO, confidence:'high', ...details
});
const payment = (title, dateISO, eventTitle, eventDateISO, details={}) => ({
  kind:'payment', title, dateISO, eventTitle, eventDateISO,
  confidence:'high', amountRole:'deposit', currency:'MXN', amount:10000,
  paymentStatus:'paid', evidence:'Anticipo recibido 10000 MXN', ...details
});

test('photos of an advance produce a separate row dated when payment occurred',()=>{
  const result = reconcilePhotoReads([
    image('Foto 1 · evento.jpg',event('Flora Farms','2026-11-20',{venue:'Flora Farms'})),
    image('Foto 2 · recibo.jpg',payment('Anticipo', '2026-10-14','Flora Farms','2026-11-20'))
  ],[]);
  assert.equal(result.actions.length,2);
  const p=result.actions.find(x=>x.action.type==='create_sheet_row');
  assert.ok(p);
  assert.deepEqual(p.sources,['Foto 2 · recibo.jpg']);
  assert.equal(p.action.row.eventTitle,'Flora Farms');
  assert.equal(p.action.row.eventDateISO,'2026-11-20');
  assert.equal(p.action.row.calendarDate,'2026-10-14');
  assert.equal(p.action.row.status,'paid');
  assert.equal(p.action.row.amount,10000);
  assert.equal(p.action.row.currency,'MXN');
  assert.equal(result.actions[0].action.finance,undefined,'the deposit is not the event fee');
});

test('duplicated screenshots of the same receipt produce one payment with multiple evidence sources',()=>{
  const x=reconcilePhotoReads([
    image('Foto 1 · recibo.png',payment('Anticipo','2026-10-14','Flora Farms','2026-11-20')),
    image('Foto 2 · recibo.png',payment('Anticipo','2026-10-14','Flora Farms','2026-11-20'))
  ],[{title:'Flora Farms',date:'2026-11-20'}]);
  assert.equal(x.actions.length,1);
  assert.equal(x.actions[0].action.type,'create_sheet_row');
  assert.deepEqual(x.actions[0].sources,['Foto 1 · recibo.png','Foto 2 · recibo.png']);
});

test('payments without an exact matching event, both dates and currency must remain unfiled',()=>{
  for(const override of [
    {eventDateISO:null},
    {eventTitle:''},
    {dateISO:null},
    {currency:'$'},
    {eventTitle:'Unknown'},
    {amount:0}
  ]){
    const data=payment('Anticipo','2026-10-14','Flora Farms','2026-11-20',override);
    const x=reconcilePhotoReads([image('Foto 1 · recibo.jpg',data)],[]);
    assert.equal(x.actions.length,0,JSON.stringify(override));
    assert.ok(x.warnings.length,JSON.stringify(override));
  }
});

test('a payment for an existing exact event may be reviewed without updating that event',()=>{
  const x=reconcilePhotoReads([
    image('Foto 1 · recibo.jpg',payment('Pago','2026-10-12','Flora Farms','2026-11-20',{amountRole:'payment',paymentStatus:'pending'}))
  ],[{title:'Flora Farms',date:'2026-11-20'}]);
  assert.equal(x.actions.length,1);
  assert.equal(x.actions[0].action.type,'create_sheet_row');
  assert.equal(x.actions[0].action.row.status,'pending');
});

test('event total and deposit are distinct, never interpreted as the same amount',()=>{
  const x=reconcilePhotoReads([
    image('Foto 1 · evento.jpg',event('Flora Farms','2026-11-20',{amount:25000,currency:'MXN',amountRole:'fee'})),
    image('Foto 2 · anticipo.jpg',payment('Anticipo','2026-10-14','Flora Farms','2026-11-20'))
  ],[]);
  assert.equal(x.actions.length,2);
  const e=x.actions.find(p=>p.action.type==='create_event');
  const p=x.actions.find(p=>p.action.type==='create_sheet_row');
  assert.equal(e.action.finance.amount,25000);
  assert.deepEqual(e.financeSources,['Foto 1 · evento.jpg']);
  assert.equal(p.action.row.amount,10000);
  assert.equal(p.action.row.calendarDate,'2026-10-14');
});

test('source photos and all records commit atomically, originals and extracted text are preserved locally',()=>{
  const commit=readFileSync(new URL('../src/noahVisionCommit.ts',import.meta.url),'utf8');
  const ui=readFileSync(new URL('../src/NoahImageIntake.tsx',import.meta.url),'utf8');
  const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
  const worker=readFileSync(new URL('../worker/src/noahImage.ts',import.meta.url),'utf8');
  assert.match(commit,/db\.transaction\('rw', \[db\.events, db\.sheetRows, db\.eventPhotos, db\.sheetPhotos\]/);
  assert.match(commit,/crypto\.subtle\.digest\('SHA-256'/);
  assert.match(commit,/sourceEvidence: source\.rawText/);
  assert.match(commit,/blob: source\.file/);
  assert.match(commit,/calendarDateSource: 'manual'/);
  assert.match(ui,/visionSources\.current\.push/);
  assert.match(ui,/await onApply\(proposals, visionSources\.current\)/);
  assert.match(app,/await commitNoahVision\(proposals, sources\)/);
  assert.match(worker,/eventDateISO:/);
  assert.match(ui,/review\?\.sources\.join/);
});
