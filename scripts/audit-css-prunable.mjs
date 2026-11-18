#!/usr/bin/env node
/** Read-only report of provably redundant identical declarations in loaded CSS.
 * Never changes CSS, and never treats intentional overrides as redundancy.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
const root = fileURLToPath(new URL('../', import.meta.url));
const entry=readFileSync(join(root,'src/main.tsx'),'utf8');
const css = [...entry.matchAll(/^import ['"](\.\/[^'"]+\.css)['"];?$/gm)].map(x=>resolve(root,'src',x[1]));
const seen=new Map(), candidates=[], perFile=new Map(), allImportant=new Map();
for(let fileOrder=0;fileOrder<css.length;fileOrder++){
 const abs=css[fileOrder],relative=abs.slice(root.length).replaceAll('\\','/');
 const rootCss=postcss.parse(readFileSync(abs,'utf8'),{from:relative});
 rootCss.walkDecls(d=>{if(d.important)allImportant.set(relative,(allImportant.get(relative)||0)+1);});
 rootCss.walkRules(rule=>{
  if(rule.selector.includes(',')||!rule.nodes||rule.nodes.some(x=>x.type!=='decl'&&x.type!=='comment'))return;
  const chain=[];for(let p=rule.parent;p&&p.type!=='root';p=p.parent){
   if(p.type!=='atrule'||p.name.toLowerCase()!=='media')return; // supports, layer, keyframes excluded
   chain.unshift(p.params.trim());
  }
  if(chain.length>1)return;
  const context=chain.length?chain[0]:'root';
  for(const d of rule.nodes){
   if(d.type!=='decl')continue;
   if(d.prop.startsWith('--'))continue; // defer custom-property semantics
   const selector=rule.selector.trim().replace(/\s+/g,' ');
   const key=[context,selector,d.prop,d.important?'important':'normal',d.value].join('\u001f');
   const previous=seen.get(key);
   const loc={file:relative,line:d.source?.start?.line||0,selector,property:d.prop,value:d.value,important:d.important,media:context};
   if(previous){
    // Same selector, same media condition, same property, exact same value and priority.
    // A later declaration overrides the earlier identically, so the earlier is redundant.
    if(!previous.prunable){
      candidates.push(previous.loc);
      previous.prunable=true;
      perFile.set(previous.loc.file,(perFile.get(previous.loc.file)||0)+1);
    }
   }
   seen.set(key,{loc,prunable:false});
  }
 });
}
const summary={loadedCssFiles:css.length,prunableEarlierDeclarations:candidates.length,byFile:[...perFile].sort((a,b)=>b[1]-a[1]),importantTotal:[...allImportant.values()].reduce((a,b)=>a+b,0),importantByFile:[...allImportant].sort((a,b)=>b[1]-a[1]).slice(0,12)};
console.log('[DJ CSS PRUNE SUMMARY] '+JSON.stringify(summary));
for(let i=0;i<Math.min(candidates.length,80);i+=10)console.log('[DJ CSS PRUNE CANDIDATES_'+(i/10+1)+'] '+JSON.stringify(candidates.slice(i,i+10)));
console.log('[DJ CSS PRUNE NOTE] Candidates are exact, same-media/specificity/prioritized earlier declarations, not entire rules. Visual QA is still required before deletion.');


