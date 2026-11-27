import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseFormula,formulaValue} from '../src/domains/sheet/sheetFormula.ts';

test('custom-sheet formula preserves arithmetic precedence, parentheses and variable substitution',()=>{
 assert.equal(parseFormula('1 + 2 * 3',{}),7);
 assert.equal(parseFormula('=(1 + 2) * 3',{}),9);
 assert.equal(parseFormula('income-expense',{income:500,expense:70}),430);
 assert.equal(parseFormula('50/0',{}),0);
 assert.equal(parseFormula('-20+2',{}),-18);
});
test('invalid formulas return null, no evaluation of JS or global expressions',()=>{
 assert.equal(parseFormula('process.exit(1)',{}),null);
 assert.equal(parseFormula('1;2',{}),null);
 assert.equal(parseFormula('3 / / 2',{}),null);
 assert.equal(parseFormula('1 +',{}),null);
 assert.equal(parseFormula('3 * -',{}),null);
 assert.equal(parseFormula('(2+3',{}),null);
 assert.equal(parseFormula('3 % 2',{}),null);
});
test('row value resolver delegates to the same pure formula evaluator and never mutates amounts',()=>{
 const cols=[
  {id:'one',key:'cash',type:'currency'},
  {id:'calc',key:'calculated',type:'formula',formula:'=(amount + cash) / 2'}
 ];
 const row={id:'r',amount:100,values:{cash:30},currency:'USD'};
 assert.equal(formulaValue(cols[1],row,cols),65);
 assert.equal(formulaValue(cols[0],row,cols),30);
 assert.equal(row.amount,100);
 assert.equal(row.values.cash,30);
});
test('Excel component imports formula engine from domain, never embeds a second parser',()=>{
 const src=readFileSync(new URL('../src/features/excel/SheetWorkspace.tsx',import.meta.url),'utf8');
 assert.match(src,/from '\.\.\/\.\.\/domains\/sheet\/sheetFormula'/);
 assert.doesNotMatch(src,/function parseFormula\(/);
 assert.doesNotMatch(src,/function formulaValue\(/);
});
