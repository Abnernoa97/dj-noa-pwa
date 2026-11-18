import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rec,list,str,num,int,nextDate,statusView,marketView,marketConsensus} from '../worker/src/sports/shared/espnCore.ts';

test('ESPN shared primitives preserve MLB and NBA parsing exactly', () => {
  assert.deepEqual(rec(null), {});
  assert.deepEqual(rec(['x']), {});
  assert.deepEqual(rec({ title: 'hit' }), { title: 'hit' });
  assert.deepEqual(list(null), []);
  assert.deepEqual(list([1, 2]), [1, 2]);
  assert.equal(str(20), '');
  assert.equal(str('NY'), 'NY');
  assert.equal(num(''), 0); // Legacy accepted blank numeric string as zero.
  assert.equal(num('2.5'), 2.5);
  assert.equal(num('bad'), undefined);
  assert.equal(num(Infinity), undefined);
  assert.equal(int('5.75'), 5);
  assert.equal(int('bad', 7), 7);
  assert.equal(nextDate('2026-12-31'), '2027-01-01');
  assert.equal(nextDate('2028-02-28'), '2028-02-29');
});

test('ESPN game status retains live, post-game and scheduled defaults', () => {
  assert.deepEqual(statusView({ type: { state: 'in', shortDetail: 'Q3' } }), { status:'live', statusText:'Q3' });
  assert.deepEqual(statusView({ type: { state: 'post' } }), { status:'final', statusText:'FINAL' });
  assert.deepEqual(statusView({ type: { state:'pre' }, displayClock:'7 PM' }), { status:'scheduled', statusText:'7 PM' });
  assert.deepEqual(statusView(null), { status:'scheduled', statusText:'PROGRAMADO' });
});

test('ESPN market parsing preserves first provider, five-book limit and no-zero rule', () => {
  const competition = { odds: [
    {awayTeamOdds:{moneyLine:-110},homeTeamOdds:{moneyline:100},provider:{name:'Book One'}},
    {awayMoneyLine:-120,homeMoneyline:105,provider:{displayName:'Book Two'}},
    {awayMoneyLine:-130,homeMoneyLine:110,provider:{name:'book one'}},
    {awayMoneyLine:0,homeMoneyLine:140,provider:{name:'ignored'}}
  ]};
  const books = marketView(competition);
  assert.deepEqual(books, [
    {provider:'Book One',away:-110,home:100},
    {provider:'Book Two',away:-120,home:105}
  ]);
  assert.deepEqual(marketView({odds:[{awayMoneyLine:-110,homeMoneyLine:110}]}),[{provider:'Mercado',away:-110,home:110}]);
  assert.equal(marketView({odds:[{awayMoneyLine:0,homeMoneyLine:100}]}).length,0);
  assert.equal(marketView({odds:Array.from({length:12},(_,i)=>({awayMoneyLine:-100-i,homeMoneyLine:100+i,provider:{name:'B'+i}}))}).length,5);
});

test('ESPN consensus conserves single-book prices and rounded probability average', () => {
  assert.deepEqual(marketConsensus([]), {});
  assert.deepEqual(marketConsensus([{provider:'A',away:-110,home:100}]), {away:-110,home:100});
  const result=marketConsensus([{provider:'A',away:-110,home:100},{provider:'B',away:-120,home:105}]);
  assert.equal(typeof result.away,'number');
  assert.equal(typeof result.home,'number');
  assert.ok(Number.isInteger(result.away));
  assert.ok(Number.isInteger(result.home));
});

test('MLB and NBA delegate to a single ESPN helper implementation', () => {
  for(const league of ['mlb','nba']){
    const code=readFileSync(new URL('../worker/src/sports/'+league+'.ts',import.meta.url),'utf8');
    assert.match(code,/from '\.\/shared\/espnCore'/);
    for(const fn of ['rec','list','str','num','int','nextDate','statusView','marketMoneyLine','marketView','impliedProbability','americanFromProbability','marketConsensus']){
      assert.doesNotMatch(code,new RegExp('\\bfunction '+fn+'\\('),'local duplicate '+fn+' in '+league);
    }
  }
});
