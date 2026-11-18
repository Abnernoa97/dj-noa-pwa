import './audit-css-prunable.mjs';
#!/usr/bin/env node
/** DJ NOA P01. Read-only audit. Matches are REVIEW CANDIDATES, never deletions. */
import {createRequire} from 'node:module';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const ts=require('typescript'),postcss=require('postcss');
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const areas=['src','worker/src','dj-noa-cloud/src'];
const files=[];
function walk(p){for(const e of readdirSync(join(ROOT,p),{withFileTypes:true})){
  if(['.git','node_modules','dist','.wrangler'].includes(e.name))continue;
  const name=p+'/'+e.name;
  if(e.isDirectory())walk(name);
  else if(e.isFile()&&/\.(ts|tsx|js|jsx|css)$/.test(name)&&!name.endsWith('.d.ts'))files.push(name);
}}
for(const p of areas)walk(p);
files.sort();
const get=(p)=>readFileSync(join(ROOT,p),'utf8');
const add=(map,key,value)=>map.set(key,[...(map.get(key)||[]),value]);
const functions=[],named=new Map(),exactLines=new Map(),ownership=new Map();
const cssSelectors=new Map(),cssRules=new Map(),cssFiles=[];
let totalFunctions=0;
function tokens(body){const s=ts.createScanner(ts.ScriptTarget.Latest,true,ts.LanguageVariant.Standard,body),a=[];
 while(true){if(s.scan()===ts.SyntaxKind.EndOfFileToken)break;a.push(s.getTokenText());}return a;}
function nameOf(node){if(node.name&&ts.isIdentifier(node.name))return node.name.text;
 const p=node.parent;if(p&&ts.isVariableDeclaration(p)&&ts.isIdentifier(p.name))return p.name.text;
 return '(callback)';}
for(const file of files){const code=get(file);
 if(file.endsWith('.css')){
  const root=postcss.parse(code,{from:file});let rules=0,important=0;
  root.walkRules(r=>{rules++;const decl=(r.nodes||[]).filter(n=>n.type==='decl');important+=decl.filter(d=>d.important).length;
   let ctx='';for(let p=r.parent;p&&p.type!=='root';p=p.parent)if(p.type==='atrule')ctx=p.name+' '+p.params+' / '+ctx;
   const site={file,line:r.source?.start?.line||0,ctx:ctx||'base'};
   if(/\bkeyframes\b/.test(ctx))return; // from/to are animation steps, not CSS selector collisions
   const props=Object.fromEntries(decl.map(d=>[d.prop.toLowerCase(),d.value+(d.important?' !important':'')]));
   for(const selector of r.selectors||[r.selector])add(cssSelectors,selector.trim().replace(/\s+/g,' '),{...site,props});
   const sig=decl.map(d=>d.prop+':'+d.value+(d.important?'!important':'')).join(';');
   if(decl.length>=3&&sig.length>85)add(cssRules,sig,{...site,selector:r.selector});
  });cssFiles.push({file,rules,important});continue;
 }
 const sf=ts.createSourceFile(file,code,ts.ScriptTarget.Latest,true,file.endsWith('x')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 function scan(node){if((ts.isFunctionDeclaration(node)||ts.isArrowFunction(node)||ts.isFunctionExpression(node)||ts.isMethodDeclaration(node))&&node.body){
  totalFunctions++;const name=nameOf(node),line=sf.getLineAndCharacterOfPosition(node.getStart(sf)).line+1;
  if(name!=='(callback)')add(named,name,{file,line});
  const t=tokens(node.body.getText(sf));if(t.length>=30)functions.push({file,line,name,t});
 }ts.forEachChild(node,scan);}scan(sf);
 const l=code.split(/\r?\n/).map((x,i)=>({text:x.replace(/\s+/g,''),line:i+1})).filter(x=>x.text);
 for(let i=0;i+7<=l.length;i++){const window=l.slice(i,i+7),key=window.map(x=>x.text).join('\n');
 if(key.length>160)add(exactLines,key,{file,line:window[0].line});}
 for(const [kind,rx] of Object.entries({
  dbWrite:/\bdb\.[\w]+\.(?:add|put|update|delete|bulkAdd|bulkPut|bulkDelete|clear)\s*\(|db\.transaction\s*\(/g,
  apiFetch:/\bfetch\s*\(/g,
  events:/\b(?:dispatchEvent|addEventListener|CustomEvent)\s*\(/g,
  persistence:/\b(?:localStorage|sessionStorage|indexedDB|caches|navigator\.storage)\b/g,
  routing:/\b(?:pathname|request\.url|url\.pathname)\b/g})){
  const count=[...code.matchAll(rx)].length;if(count)add(ownership,kind,{file,count});}
}
const exact=new Map();for(const f of functions)add(exact,f.t.join('\u001f'),{file:f.file,line:f.line,name:f.name,tokens:f.t.length});
const across=(sites)=>new Set(sites.map(x=>x.file)).size>1;
const exactFunctions=[...exact.values()].filter(across).sort((a,b)=>b[0].tokens-a[0].tokens).slice(0,35);
const functionNames=[...named].filter(([_,sites])=>across(sites)).sort((a,b)=>b[1].length-a[1].length)
 .slice(0,65).map(([name,sites])=>({name,sites}));
const lines=[...exactLines.values()].filter(across).sort((a,b)=>b.length-a.length).slice(0,35);
const cloneCandidates=[];
const big=functions.filter(x=>x.t.length>=50&&x.t.length<=1500).sort((a,b)=>a.t.length-b.t.length);
for(const f of big){const s=new Set();for(let i=0;i+5<=f.t.length;i++)s.add(f.t.slice(i,i+5).join('\u001f'));f.set=s;}
for(let i=0;i<big.length;i++)for(let j=i+1;j<big.length;j++){
 const a=big[i],b=big[j];if(b.t.length>a.t.length*1.40)break;if(a.file===b.file)continue;
 let intersection=0;for(const x of a.set)if(b.set.has(x))intersection++;
 const score=intersection/(a.set.size+b.set.size-intersection||1);
 if(score>=0.54&&intersection>=14&&a.t.join('\u001f')!==b.t.join('\u001f'))
  cloneCandidates.push({score:+score.toFixed(2),a:{file:a.file,line:a.line,name:a.name},b:{file:b.file,line:b.line,name:b.name}});
}
cloneCandidates.sort((a,b)=>b.score-a.score);
const allSelectorDuplicates=[...cssSelectors].filter(([_,sites])=>across(sites)).sort((a,b)=>b[1].length-a[1].length);
const selectors=allSelectorDuplicates.map(([selector,sites])=>({selector,sites:sites.map(({file,line,ctx})=>({file,line,ctx}))}));
const collisions=[];
for(const [selector,sites] of allSelectorDuplicates){
 const groups=new Map();for(const site of sites)add(groups,site.ctx,site);
 for(const [context,sameContext] of groups){
  if(new Set(sameContext.map(s=>s.file)).size<2)continue;
  const overlaps=[];
  for(let i=0;i<sameContext.length;i++)for(let j=i+1;j<sameContext.length;j++){
   const a=sameContext[i],b=sameContext[j];if(a.file===b.file)continue;
   const common=Object.keys(a.props).filter(p=>Object.hasOwn(b.props,p));
   for(const prop of common){const first=a.props[prop],second=b.props[prop];
    overlaps.push({prop,kind:first===second?'same':'different',a:a.file+':'+a.line,b:b.file+':'+b.line});}
  }
  if(overlaps.length)collisions.push({selector,context,same:overlaps.filter(x=>x.kind==='same').length,different:overlaps.filter(x=>x.kind==='different').length,examples:overlaps.slice(0,8)});
 }
}
collisions.sort((a,b)=>(b.different*2+b.same)-(a.different*2+a.same));
const allRuleDuplicates=[...cssRules.values()].filter(across).sort((a,b)=>b.length-a.length);
const rules=allRuleDuplicates.slice(0,40);
const owners=Object.fromEntries([...ownership].map(([k,v])=>[k,v.sort((a,b)=>b.count-a.count).slice(0,30)]));
const emit=(k,x)=>console.log('[DJ NOA DUP '+k+'] '+JSON.stringify(x));
emit('SUMMARY',{scope:areas,files:files.length,tsFiles:files.length-cssFiles.length,cssFiles:cssFiles.length,
 functions:totalFunctions,exactFunctions:exactFunctions.length,similarFunctions:cloneCandidates.length,
 repeatedNames:functionNames.length,exactBlocks:lines.length,crossFileSelectors:allSelectorDuplicates.length,identicalCssRules:allRuleDuplicates.length,
 cssSameMediaPropertyCollisions:collisions.length,cssSameMediaDifferingProperties:collisions.reduce((n,x)=>n+x.different,0),
 importantCss:cssFiles.reduce((a,b)=>a+b.important,0)});
emit('EXACT_FUNCTIONS',exactFunctions);emit('SIMILAR_FUNCTIONS',cloneCandidates.slice(0,45));
emit('REPEATED_NAMES',functionNames);emit('EXACT_BLOCKS',lines);
for(let i=0;i<selectors.length;i+=12)emit('CSS_SELECTORS_'+(i/12+1),selectors.slice(i,i+12));
for(let i=0;i<collisions.length;i+=12)emit('CSS_CONFLICTS_'+(i/12+1),collisions.slice(i,i+12));
emit('CSS_RULES',rules);emit('CODE_OWNERS',owners);
console.log('[DJ NOA DUP NOTE] Read-only report. A detected name, token match or CSS selector can be intentional. Preserve behavior, data, cascade and mobile QA before merging.');
