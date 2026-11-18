#!/usr/bin/env node
/**
 * DJ NOA — auditoría conservadora, solo lectura.
 * No borra archivos, no modifica repositorios ni IndexedDB,
 * no abre red y NO depende de GitHub Actions.
 * Cloudflare Workers Builds la ejecuta durante npm run build.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const IGNORED = new Set(['.git','node_modules','dist','.wrangler','.vite','coverage']);
const REQUIRED = [
  'README.md',
  'package.json',
  'index.html',
  'wrangler.jsonc',
  'vite.config.ts',
  'src/main.tsx',
  'src/App.tsx',
  'src/db.ts',
  'src/types.ts',
  'src/features/excel/SheetWorkspace.tsx',
  'src/domains/sheet/sheetValues.ts',
  'src/shared/normalizeText.ts',
  'scripts/audit-candidates.mjs',
  'src/features/excel/ExcelModulesEnhancer.tsx',
  'src/domains/finance/finance.ts',
  'src/domains/finance/financialOverview.ts',
  'src/domains/finance/moneyIntegrity.ts',
  'src/domains/events/eventMutations.ts',
  'src/domains/events/eventIntegrity.ts',
  'src/domains/events/eventSchedule.ts',
  'src/features/events/EventWorkspace.tsx',
  'src/features/calendar/CalendarWorkspace.tsx',
  'src/features/tasks/ReminderWorkspace.tsx',
  'src/features/tasks/reminderNotifications.ts',
  'src/domains/noah/noahVisionCommit.ts',
  'src/domains/noah/noahImageReconcile.ts',
  'src/domains/noah/noahEvents.ts',
  'src/domains/noah/noahExcel.ts',
  'src/features/noah/NoahVoice.tsx',
  'src/features/noah/NoahImageIntake.tsx',
  'src/features/noah/NoahActionOverlay.tsx',
  'src/features/sports/MlbWorkspace.tsx',
  'src/features/sports/NbaWorkspace.tsx',
  'src/features/sports/SportsEnhancer.tsx',
  'src/features/sports/SportsGameDetail.tsx',
  'src/features/sports/HardRockMarketEnhancer.tsx',
  'src/domains/sports/hardRockOdds.ts',
  'src/services/media/photoOptimization.ts',
  'src/features/excel/useExcelLandscape.ts',
  'worker/src/entry.ts',
  'worker/src/index.ts',
  'worker/src/noahChat.ts',
  'worker/src/noahImage.ts',
  '00-PLAN-MAESTRO-DJ-NOA/00-LEER-PRIMERO.md',
  '00-PLAN-MAESTRO-DJ-NOA/01-TABLERO-MAESTRO.md',
  '00-PLAN-MAESTRO-DJ-NOA/02-AUDITORIA-Y-ARQUITECTURA.md',
  '00-PLAN-MAESTRO-DJ-NOA/03-PROTOCOLO-Y-PUBLICACION.md',
  '00-PLAN-MAESTRO-DJ-NOA/04-BITACORA.md'
];

function walk(dir) {
  const result = [];
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED.has(item.name)) continue;
    const file = join(dir, item.name);
    if (item.isDirectory()) result.push(...walk(file));
    else if (item.isFile()) result.push(relative(ROOT, file).split(sep).join('/'));
  }
  return result;
}
const files = walk(ROOT);
const fileSet = new Set(files);
const errors = [];
const warnings = [];
const missing = REQUIRED.filter(file => !fileSet.has(file));
if (missing.length) errors.push('Faltan archivos activos: ' + missing.join(', '));

const gitWorkflows = files.filter(file => file.startsWith('.github/workflows/') && /\.ya?ml$/i.test(file));
if (gitWorkflows.length) errors.push('GitHub Actions no autorizado: ' + gitWorkflows.join(', '));

const wrangler = existsSync(join(ROOT,'wrangler.jsonc'))
  ? readFileSync(join(ROOT,'wrangler.jsonc'),'utf8') : '';
if (!/"name"\s*:\s*"dj-noa-pwa"/.test(wrangler)) errors.push('Worker de producción incorrecto o ausente.');
for (const binding of ['REMINDER_SCHEDULER','ASSETS','AI']) {
  if (!wrangler.includes('"'+binding+'"')) errors.push('Falta binding contractual ' + binding);
}

const db = existsSync(join(ROOT,'src/db.ts')) ? readFileSync(join(ROOT,'src/db.ts'),'utf8') : '';
if (!/super\(['"]dj-noa-local['"]\)/.test(db)) errors.push('No modificar la identidad Dexie dj-noa-local.');
if (!/this\.version\(6\)/.test(db)) errors.push('Revisar la conservación del esquema Dexie v6.');

const packageJson = JSON.parse(readFileSync(join(ROOT,'package.json'),'utf8'));
for (const required of ['audit:structure','typecheck','typecheck:cloud','test:ai','build']) {
  if (!packageJson.scripts?.[required]) errors.push('Falta el script '+required);
}
if (!String(packageJson.scripts?.build || '').includes('audit:structure') ||
    !String(packageJson.scripts?.build || '').includes('test:ai')) {
  errors.push('Cloudflare debe ejecutar auditoría y regresión antes de Vite.');
}

const sourceFiles = files.filter(p => /\.(?:ts|tsx|js|jsx|mjs)$/.test(p) &&
  (p.startsWith('src/') || p.startsWith('worker/') || p.startsWith('dj-noa-cloud/src/')));
function resolveLocal(origin, spec) {
  const base = resolve(ROOT, dirname(origin), spec);
  const candidates = [base, ...['.ts','.tsx','.js','.jsx','.mjs','.css','.json'].map(ext=>base+ext),
    ...['index.ts','index.tsx','index.js','index.mjs'].map(name=>join(base,name))];
  if (base.endsWith('.js')) candidates.push(base.slice(0,-3)+'.ts',base.slice(0,-3)+'.tsx');
  return candidates.some(p => existsSync(p) && statSync(p).isFile());
}
for (const path of sourceFiles) {
  const text = readFileSync(join(ROOT,path),'utf8');
  if (text.includes('// @ts-nocheck')) warnings.push('TypeScript sin comprobar: ' + path);
  // Lectura conservadora de imports estáticos/dinámicos. No infiere código muerto.
  for (const match of text.matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)['"](\.{1,2}\/[^'"]+)['"]/g)) {
    if (!resolveLocal(path,match[1]))
      errors.push('Importación relativa rota: ' + path + ' → ' + match[1]);
  }
}
const cssFiles = files.filter(p=>p.startsWith('src/')&&extname(p)==='.css');
const largeFiles = files.filter(p=>p.startsWith('src/')||p.startsWith('worker/'))
  .filter(p=>/\.(?:tsx?|css)$/.test(p))
  .map(p=>({path:p,bytes:statSync(join(ROOT,p)).size}))
  .filter(x=>x.bytes>=18000).sort((a,b)=>b.bytes-a.bytes);
console.log('[DJ NOA audit] archivos:',files.length,
  '| CSS src:',cssFiles.length,'| modulos TS/JS:',sourceFiles.length,
  '| GitHub Actions:',gitWorkflows.length);
console.log('[DJ NOA audit] archivos grandes para auditoría SEMÁNTICA, no eliminación automática:',
  largeFiles.map(x=>x.path+' ('+x.bytes+' B)').join(', ') || 'ninguno');
for (const w of warnings) console.warn('[DJ NOA audit] aviso:',w);
if (errors.length) {
  for (const e of errors) console.error('[DJ NOA audit] ERROR:',e);
  process.exitCode=1;
} else {
  console.log('[DJ NOA audit] estructura mínima, importaciones y límites de despliegue: OK');
}
