import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Mic, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { db, uid } from './db';
import type { EventItem, SheetColumn, SheetRow, SheetStatus, SheetValue } from './types';

const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

type Props = {
  rows: SheetRow[];
  events: EventItem[];
  onChanged: () => Promise<void> | void;
  onAssistant: () => void;
};

type SortMode = 'newest' | 'oldest' | 'amount-desc' | 'amount-asc' | 'label';

type DraftColumn = {
  name: string;
  type: SheetColumn['type'];
  formula: string;
};

function normalize(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function keyFromName(name: string) {
  const base = normalize(name).replace(/\s+/g, '_') || `col_${Date.now()}`;
  return `custom_${base}`;
}

function numberValue(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? '').replace(/[$,\s]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseFormula(expression: string, vars: Record<string, number>): number | null {
  let source = expression.trim().replace(/^=/, '');
  source = source.replace(/[A-Za-z_][A-Za-z0-9_]*/g, (name) => String(vars[name] ?? 0));
  if (!source || /[^0-9+\-*/().\s]/.test(source)) return null;
  let i = 0;
  const skip = () => { while (/\s/.test(source[i] || '')) i += 1; };
  const number = (): number => {
    skip();
    if (source[i] === '(') {
      i += 1;
      const value = expr();
      skip();
      if (source[i] !== ')') throw new Error('paren');
      i += 1;
      return value;
    }
    const start = i;
    if (source[i] === '+' || source[i] === '-') i += 1;
    while (/[0-9.]/.test(source[i] || '')) i += 1;
    const value = Number(source.slice(start, i));
    if (!Number.isFinite(value)) throw new Error('number');
    return value;
  };
  const term = (): number => {
    let value = number();
    while (true) {
      skip();
      const op = source[i];
      if (op !== '*' && op !== '/') break;
      i += 1;
      const next = number();
      value = op === '*' ? value * next : next === 0 ? 0 : value / next;
    }
    return value;
  };
  const expr = (): number => {
    let value = term();
    while (true) {
      skip();
      const op = source[i];
      if (op !== '+' && op !== '-') break;
      i += 1;
      const next = term();
      value = op === '+' ? value + next : value - next;
    }
    return value;
  };
  try {
    const value = expr();
    skip();
    if (i !== source.length || !Number.isFinite(value)) return null;
    return value;
  } catch {
    return null;
  }
}

function formulaValue(column: SheetColumn, row: SheetRow, columns: SheetColumn[]) {
  if (column.type !== 'formula' || !column.formula) return row.values?.[column.key] ?? '';
  const vars: Record<string, number> = { amount: numberValue(row.amount) };
  for (const item of columns) vars[item.key] = numberValue(row.values?.[item.key]);
  return parseFormula(column.formula, vars);
}

function displayValue(column: SheetColumn, value: SheetValue | number | null) {
  if (value === null || value === undefined || value === '') return '';
  if (column.type === 'currency' || column.type === 'formula') return money.format(numberValue(value));
  return String(value);
}

export default function SheetWorkspace({ rows, events, onChanged, onAssistant }: Props) {
  const [columns, setColumns] = useState<SheetColumn[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState<'all' | SheetStatus>('all');
  const [sort, setSort] = useState<SortMode>('newest');
  const [columnPanel, setColumnPanel] = useState(false);
  const [draftColumn, setDraftColumn] = useState<DraftColumn>({ name: '', type: 'text', formula: '' });
  const fileRef = useRef<HTMLInputElement | null>(null);

  const loadColumns = async () => setColumns(await db.sheetColumns.orderBy('position').toArray());
  useEffect(() => { void loadColumns(); }, []);

  const categories = useMemo(() => [...new Set(rows.map((row) => row.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [rows]);
  const filtered = useMemo(() => {
    const q = normalize(search);
    const next = rows.filter((row) => {
      if (category !== 'all' && row.category !== category) return false;
      if (status !== 'all' && row.status !== status) return false;
      if (!q) return true;
      const event = events.find((item) => item.id === row.eventId);
      const custom = Object.values(row.values || {}).join(' ');
      return normalize(`${row.label} ${row.category} ${row.notes || ''} ${event?.title || ''} ${custom}`).includes(q);
    });
    return next.sort((a, b) => {
      if (sort === 'amount-desc') return b.amount - a.amount;
      if (sort === 'amount-asc') return a.amount - b.amount;
      if (sort === 'oldest') return a.createdAt.localeCompare(b.createdAt);
      if (sort === 'label') return a.label.localeCompare(b.label);
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [rows, search, category, status, sort, events]);

  const totals = useMemo(() => ({
    all: filtered.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    paid: filtered.filter((row) => row.status === 'paid').reduce((sum, row) => sum + Number(row.amount || 0), 0),
    pending: filtered.filter((row) => row.status === 'pending').reduce((sum, row) => sum + Number(row.amount || 0), 0)
  }), [filtered]);

  const paidPercent = totals.all > 0 ? Math.min(100, Math.max(0, (totals.paid / totals.all) * 100)) : 0;

  const addRow = async () => {
    const now = new Date().toISOString();
    await db.sheetRows.add({ id: uid(), label: 'Nuevo movimiento', category: 'General', amount: 0, status: 'pending', values: {}, createdAt: now, updatedAt: now });
    await onChanged();
  };

  const patchRow = async (row: SheetRow, patch: Partial<SheetRow>) => {
    await db.sheetRows.update(row.id, { ...patch, updatedAt: new Date().toISOString() });
    await onChanged();
  };

  const patchCustom = async (row: SheetRow, column: SheetColumn, value: SheetValue) => {
    await patchRow(row, { values: { ...(row.values || {}), [column.key]: value } });
  };

  const deleteRow = async (row: SheetRow) => {
    if (!window.confirm(`¿Eliminar “${row.label}”?`)) return;
    await db.sheetRows.delete(row.id);
    await onChanged();
  };

  const addColumn = async () => {
    const name = draftColumn.name.trim();
    if (!name) return;
    let key = keyFromName(name);
    let suffix = 2;
    const used = new Set(columns.map((item) => item.key));
    while (used.has(key)) key = `${keyFromName(name)}_${suffix++}`;
    const now = new Date().toISOString();
    await db.sheetColumns.add({ id: uid(), name, key, type: draftColumn.type, formula: draftColumn.type === 'formula' ? draftColumn.formula.trim() : undefined, position: columns.length, createdAt: now });
    setDraftColumn({ name: '', type: 'text', formula: '' });
    await loadColumns();
  };

  const deleteColumn = async (column: SheetColumn) => {
    if (!window.confirm(`¿Eliminar la columna “${column.name}”?`)) return;
    await db.sheetColumns.delete(column.id);
    const allRows = await db.sheetRows.toArray();
    await Promise.all(allRows.map((row) => {
      const values = { ...(row.values || {}) };
      delete values[column.key];
      return db.sheetRows.update(row.id, { values, updatedAt: new Date().toISOString() });
    }));
    await loadColumns();
    await onChanged();
  };

  const exportExcel = () => {
    const data = filtered.map((row) => {
      const event = events.find((item) => item.id === row.eventId);
      const record: Record<string, SheetValue | number> = {
        Concepto: row.label,
        Categoría: row.category,
        Monto: row.amount,
        Estado: row.status,
        Evento: event?.title || '',
        Notas: row.notes || ''
      };
      for (const column of columns) record[column.name] = formulaValue(column, row, columns) as SheetValue | number;
      return record;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DJ NOA');
    XLSX.writeFile(wb, `DJ-NOA-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const importExcel = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
    if (!raw.length) return;
    const headers = Object.keys(raw[0]);
    const core = new Set(['concepto', 'categoria', 'categoría', 'monto', 'estado', 'evento', 'notas']);
    const existingByName = new Map(columns.map((item) => [normalize(item.name), item]));
    const customHeaders = headers.filter((header) => !core.has(normalize(header)));
    const nextColumns = [...columns];
    for (const header of customHeaders) {
      if (existingByName.has(normalize(header))) continue;
      const column: SheetColumn = { id: uid(), name: header, key: keyFromName(header), type: 'text', position: nextColumns.length, createdAt: new Date().toISOString() };
      await db.sheetColumns.add(column);
      nextColumns.push(column);
      existingByName.set(normalize(header), column);
    }
    const now = new Date().toISOString();
    for (const item of raw) {
      const get = (...names: string[]) => {
        const match = Object.keys(item).find((key) => names.includes(normalize(key)));
        return match ? item[match] : '';
      };
      const eventText = String(get('evento') || '').trim();
      const event = events.find((entry) => normalize(entry.title) === normalize(eventText));
      const statusText = normalize(String(get('estado') || 'pending'));
      const rowStatus: SheetStatus = statusText.includes('pag') ? 'paid' : statusText.includes('info') ? 'info' : 'pending';
      const values: Record<string, SheetValue> = {};
      for (const header of customHeaders) {
        const column = existingByName.get(normalize(header));
        if (!column) continue;
        const value = item[header];
        values[column.key] = typeof value === 'number' || typeof value === 'boolean' ? value : String(value ?? '');
      }
      await db.sheetRows.add({
        id: uid(),
        label: String(get('concepto') || 'Movimiento'),
        category: String(get('categoria') || get('categoría') || 'General'),
        amount: numberValue(get('monto')),
        status: rowStatus,
        eventId: event?.id,
        notes: String(get('notas') || ''),
        values,
        createdAt: now,
        updatedAt: now
      });
    }
    await loadColumns();
    await onChanged();
  };

  return (
    <section className="page-card sheet-workspace-v2">
      <div className="sheet-v2-head">
        <div className="sheet-v2-title">
          <p className="eyebrow">CONTROL LOCAL</p>
          <h2>Excel</h2>
          <small>Todo visible, editable y sin desplazamiento lateral.</small>
        </div>
        <div className="sheet-v2-head-actions">
          <button className="sheet-v2-icon-button" onClick={() => fileRef.current?.click()} title="Importar"><Upload size={16} /><span>Importar</span></button>
          <button className="sheet-v2-icon-button" onClick={exportExcel} title="Exportar"><Download size={16} /><span>Exportar</span></button>
        </div>
      </div>

      <input ref={fileRef} className="sheet-file-input" type="file" accept=".xlsx,.xls,.csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importExcel(file); event.currentTarget.value = ''; }} />

      <div className="sheet-v2-summary">
        <div className="sheet-v2-total">
          <div><span>TOTAL</span><strong>{money.format(totals.all)}</strong></div>
          <div className="sheet-v2-stats">
            <div className="sheet-v2-stat paid"><span>PAGADO</span><strong>{money.format(totals.paid)}</strong></div>
            <div className="sheet-v2-stat pending"><span>PENDIENTE</span><strong>{money.format(totals.pending)}</strong></div>
          </div>
        </div>
        <div className="sheet-v2-progress"><span style={{ width: `${paidPercent}%` }} /></div>
      </div>

      <div className="sheet-v2-toolbar">
        <label className="sheet-v2-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar concepto, evento o nota" /></label>
        <button className="sheet-v2-new" onClick={() => void addRow()}><Plus size={16} /><span>Nuevo</span></button>
      </div>

      <div className="sheet-v2-filters">
        <div className="sheet-v2-filter"><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">Todas categorías</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
        <div className="sheet-v2-filter"><select value={status} onChange={(event) => setStatus(event.target.value as 'all' | SheetStatus)}><option value="all">Todos estados</option><option value="pending">Pendiente</option><option value="paid">Pagado</option><option value="info">Info</option></select></div>
        <div className="sheet-v2-filter"><select value={sort} onChange={(event) => setSort(event.target.value as SortMode)}><option value="newest">Recientes</option><option value="oldest">Antiguos</option><option value="amount-desc">Monto ↓</option><option value="amount-asc">Monto ↑</option><option value="label">A–Z</option></select></div>
      </div>

      <div className="sheet-v2-tools">
        <button className="sheet-v2-tool" onClick={() => fileRef.current?.click()}><Upload size={13} /> Importar</button>
        <button className="sheet-v2-tool" onClick={exportExcel}><Download size={13} /> Exportar</button>
        <button className="sheet-v2-tool" onClick={() => setColumnPanel((value) => !value)}><Plus size={13} /> Columnas</button>
        <button className="sheet-v2-tool" onClick={onAssistant}><Mic size={13} /> Voz</button>
      </div>

      {columnPanel && (
        <div className="sheet-v2-columns">
          <div className="sheet-v2-columns-head"><strong>Columnas personalizadas</strong><button onClick={() => setColumnPanel(false)}><X size={15} /></button></div>
          <div className="sheet-v2-column-form">
            <input value={draftColumn.name} onChange={(e) => setDraftColumn((current) => ({ ...current, name: e.target.value }))} placeholder="Nombre" />
            <select value={draftColumn.type} onChange={(e) => setDraftColumn((current) => ({ ...current, type: e.target.value as SheetColumn['type'] }))}><option value="text">Texto</option><option value="number">Número</option><option value="currency">Moneda</option><option value="date">Fecha</option><option value="formula">Fórmula</option></select>
            <button onClick={() => void addColumn()} disabled={!draftColumn.name.trim()}><Plus size={15} /></button>
            {draftColumn.type === 'formula' && <input className="sheet-v2-formula" value={draftColumn.formula} onChange={(e) => setDraftColumn((current) => ({ ...current, formula: e.target.value }))} placeholder="Ej. =amount*0.16" />}
          </div>
          {!!columns.length && <div className="sheet-v2-column-chips">{columns.map((column) => <div className="sheet-v2-column-chip" key={column.id}><span>{column.name}{column.type === 'formula' ? ' ƒ' : ''}</span><button onClick={() => void deleteColumn(column)} aria-label={`Eliminar ${column.name}`}><X size={11} /></button></div>)}</div>}
        </div>
      )}

      <div className="sheet-v2-scroll">
        <div className="sheet-v2-list">
          {filtered.length ? filtered.map((row) => (
            <article className="sheet-record" key={row.id}>
              <button className="sheet-delete-v2" onClick={() => void deleteRow(row)} aria-label="Eliminar movimiento"><Trash2 size={13} /></button>

              <div className="sheet-record-main">
                <div className="sheet-field">
                  <label>Concepto</label>
                  <input defaultValue={row.label} onBlur={(e) => { if (e.target.value !== row.label) void patchRow(row, { label: e.target.value || 'Movimiento' }); }} />
                </div>
                <div className="sheet-field amount">
                  <label>Monto</label>
                  <input type="number" inputMode="decimal" defaultValue={row.amount} onBlur={(e) => { const value = numberValue(e.target.value); if (value !== row.amount) void patchRow(row, { amount: value }); }} />
                </div>
              </div>

              <div className="sheet-record-meta">
                <div className="sheet-field">
                  <label>Categoría</label>
                  <input defaultValue={row.category} onBlur={(e) => { if (e.target.value !== row.category) void patchRow(row, { category: e.target.value || 'General' }); }} />
                </div>
                <div className="sheet-field">
                  <label>Estado</label>
                  <select defaultValue={row.status} onChange={(e) => void patchRow(row, { status: e.target.value as SheetStatus })}><option value="pending">Pendiente</option><option value="paid">Pagado</option><option value="info">Info</option></select>
                </div>
                <div className="sheet-field">
                  <label>Evento</label>
                  <select defaultValue={row.eventId || ''} onChange={(e) => void patchRow(row, { eventId: e.target.value || undefined })}><option value="">Sin evento</option>{events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}</select>
                </div>
              </div>

              <div className="sheet-field sheet-record-notes">
                <label>Notas</label>
                <input defaultValue={row.notes || ''} onBlur={(e) => { if (e.target.value !== (row.notes || '')) void patchRow(row, { notes: e.target.value }); }} placeholder="Opcional" />
              </div>

              {!!columns.length && <div className="sheet-record-custom">{columns.map((column) => (
                <div className="sheet-field" key={column.id}>
                  <label>{column.name}{column.type === 'formula' ? ' ƒ' : ''}</label>
                  {column.type === 'formula' ? <div className="sheet-formula-v2">{displayValue(column, formulaValue(column, row, columns))}</div> : <input type={column.type === 'number' || column.type === 'currency' ? 'number' : column.type === 'date' ? 'date' : 'text'} defaultValue={String(row.values?.[column.key] ?? '')} onBlur={(e) => { const value: SheetValue = column.type === 'number' || column.type === 'currency' ? numberValue(e.target.value) : e.target.value; if (value !== row.values?.[column.key]) void patchCustom(row, column, value); }} />}
                </div>
              ))}</div>}
            </article>
          )) : <div className="sheet-v2-empty">No hay movimientos para este filtro.</div>}
        </div>
        <div className="sheet-v2-count">{filtered.length} {filtered.length === 1 ? 'movimiento' : 'movimientos'} visibles</div>
      </div>
    </section>
  );
}