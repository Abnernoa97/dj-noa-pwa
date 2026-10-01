import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { liveQuery } from 'dexie';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { db, uid } from './db';
import type { SheetColumn, SheetColumnBehavior, SheetRow, SheetValue } from './types';

const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

const BEHAVIOR_LABEL: Record<SheetColumnBehavior, string> = {
  income: 'Ingreso · suma',
  expense: 'Gasto · resta',
  investment: 'Inversión · resta',
  neutral: 'Dato · no calcula'
};

function normalize(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function numberValue(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? '').replace(/[$,\s]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function behaviorOf(column: SheetColumn): SheetColumnBehavior {
  return column.behavior || 'neutral';
}

function legacyBehavior(row: SheetRow): SheetColumnBehavior {
  if (row.financialType === 'expense') return 'expense';
  if (row.financialType === 'income') return 'income';
  const hint = normalize(`${row.category} ${row.label}`);
  if (/\b(inversion|invertir|inversiones)\b/.test(hint)) return 'investment';
  if (/\b(gasto|gastos|costo|costos)\b/.test(hint)) return 'expense';
  return 'income';
}

function makeKey(name: string) {
  const slug = normalize(name).replace(/\s+/g, '_') || 'columna';
  return `grid_${slug}_${uid().slice(0, 6)}`;
}

export default function ExcelModulesEnhancer() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [columns, setColumns] = useState<SheetColumn[]>([]);
  const [columnsLoaded, setColumnsLoaded] = useState(false);
  const [newColumnOpen, setNewColumnOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnBehavior, setNewColumnBehavior] = useState<SheetColumnBehavior>('expense');
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const seedingRef = useRef(false);

  useEffect(() => {
    let currentRoot: HTMLElement | null = null;
    let currentHost: HTMLElement | null = null;

    const syncHost = () => {
      const root = document.querySelector<HTMLElement>('.sheet-classic');
      if (!root) {
        if (currentRoot) currentRoot.classList.remove('excel-classic-grid-active');
        currentRoot = null;
        currentHost = null;
        setHost(null);
        return;
      }
      if (root === currentRoot && currentHost?.isConnected) return;

      if (currentRoot && currentRoot !== root) currentRoot.classList.remove('excel-classic-grid-active');
      currentRoot = root;
      root.classList.add('excel-classic-grid-active');

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
      currentRoot?.classList.remove('excel-classic-grid-active');
      currentHost?.remove();
    };
  }, []);

  useEffect(() => {
    const rowSubscription = liveQuery(() => db.sheetRows.toArray()).subscribe({ next: setRows });
    const columnSubscription = liveQuery(() => db.sheetColumns.orderBy('position').toArray()).subscribe({
      next: (next) => {
        setColumns(next);
        setColumnsLoaded(true);
      }
    });
    return () => {
      rowSubscription.unsubscribe();
      columnSubscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!columnsLoaded || columns.length || seedingRef.current) return;
    seedingRef.current = true;
    void db.transaction('rw', db.sheetColumns, async () => {
      if (await db.sheetColumns.count()) return;
      const now = new Date().toISOString();
      await db.sheetColumns.bulkAdd([
        { id: uid(), name: 'Ingreso', key: makeKey('Ingreso'), type: 'currency', behavior: 'income', position: 0, createdAt: now },
        { id: uid(), name: 'Gasto', key: makeKey('Gasto'), type: 'currency', behavior: 'expense', position: 1, createdAt: now }
      ]);
    }).finally(() => { seedingRef.current = false; });
  }, [columnsLoaded, columns.length]);

  const storedFinancialValueExists = (row: SheetRow) => columns.some((column) => {
    if (behaviorOf(column) === 'neutral') return false;
    const value = row.values?.[column.key];
    return value !== undefined && value !== null && value !== '' && numberValue(value) !== 0;
  });

  const effectiveCellValue = (row: SheetRow, column: SheetColumn): SheetValue => {
    const stored = row.values?.[column.key];
    if (stored !== undefined && stored !== null && stored !== '') return stored;
    const behavior = behaviorOf(column);
    if (behavior === 'neutral' || !row.amount || storedFinancialValueExists(row)) return '';
    const desired = legacyBehavior(row);
    const preferred = columns.find((item) => behaviorOf(item) === desired)
      || columns.find((item) => behaviorOf(item) !== 'neutral');
    return preferred?.id === column.id ? row.amount : '';
  };

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    let investment = 0;
    for (const row of rows) {
      for (const column of columns) {
        const behavior = behaviorOf(column);
        if (behavior === 'neutral') continue;
        const value = numberValue(effectiveCellValue(row, column));
        if (behavior === 'income') income += value;
        if (behavior === 'expense') expense += value;
        if (behavior === 'investment') investment += value;
      }
    }
    return { income, expense, investment, balance: income - expense - investment };
  }, [rows, columns]);

  const addRow = async () => {
    const now = new Date().toISOString();
    await db.sheetRows.add({
      id: uid(),
      label: '',
      category: 'General',
      amount: 0,
      status: 'pending',
      financialType: 'neutral',
      description: '',
      notes: '',
      values: {},
      createdAt: now,
      updatedAt: now
    });
  };

  const patchLabel = async (row: SheetRow, label: string) => {
    await db.sheetRows.update(row.id, { label, updatedAt: new Date().toISOString() });
  };

  const patchCell = async (row: SheetRow, column: SheetColumn, rawValue: string) => {
    const behavior = behaviorOf(column);
    const value: SheetValue = behavior === 'neutral' ? rawValue : numberValue(rawValue);
    const values = { ...(row.values || {}), [column.key]: value };
    const patch: Partial<SheetRow> = { values, updatedAt: new Date().toISOString() };

    if (behavior !== 'neutral') {
      let income = 0;
      let expense = 0;
      let investment = 0;
      for (const item of columns) {
        const itemBehavior = behaviorOf(item);
        if (itemBehavior === 'neutral') continue;
        const itemValue = numberValue(values[item.key]);
        if (itemBehavior === 'income') income += itemValue;
        if (itemBehavior === 'expense') expense += itemValue;
        if (itemBehavior === 'investment') investment += itemValue;
      }
      const net = income - expense - investment;
      patch.amount = Math.abs(net);
      patch.financialType = net > 0 ? 'income' : net < 0 ? 'expense' : 'neutral';
    }

    await db.sheetRows.update(row.id, patch);
  };

  const deleteRow = async (row: SheetRow) => {
    if (!window.confirm(`¿Eliminar la fila “${row.label || 'sin nombre'}”?`)) return;
    await db.transaction('rw', [db.sheetRows, db.sheetPhotos], async () => {
      await db.sheetPhotos.where('rowId').equals(row.id).delete();
      await db.sheetRows.delete(row.id);
    });
  };

  const createColumn = async () => {
    const name = newColumnName.trim();
    if (!name) return;
    const now = new Date().toISOString();
    const position = columns.length ? Math.max(...columns.map((column) => column.position)) + 1 : 0;
    await db.sheetColumns.add({
      id: uid(),
      name,
      key: makeKey(name),
      type: newColumnBehavior === 'neutral' ? 'text' : 'currency',
      behavior: newColumnBehavior,
      position,
      createdAt: now
    });
    setNewColumnName('');
    setNewColumnBehavior('expense');
    setNewColumnOpen(false);
    window.dispatchEvent(new Event('djnoa:sheet-columns-changed'));
  };

  const startEditColumn = (column: SheetColumn) => {
    setEditingColumnId(column.id);
    setEditingName(column.name);
    setNewColumnOpen(false);
  };

  const renameColumn = async (column: SheetColumn) => {
    const name = editingName.trim();
    if (!name || name === column.name) return;
    await db.sheetColumns.update(column.id, { name });
    window.dispatchEvent(new Event('djnoa:sheet-columns-changed'));
  };

  const changeColumnBehavior = async (column: SheetColumn, behavior: SheetColumnBehavior) => {
    await db.sheetColumns.update(column.id, {
      behavior,
      type: behavior === 'neutral' ? 'text' : 'currency'
    });
    window.dispatchEvent(new Event('djnoa:sheet-columns-changed'));
  };

  const deleteColumn = async (column: SheetColumn) => {
    if (!window.confirm(`¿Eliminar la columna “${column.name}” y sus datos?`)) return;
    await db.transaction('rw', [db.sheetColumns, db.sheetRows], async () => {
      await db.sheetColumns.delete(column.id);
      const allRows = await db.sheetRows.toArray();
      for (const row of allRows) {
        const values = { ...(row.values || {}) };
        delete values[column.key];
        await db.sheetRows.update(row.id, { values, updatedAt: new Date().toISOString() });
      }
    });
    setEditingColumnId(null);
    window.dispatchEvent(new Event('djnoa:sheet-columns-changed'));
  };

  const editingColumn = columns.find((column) => column.id === editingColumnId) || null;
  const minimumWidth = Math.max(360, 42 + 138 + columns.length * 112 + 46);
  const gridTemplateColumns = `42px 138px ${columns.map(() => '112px').join(' ')} 46px`;

  if (!host) return null;

  return createPortal(
    <section className="excel-classic-grid" aria-label="Hoja de cálculo personalizada">
      <div className="excel-grid-summary">
        <div><span>BALANCE</span><strong>{money.format(totals.balance)}</strong></div>
        <div><span>INGRESOS</span><strong>{money.format(totals.income)}</strong></div>
        <div><span>SALIDAS</span><strong>{money.format(totals.expense + totals.investment)}</strong></div>
      </div>

      <div className="excel-grid-toolbar">
        <div><span>HOJA</span><strong>Mi tabla</strong></div>
        <div>
          <button type="button" onClick={() => void addRow()}><Plus size={15} /> Fila</button>
          <button type="button" className="primary" onClick={() => { setNewColumnOpen(true); setEditingColumnId(null); }}><Plus size={15} /> Columna</button>
        </div>
      </div>

      {newColumnOpen && <div className="excel-grid-column-editor">
        <div className="excel-grid-editor-head"><strong>Nueva columna</strong><button type="button" onClick={() => setNewColumnOpen(false)} aria-label="Cerrar"><X size={16} /></button></div>
        <input autoFocus value={newColumnName} onChange={(event) => setNewColumnName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void createColumn(); }} placeholder="Nombre: Hotel, Anticipo, Equipo…" />
        <select value={newColumnBehavior} onChange={(event) => setNewColumnBehavior(event.target.value as SheetColumnBehavior)}>
          <option value="income">Ingreso · suma</option>
          <option value="expense">Gasto · resta</option>
          <option value="investment">Inversión · resta</option>
          <option value="neutral">Dato · no calcula</option>
        </select>
        <button type="button" className="save" disabled={!newColumnName.trim()} onClick={() => void createColumn()}><Check size={15} /> Crear columna</button>
      </div>}

      {editingColumn && <div className="excel-grid-column-editor">
        <div className="excel-grid-editor-head"><strong>Editar columna</strong><button type="button" onClick={() => setEditingColumnId(null)} aria-label="Cerrar"><X size={16} /></button></div>
        <input value={editingName} onChange={(event) => setEditingName(event.target.value)} onBlur={() => void renameColumn(editingColumn)} onKeyDown={(event) => { if (event.key === 'Enter') { void renameColumn(editingColumn); setEditingColumnId(null); } }} />
        <select value={behaviorOf(editingColumn)} onChange={(event) => void changeColumnBehavior(editingColumn, event.target.value as SheetColumnBehavior)}>
          <option value="income">Ingreso · suma</option>
          <option value="expense">Gasto · resta</option>
          <option value="investment">Inversión · resta</option>
          <option value="neutral">Dato · no calcula</option>
        </select>
        <button type="button" className="danger" onClick={() => void deleteColumn(editingColumn)}><Trash2 size={15} /> Eliminar columna</button>
      </div>}

      <div className="excel-grid-scroll">
        <div className="excel-grid-sheet" style={{ minWidth: minimumWidth }}>
          <div className="excel-grid-row excel-grid-head" style={{ gridTemplateColumns }}>
            <div className="excel-grid-index">#</div>
            <div className="excel-grid-concept">Concepto</div>
            {columns.map((column) => <button type="button" className={`excel-grid-column-head ${behaviorOf(column)}`} key={column.id} onClick={() => startEditColumn(column)}>
              <strong>{column.name}</strong><small>{BEHAVIOR_LABEL[behaviorOf(column)]}</small><Pencil size={11} />
            </button>)}
            <button type="button" className="excel-grid-add-column" onClick={() => { setNewColumnOpen(true); setEditingColumnId(null); }} aria-label="Agregar columna"><Plus size={17} /></button>
          </div>

          {rows.length ? rows.map((row, index) => <div className="excel-grid-row excel-grid-data-row" style={{ gridTemplateColumns }} key={row.id}>
            <button type="button" className="excel-grid-index row-action" onClick={() => void deleteRow(row)} title="Eliminar fila"><span>{index + 1}</span><Trash2 size={11} /></button>
            <div className="excel-grid-concept excel-grid-cell"><input value={row.label} onChange={(event) => void patchLabel(row, event.target.value)} placeholder="Concepto…" /></div>
            {columns.map((column) => {
              const behavior = behaviorOf(column);
              const value = effectiveCellValue(row, column);
              return <div className={`excel-grid-cell ${behavior}`} key={column.id}>
                <input
                  type={behavior === 'neutral' ? 'text' : 'number'}
                  inputMode={behavior === 'neutral' ? 'text' : 'decimal'}
                  value={String(value ?? '')}
                  onChange={(event) => void patchCell(row, column, event.target.value)}
                  placeholder={behavior === 'neutral' ? '—' : '0'}
                  aria-label={`${column.name}, fila ${index + 1}`}
                />
              </div>;
            })}
            <div className="excel-grid-row-end" />
          </div>) : <button type="button" className="excel-grid-empty" onClick={() => void addRow()}><Plus size={20} /><span>Agrega tu primera fila</span></button>}
        </div>
      </div>

      <button type="button" className="excel-grid-add-row" onClick={() => void addRow()}><Plus size={15} /> Nueva fila</button>
      <p className="excel-grid-note">Toca el nombre de una columna para decidir si suma, resta o solo guarda información.</p>
    </section>,
    host
  );
}
