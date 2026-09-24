import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Camera, Columns3, Download, Mic, Plus, Search, Trash2, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { db, uid } from './db';
import type { EventItem, SheetColumn, SheetPhoto, SheetRow, SheetStatus, SheetValue } from './types';

const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

type Props = {
  rows: SheetRow[];
  events: EventItem[];
  onChanged: () => Promise<void> | void;
  onAssistant: () => void;
};

type SortMode = 'newest' | 'oldest' | 'amount-desc' | 'amount-asc' | 'label';
type DraftColumn = { name: string; type: SheetColumn['type']; formula: string };
type PhotoView = SheetPhoto & { url: string };

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
  const readNumber = (): number => {
    skip();
    if (source[i] === '(') {
      i += 1;
      const value = readExpr();
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
  const readTerm = (): number => {
    let value = readNumber();
    while (true) {
      skip();
      const op = source[i];
      if (op !== '*' && op !== '/') break;
      i += 1;
      const next = readNumber();
      value = op === '*' ? value * next : next === 0 ? 0 : value / next;
    }
    return value;
  };
  const readExpr = (): number => {
    let value = readTerm();
    while (true) {
      skip();
      const op = source[i];
      if (op !== '+' && op !== '-') break;
      i += 1;
      const next = readTerm();
      value = op === '+' ? value + next : value - next;
    }
    return value;
  };
  try {
    const value = readExpr();
    skip();
    return i === source.length && Number.isFinite(value) ? value : null;
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

function shortStatus(status: SheetStatus) {
  if (status === 'paid') return 'Pagado';
  if (status === 'info') return 'Info';
  return 'Pend.';
}

export default function SheetWorkspace({ rows, events, onChanged, onAssistant }: Props) {
  const [columns, setColumns] = useState<SheetColumn[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState<'all' | SheetStatus>('all');
  const [sort, setSort] = useState<SortMode>('newest');
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<PhotoView[]>([]);
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [draftColumn, setDraftColumn] = useState<DraftColumn>({ name: '', type: 'text', formula: '' });
  const fileRef = useRef<HTMLInputElement | null>(null);
  const photoRef = useRef<HTMLInputElement | null>(null);

  const selectedRow = rows.find((row) => row.id === selectedRowId) || null;
  const loadColumns = async () => setColumns(await db.sheetColumns.orderBy('position').toArray());

  useEffect(() => { void loadColumns(); }, []);

  useEffect(() => {
    let disposed = false;
    const load = async () => {
      if (!selectedRowId) {
        setPhotos((current) => {
          current.forEach((photo) => URL.revokeObjectURL(photo.url));
          return [];
        });
        return;
      }
      const stored = await db.sheetPhotos.where('rowId').equals(selectedRowId).sortBy('createdAt');
      if (disposed) return;
      setPhotos((current) => {
        current.forEach((photo) => URL.revokeObjectURL(photo.url));
        return stored.map((photo) => ({ ...photo, url: URL.createObjectURL(photo.blob) }));
      });
    };
    void load();
    return () => { disposed = true; };
  }, [selectedRowId]);

  useEffect(() => () => { photos.forEach((photo) => URL.revokeObjectURL(photo.url)); }, [photos]);

  const categories = useMemo(() => [...new Set(rows.map((row) => row.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [rows]);
  const filtered = useMemo(() => {
    const q = normalize(search);
    const next = rows.filter((row) => {
      if (category !== 'all' && row.category !== category) return false;
      if (status !== 'all' && row.status !== status) return false;
      if (!q) return true;
      const event = events.find((item) => item.id === row.eventId);
      const custom = Object.values(row.values || {}).join(' ');
      return normalize(`${row.label} ${row.category} ${row.notes || ''} ${row.description || ''} ${event?.title || ''} ${custom}`).includes(q);
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

  const patchRow = async (row: SheetRow, patch: Partial<SheetRow>) => {
    await db.sheetRows.update(row.id, { ...patch, updatedAt: new Date().toISOString() });
    await onChanged();
  };

  const addRow = async () => {
    const id = uid();
    const now = new Date().toISOString();
    await db.sheetRows.add({ id, label: 'Nuevo movimiento', category: 'General', amount: 0, status: 'pending', description: '', notes: '', values: {}, createdAt: now, updatedAt: now });
    await onChanged();
    setSelectedRowId(id);
  };

  const deleteRow = async (row: SheetRow) => {
    if (!window.confirm(`¿Eliminar “${row.label}”?`)) return;
    await db.sheetPhotos.where('rowId').equals(row.id).delete();
    await db.sheetRows.delete(row.id);
    setSelectedRowId(null);
    await onChanged();
  };

  const patchCustom = async (row: SheetRow, column: SheetColumn, value: SheetValue) => {
    await patchRow(row, { values: { ...(row.values || {}), [column.key]: value } });
  };

  const addPhoto = async (files: FileList | null) => {
    if (!selectedRow || !files?.length) return;
    const now = new Date().toISOString();
    const records: SheetPhoto[] = Array.from(files).filter((file) => file.type.startsWith('image/')).map((file) => ({ id: uid(), rowId: selectedRow.id, name: file.name, type: file.type, blob: file, createdAt: now }));
    if (!records.length) return;
    await db.sheetPhotos.bulkAdd(records);
    const stored = await db.sheetPhotos.where('rowId').equals(selectedRow.id).sortBy('createdAt');
    setPhotos((current) => {
      current.forEach((photo) => URL.revokeObjectURL(photo.url));
      return stored.map((photo) => ({ ...photo, url: URL.createObjectURL(photo.blob) }));
    });
  };

  const deletePhoto = async (photo: PhotoView) => {
    await db.sheetPhotos.delete(photo.id);
    setPhotos((current) => current.filter((item) => item.id !== photo.id));
  };

  const addColumn = async () => {
    const name = draftColumn.name.trim();
    if (!name) return;
    let key = keyFromName(name);
    const used = new Set(columns.map((item) => item.key));
    let suffix = 2;
    while (used.has(key)) key = `${keyFromName(name)}_${suffix++}`;
    await db.sheetColumns.add({ id: uid(), name, key, type: draftColumn.type, formula: draftColumn.type === 'formula' ? draftColumn.formula.trim() : undefined, position: columns.length, createdAt: new Date().toISOString() });
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
      const record: Record<string, SheetValue | number> = { Concepto: row.label, Categoría: row.category, Monto: row.amount, Estado: row.status, Evento: event?.title || '', Descripción: row.description || '', Notas: row.notes || '' };
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
    const core = new Set(['concepto', 'categoria', 'categoría', 'monto', 'estado', 'evento', 'descripcion', 'descripción', 'notas']);
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
      const get = (...names: string[]) => { const match = Object.keys(item).find((key) => names.includes(normalize(key))); return match ? item[match] : ''; };
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
      await db.sheetRows.add({ id: uid(), label: String(get('concepto') || 'Movimiento'), category: String(get('categoria') || get('categoría') || 'General'), amount: numberValue(get('monto')), status: rowStatus, eventId: event?.id, description: String(get('descripcion') || get('descripción') || ''), notes: String(get('notas') || ''), values, createdAt: now, updatedAt: now });
    }
    await loadColumns();
    await onChanged();
  };

  return (
    <section className="page-card sheet-classic">
      <div className="sheet-classic-head">
        <div><p className="eyebrow">TABLA</p><h2>Excel</h2></div>
        <div className="sheet-classic-actions">
          <button onClick={() => fileRef.current?.click()} title="Importar"><Upload size={15} /></button>
          <button onClick={exportExcel} title="Exportar"><Download size={15} /></button>
          <button onClick={onAssistant} title="Voz"><Mic size={15} /></button>
          <button className="sheet-add" onClick={() => void addRow()} title="Nueva fila"><Plus size={17} /></button>
        </div>
      </div>

      <input ref={fileRef} className="sheet-file-input" type="file" accept=".xlsx,.xls,.csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importExcel(file); event.currentTarget.value = ''; }} />

      <div className="sheet-mini-summary"><span>Total <b>{money.format(totals.all)}</b></span><span>Pagado <b>{money.format(totals.paid)}</b></span><span>Pendiente <b>{money.format(totals.pending)}</b></span></div>

      <div className="sheet-classic-tools">
        <label><Search size={13} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar" /></label>
        <select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">Categoría</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        <select value={status} onChange={(event) => setStatus(event.target.value as 'all' | SheetStatus)}><option value="all">Estado</option><option value="pending">Pendiente</option><option value="paid">Pagado</option><option value="info">Info</option></select>
        <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)}><option value="newest">Recientes</option><option value="oldest">Antiguos</option><option value="amount-desc">Monto ↓</option><option value="amount-asc">Monto ↑</option><option value="label">A–Z</option></select>
      </div>

      <div className="excel-frame">
        <div className="excel-letters"><span /><span>A</span><span>B</span><span>C</span><span>D</span><span>E</span></div>
        <div className="excel-head"><span>#</span><span>Concepto</span><span>Categoría</span><span>Monto</span><span>Estado</span><span>Evento</span></div>
        <div className="excel-body">
          {filtered.length ? filtered.map((row, index) => {
            const event = events.find((item) => item.id === row.eventId);
            return <button className="excel-row" key={row.id} onClick={() => setSelectedRowId(row.id)}><span className="excel-row-number">{index + 1}</span><span>{row.label}</span><span>{row.category}</span><span className="excel-money">{money.format(row.amount)}</span><span className={`excel-status ${row.status}`}>{shortStatus(row.status)}</span><span>{event?.title || '—'}</span></button>;
          }) : <div className="excel-empty">Sin filas</div>}
        </div>
      </div>
      <p className="sheet-table-hint">Toca cualquier línea para abrir su ficha completa.</p>

      {selectedRow && <div className="sheet-detail-page">
        <header className="sheet-detail-header"><button onClick={() => setSelectedRowId(null)} aria-label="Volver"><ArrowLeft size={21} /></button><div><span>FILA</span><strong>{selectedRow.label}</strong></div><button className="sheet-detail-delete" onClick={() => void deleteRow(selectedRow)} aria-label="Eliminar"><Trash2 size={18} /></button></header>
        <main className="sheet-detail-content">
          <section className="sheet-detail-card sheet-detail-primary">
            <label className="sheet-wide"><span>Concepto</span><input value={selectedRow.label} onChange={(e) => void patchRow(selectedRow, { label: e.target.value })} /></label>
            <label><span>Monto</span><input type="number" inputMode="decimal" value={selectedRow.amount} onChange={(e) => void patchRow(selectedRow, { amount: numberValue(e.target.value) })} /></label>
            <label><span>Categoría</span><input value={selectedRow.category} onChange={(e) => void patchRow(selectedRow, { category: e.target.value })} /></label>
            <label><span>Estado</span><select value={selectedRow.status} onChange={(e) => void patchRow(selectedRow, { status: e.target.value as SheetStatus })}><option value="pending">Pendiente</option><option value="paid">Pagado</option><option value="info">Info</option></select></label>
            <label><span>Evento</span><select value={selectedRow.eventId || ''} onChange={(e) => void patchRow(selectedRow, { eventId: e.target.value || undefined })}><option value="">Sin evento</option>{events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}</select></label>
          </section>

          <section className="sheet-detail-card">
            <div className="sheet-detail-section-title"><div><span>FOTOS</span><small>{photos.length ? `${photos.length} guardada${photos.length === 1 ? '' : 's'}` : 'Solo en este dispositivo'}</small></div><button onClick={() => photoRef.current?.click()}><Camera size={16} /> Añadir</button></div>
            <input ref={photoRef} className="sheet-file-input" type="file" accept="image/*" multiple onChange={(event) => { void addPhoto(event.target.files); event.currentTarget.value = ''; }} />
            {photos.length ? <div className="sheet-photo-grid">{photos.map((photo) => <figure key={photo.id}><img src={photo.url} alt={photo.name} /><button onClick={() => void deletePhoto(photo)}><Trash2 size={14} /></button></figure>)}</div> : <button className="sheet-photo-empty" onClick={() => photoRef.current?.click()}><Camera size={20} /><span>Añadir fotos a esta línea</span></button>}
          </section>

          <section className="sheet-detail-card">
            <label className="sheet-wide"><span>Descripción</span><textarea rows={5} value={selectedRow.description || ''} onChange={(e) => void patchRow(selectedRow, { description: e.target.value })} placeholder="Descripción completa de esta línea…" /></label>
            <label className="sheet-wide"><span>Notas</span><textarea rows={3} value={selectedRow.notes || ''} onChange={(e) => void patchRow(selectedRow, { notes: e.target.value })} placeholder="Notas, referencias, pendientes…" /></label>
          </section>

          <section className="sheet-detail-card">
            <button className="sheet-custom-toggle" onClick={() => setFieldsOpen((current) => !current)}><div><Columns3 size={17} /><span>Campos personalizados</span></div><b>{fieldsOpen ? '−' : '+'}</b></button>
            {fieldsOpen && <div className="sheet-custom-content">
              {columns.map((column) => <div className="sheet-custom-field" key={column.id}><label><span>{column.name}{column.type === 'formula' ? ' ƒ' : ''}</span>{column.type === 'formula' ? <div className="sheet-formula-value">{displayValue(column, formulaValue(column, selectedRow, columns))}</div> : <input type={column.type === 'number' || column.type === 'currency' ? 'number' : column.type === 'date' ? 'date' : 'text'} value={String(selectedRow.values?.[column.key] ?? '')} onChange={(e) => { const value: SheetValue = column.type === 'number' || column.type === 'currency' ? numberValue(e.target.value) : e.target.value; void patchCustom(selectedRow, column, value); }} />}</label><button onClick={() => void deleteColumn(column)} aria-label={`Eliminar ${column.name}`}><Trash2 size={14} /></button></div>)}
              <div className="sheet-new-field"><input value={draftColumn.name} onChange={(e) => setDraftColumn((current) => ({ ...current, name: e.target.value }))} placeholder="Nuevo campo" /><select value={draftColumn.type} onChange={(e) => setDraftColumn((current) => ({ ...current, type: e.target.value as SheetColumn['type'] }))}><option value="text">Texto</option><option value="number">Número</option><option value="currency">Moneda</option><option value="date">Fecha</option><option value="formula">Fórmula</option></select>{draftColumn.type === 'formula' && <input value={draftColumn.formula} onChange={(e) => setDraftColumn((current) => ({ ...current, formula: e.target.value }))} placeholder="=amount*0.16" />}<button disabled={!draftColumn.name.trim()} onClick={() => void addColumn()}><Plus size={15} /> Añadir campo</button></div>
            </div>}
          </section>
        </main>
      </div>}
    </section>
  );
}
