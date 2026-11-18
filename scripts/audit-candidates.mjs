#!/usr/bin/env node
/**
 * Read-only reference inventory. Reachability and CSS selector matches are only
 * CANDIDATES for human review; this script never removes a source file.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, relative, join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const wantedExtensions = new Set(['.ts','.tsx','.js','.jsx','.css']);
const skip = new Set(['.git','node_modules','dist','.wrangler','coverage']);
function collect(dir) {
  return readdirSync(join(ROOT,dir),{withFileTypes:true}).flatMap(entry=>{
    if (skip.has(entry.name)) return [];
    const path=(dir?dir+'/':'')+entry.name;
    if(entry.isDirectory()) return collect(path);
    return wantedExtensions.has(extname(path))&&!path.endsWith('.d.ts')?[path]:[];
  });
}
const files=[...collect('src'),...collect('worker')].sort();
const set=new Set(files);
function resolveTarget(origin,spec){
  if(!spec.startsWith('.'))return null;
  const base=resolve(ROOT,dirname(origin),spec.split('?')[0].split('#')[0]);
  const candidates=[base,...['.ts','.tsx','.js','.jsx','.css'].map(ext=>base+ext),
    ...['index.ts','index.tsx','index.js'].map(x=>join(base,x))];
  if(base.endsWith('.js'))candidates.push(base.slice(0,-3)+'.ts');
  return candidates.map(x=>relative(ROOT,x).split(sep).join('/')).find(p=>set.has(p))||null;
}
const edges=new Map();
for (const path of files) {
  const text=readFileSync(join(ROOT,path),'utf8');
  const paths=[];
  for (const match of text.matchAll(/\b(?:from\s*|import\s*(?:\(\s*)?|export\s*\*\s*from\s*)['"]([^'"]+)['"]/g)) {
    const linked=resolveTarget(path,match[1]);if(linked)paths.push(linked);
  }
  if(path.endsWith('.css')){
    for(const match of text.matchAll(/@import\s+(?:url\()?['"]([^'"]+)['"]/g)){
      const linked=resolveTarget(path,match[1]);if(linked)paths.push(linked);
    }
  }
  edges.set(path,[...new Set(paths)]);
}
const roots=['src/main.tsx','worker/src/entry.ts'].filter(x=>set.has(x));
const queue=[...roots],reachable=new Set();
while(queue.length){
  const path=queue.pop();
  if(!path||reachable.has(path))continue;
  reachable.add(path);
  queue.push(...(edges.get(path)||[]));
}
const candidates=files.filter(path=>!reachable.has(path));
const css=files.filter(path=>path.endsWith('.css'));
const cssStats=css.map(path=>{
  const source=readFileSync(join(ROOT,path),'utf8');
  return {path,bytes:statSync(join(ROOT,path)).size,important:(source.match(/!important/g)||[]).length,media:(source.match(/@media/g)||[]).length};
}).sort((a,b)=>b.important-a.important);
const summary={
  entrypoints:roots,
  trackedSources:files.length,
  reachableSources:reachable.size,
  reviewOnlyCandidates:candidates,
  cssCount:css.length,
  cssImportantTotal:cssStats.reduce((n,x)=>n+x.important,0),
  cssLargestOverrideLayers:cssStats.slice(0,8),
};
console.log('[DJ NOA candidates] '+JSON.stringify(summary));
console.log('[DJ NOA candidates] Ningun archivo se borra. Entradas indirectas, Worker, Vite, HTML, CSS y pruebas pueden invalidar una sospecha de huérfano.');
