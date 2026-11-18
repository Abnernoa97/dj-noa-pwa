import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sheetFinancialPatch } from '../src/domains/sheet/sheetFinancial.ts';

const col=(key,behavior)=>({id:key,key,name:key,type:'currency',behavior,position:0,createdAt:'2026-11-18T00:00:00Z'});
const columns=[col('i','income'),col('e','expense'),col('v','investment'),col('n','neutral'),col('fallback',undefined)];

test('one Excel financial calculation preserves income-minus-expense-minus-investment semantics',()=>{
 assert.deepEqual(sheetFinancialPatch(columns,{i:100,e:30,v:20,n:5000}),{amount:50,financialType:'income'});
 assert.deepEqual(sheetFinancialPatch(columns,{i:'$25',e:'30',v:'0',n:999}),{amount:5,financialType:'expense'});
 assert.deepEqual(sheetFinancialPatch(columns,{i:20,e:10,v:10}),{amount:0,financialType:'neutral'});
 assert.deepEqual(sheetFinancialPatch(columns,{}),{amount:0,financialType:'neutral'});
 assert.deepEqual(sheetFinancialPatch(columns,{fallback:900,n:800,i:'1,250',e:'bad',v:100}),{amount:1150,financialType:'income'});
});
test('only monetary behaviors affect the signed net; no conversion or writes exist in pure helper',()=>{
 assert.deepEqual(sheetFinancialPatch([col('text','neutral')],{text:999}),{amount:0,financialType:'neutral'});
 const code=readFileSync(new URL('../src/domains/sheet/sheetFinancial.ts',import.meta.url),'utf8');
 assert.doesNotMatch(code,/\bdb\.|\bfetch\(|localStorage|indexedDB|setItem\(/);
});
test('Noah and Excel grid share one calculation while preserving distinct business guards',()=>{
 const noah=readFileSync(new URL('../src/domains/noah/noahExcel.ts',import.meta.url),'utf8');
 const grid=readFileSync(new URL('../src/features/excel/ExcelModulesEnhancer.tsx',import.meta.url),'utf8');
 assert.match(noah,/sheetFinancialPatch\(/);
 assert.match(grid,/sheetFinancialPatch\(columns, values\)/);
 assert.doesNotMatch(noah,/function financialPatch\(/);
 assert.doesNotMatch(grid,/let investment = 0/);
 assert.match(grid,/if \(row\.currency !== 'USD'\) return/);
 assert.match(grid,/if \(behavior !== 'neutral'\) Object\.assign\(patch, sheetFinancialPatch\(columns, values\)\)/);
});
