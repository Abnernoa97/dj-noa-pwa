import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { liveQuery } from 'dexie';
import { Check, ChevronDown, Plus, Trash2, X } from 'lucide-react';
import { db, uid } from './db';
import type { EventItem, SheetRow, SheetStatus } from './types';

const MODULES_KEY = 'djnoa.excel.modules.v1';
const DEFAULT_MODULES = ['Ingresos', 'Gastos', 'Eventos', 'General'];
const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

type ModuleDraft = { open: boolean; name: string };

function normalize(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function readModules() {
  try {
    const raw = JSON.parse(localStorage.getItem(MODULES_KEY) || '[]') as unknown;
    if (!Array.isArray(raw)) return DEFAULT_MODULES;
    const saved = raw.map((item) => String(item || '').trim()).filter(Boolean);
    return [...new Set([...DEFAULT_MODULES, ...saved])];
  } catch {
    return DEFAULT_MODULES;
  }
}

function saveModules(modules: string[]) {
  try { localStorage.setItem(MODULES_KEY, JSON.stringify(modules)); } catch { /* noop */ }
}

function statusLabel(status: SheetStatus) {
  if (status === 'paid') return 'Pagado';
  if (status === 'info') return 'Info';
  return 'Pendiente';
}

export default function ExcelModulesEnhancer() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [savedModules, setSavedModules] = useState<string[]>(readModules);
  const [activeModule, setActiveModule] = useState('General');
  const [draft, setDraft] = useState<ModuleDraft>({ open: false, name: '' });
  const [search, setSearch] = useState('');

  useEffect(() => {
    let currentRoot: HTMLElement | null = null;
    let currentHost: HTMLElement | null = null;

    const syncHost = () => {
      const root = document.querySelector<HTMLElement>('.sheet-classic');
      if (!root) {
        if (currentRoot) currentRoot.classList.remove('excel-modular-active');
        currentRoot = null;
        currentHost = null;
        setHost(null);
        return;
      }
      if (root === currentRoot && currentHost?.isConnected) return;

      if (currentRoot && currentRoot !== root) currentRoot.classList.remove('excel-modular-active');
      currentRoot = root;
      root.classList.add('excel-modular-active');

      let mount = root.querySelector<HTMLElement>('.excel-modules-mount');
      if (!mount) {
        mount = document.createElement('div');
        mount.className = 'excel-modules-mount';
        const summary = root.querySelector('.sheet-mini-summary');
        if (summary?.parentNode) summary.parentNode.insertBefore(mount, summary.nextSibling);
        else root.appendChild(mount);
      }
      currentHost = mount;
      setHost(mount);
    };

    syncHost();
    const observer = new MutationObserver(syncHost);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      currentRoot?.classList.remove('excel-modular-active');
      currentHost?.remove();
    };
  }, []);

  useEffect(() => {
    const rowSubscription = liveQuery(() => db.sheetRows.toArray()).subscribe({ next: setRows });
    const eventSubscription = liveQuery(() => db.events.toArray()).subscribe({ next: setEvents });
    return () => {
      rowSubscription.unsubscribe();
      eventSubscription.unsubscribe();
    };
  }, []);

  const modules = useMemo(() => {
    const categories = rows.map((row) => row.category?.trim()).filter(Boolean);
    return [...new Set([...savedModules, ...categories])];
  }, [rows, savedModules]);

  useEffect(() => {
    if (!modules.length) return;
    if (!modules.some((item) => normalize(item) === normalize(activeModule))) setActiveModule(modules[0]);
  }, [modules, activeModule]);

  const moduleRows = useMemo(() => {
    const q = normalize(search);
    return rows
      .filter((row) => normalize(row.category || 'General') === normalize(activeModule))
      .filter((row) => {
        if (!q) return true;
        const event = events.find((item) => item.id === row.eventId);
        return normalize(`${row.label} ${row.notes || ''} ${row.description || ''} ${event?.title || ''}`).includes(q);
      })
      .sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt));
  }, [rows, events, activeModule, search]);

  const moduleTotal = useMemo(() => moduleRows.reduce((sum, row) => sum + Number(row.amount || 0), 0), [moduleRows]);

  const moduleStats = useMemo(() => new Map(modules.map((module) => {
    const scoped = rows.filter((row) => normalize(row.category || 'General') === normalize(module));
    return [module, { count: scoped.length, total: scoped.reduce((sum, row) => sum + Number(row.amount || 0), 0) }];
  })), [modules, rows]);

  const createModule = () => {
    const name = draft.name.trim();
    if (!name) return;
    const existing = modules.find((item) => normalize(item) === normalize(name));
    const nextName = existing || name;
    if (!existing) {
      const next = [...savedModules, name];
      setSavedModules(next);
      saveModules(next);
    }
    setActiveModule(nextName);
    setDraft({ open: false, name: '' });
  };

  const addRow = async () => {
    const now = new Date().toISOString();
    await db.sheetRows.add({
      id: uid(),
      label: 'Nuevo concepto',
      category: activeModule,
      amount: 0,
      status: 'pending',
      description: '',
      notes: '',
      values: {},
      createdAt: now,
      updatedAt: now
    });
  };

  const patchRow = async (row: SheetRow, patch: Partial<SheetRow>) => {
    await db.sheetRows.update(row.id, { ...patch, updatedAt: new Date().toISOString() });
  };

  const deleteRow = async (row: SheetRow) => {
    await db.transaction('rw', [db.sheetRows, db.sheetPhotos], async () => {
      await db.sheetPhotos.where('rowId').equals(row.id).delete();
      await db.sheetRows.delete(row.id);
    });
  };

  if (!host) return null;

  return createPortal(
    <section className="excel-modules" aria-label="Tablas personalizadas de Excel">
      <div className="excel-modules-heading">
        <div><span>MIS TABLAS</span><strong>Organiza Excel a tu manera</strong></div>
        <button type="button" className="excel-module-new" onClick={() => setDraft((current) => ({ ...current, open: !current.open }))}>
          {draft.open ? <X size={15} /> : <Plus size={15} />}<span>Nueva</span>
        </button>
      </div>

      {draft.open && <div className="excel-module-create">
        <input autoFocus value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} onKeyDown={(event) => { if (event.key === 'Enter') createModule(); }} placeholder="Ej. Bodas 2027, Viajes, Equipo…" />
        <button type="button" onClick={createModule} disabled={!draft.name.trim()}><Check size={15} /> Crear</button>
      </div>}

      <div className="excel-module-strip">
        {modules.map((module) => {
          const stats = moduleStats.get(module) || { count: 0, total: 0 };
          const active = normalize(module) === normalize(activeModule);
          return <button type="button" key={module} className={`excel-module-chip ${active ? 'active' : ''}`} onClick={() => { setActiveModule(module); setSearch(''); }}>
            <span>{module}</span>
            <small>{stats.count ? `${stats.count} · ${money.format(stats.total)}` : 'Vacío'}</small>
          </button>;
        })}
        <button type="button" className="excel-module-chip add" onClick={() => setDraft({ open: true, name: '' })}><Plus size={16} /><span>Agregar</span></button>
      </div>

      <div className="excel-module-panel">
        <header className="excel-module-panel-head">
          <div><span>TABLA</span><h3>{activeModule}</h3><small>{moduleRows.length} {moduleRows.length === 1 ? 'fila' : 'filas'} · {money.format(moduleTotal)}</small></div>
          <button type="button" onClick={() => void addRow()}><Plus size={16} /> Fila</button>
        </header>

        <label className="excel-module-search"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Buscar en ${activeModule}`} /></label>

        <div className="excel-module-grid">
          <div className="excel-module-grid-head"><span>CONCEPTO</span><span>MONTO</span><span>ESTADO</span><span /></div>
          {moduleRows.length ? moduleRows.map((row) => {
            const linkedEvent = events.find((item) => item.id === row.eventId);
            return <div className="excel-module-grid-row" key={row.id}>
              <label className="excel-cell concept">
                <input value={row.label} onChange={(event) => void patchRow(row, { label: event.target.value })} aria-label="Concepto" />
                {linkedEvent && <small>{linkedEvent.title}</small>}
              </label>
              <label className="excel-cell amount"><input type="number" inputMode="decimal" value={row.amount} onChange={(event) => void patchRow(row, { amount: Number(event.target.value || 0) })} aria-label="Monto" /></label>
              <label className="excel-cell status"><select value={row.status} onChange={(event) => void patchRow(row, { status: event.target.value as SheetStatus })} aria-label="Estado"><option value="pending">Pendiente</option><option value="paid">Pagado</option><option value="info">Info</option></select><small>{statusLabel(row.status)}</small></label>
              <button type="button" className="excel-row-delete" onClick={() => { if (window.confirm(`¿Eliminar “${row.label}”?`)) void deleteRow(row); }} aria-label={`Eliminar ${row.label}`}><Trash2 size={14} /></button>
            </div>;
          }) : <button type="button" className="excel-module-empty" onClick={() => void addRow()}><Plus size={18} /><span>Agregar la primera fila a {activeModule}</span></button>}
        </div>

        <button type="button" className="excel-module-add-bottom" onClick={() => void addRow()}><Plus size={15} /> Nueva fila</button>
        <div className="excel-module-foot"><ChevronDown size={13} /><span>Los cambios se guardan automáticamente</span></div>
      </div>
    </section>,
    host
  );
}
