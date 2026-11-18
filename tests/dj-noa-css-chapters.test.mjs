import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const root=new URL('../src/',import.meta.url);
const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
const chapters=['styles/core','features/events/styles','features/calendar/styles','features/excel/styles',
  'features/tasks/styles','features/noah/styles','features/safety/styles','features/home/styles','features/sports/styles'];
const imports=[...main.matchAll(/^import '(\.\/[^']+\.css)';$/gm)].map(m=>m[1]);

test('CSS lives in chapter folders without compatibility copies in src root',()=>{
  const rootCss=readdirSync(root).filter(f=>f.endsWith('.css'));
  assert.deepEqual(rootCss,[],'No parallel root CSS files are permitted');
  assert.equal(imports.length,33,'All 33 existing styles keep explicit load order');
  assert.equal(new Set(imports).size,imports.length,'A stylesheet must be loaded only once');
  for(const path of imports){
    assert.ok(chapters.some(ch=>path.startsWith('./'+ch+'/')),path+' lacks chapter owner');
    assert.ok(existsSync(new URL(path,root)),path+' does not exist');
  }
});

test('the final iOS and landscape layers retain their exact precedence',()=>{
  const cssNames=imports.map(x=>x.split('/').pop());
  assert.equal(cssNames[0],'styles.css');
  assert.deepEqual(cssNames.slice(-2),['ios-dark-redesign.css','excel-landscape.css']);
  const order=(a,b)=>assert.ok(cssNames.indexOf(a)>=0&&cssNames.indexOf(b)>cssNames.indexOf(a),a+' before '+b);
  order('visual-polish.css','excel-scroll-fix.css');
  order('excel-scroll-fix.css','scroll-fix.css');
  order('sheet-focus.css','excel-modules.css');
});
