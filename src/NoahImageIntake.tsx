import { useRef, useState } from 'react';
import { AlertTriangle, Check, ImagePlus, LoaderCircle, Sparkles, X } from 'lucide-react';
import { db } from './db';
import type { NoahChatAction } from './noahExcel';
import type { SheetColumn, SheetValue } from './types';

type Finding = {
  kind: string;
  title: string;
  detail?: string;
  confidence: 'high' | 'medium' | 'low';
};

type AnalysisPayload = {
  text: string;
  rawText?: string;
  warnings: string[];
  findings: Finding[];
  eventActions: NoahChatAction[];
};

type Props = {
  onApply: (actions: NoahChatAction[]) => Promise<void>;
};

function hasCellValue(value: SheetValue | undefined) {
  return value !== undefined && value !== null && value !== '';
}

function columnSnapshot(columns: SheetColumn[]) {
  return columns.slice(0, 80).map((column) => ({
    id: column.id,
    name: column.name,
    key: column.key,
    type: column.type,
    behavior: column.behavior || 'neutral',
    position: column.position
  }));
}

function actionLabel(action: NoahChatAction) {
  if (action.type === 'create_event') {
    return `${action.event.title} · ${action.event.date}`;
  }
  if (action.type === 'create_calendar_series') {
    return `${action.event.title} · ${action.startDate} → ${action.endDate}`;
  }
  if (action.type === 'create_sheet_row') {
    const label = action.row.label || 'Movimiento';
    return `${label} · ${action.row.amount} ${action.row.currency}`;
  }
  if (action.type === 'create_sheet_grid_row') return `Excel · ${action.label}`;
  if (action.type === 'navigate_section') {
    const names: Record<string, string> = { calendar: 'Calendario', events: 'Eventos', sheet: 'Excel' };
    return `Abrir ${names[action.section] || action.section}`;
  }
  return 'Acción detectada';
}

function actionKind(action: NoahChatAction) {
  if (action.type === 'create_event' || action.type === 'create_calendar_series') return 'CALENDARIO + EVENTOS';
  if (action.type === 'create_sheet_row' || action.type === 'create_sheet_grid_row') return 'EXCEL';
  if (action.type === 'navigate_section') return 'VISTA';
  return 'NOAH';
}

async function compressImage(file: File) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('image_decode_failed'));
      img.src = objectUrl;
    });

    const render = (maxSide: number, quality: number) => {
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('canvas_unavailable');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0, width, height);
      return canvas.toDataURL('image/jpeg', quality);
    };

    let dataUrl = render(2200, 0.92);
    if (dataUrl.length > 4_600_000) dataUrl = render(1800, 0.86);
    if (dataUrl.length > 4_600_000) dataUrl = render(1500, 0.8);
    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export default function NoahImageIntake({ onApply }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [analysis, setAnalysis] = useState<AnalysisPayload | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');

  const reset = () => {
    setOpen(false);
    setAnalyzing(false);
    setApplying(false);
    setPreviewUrl('');
    setFileName('');
    setAnalysis(null);
    setSelected(new Set());
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const analyze = async (file: File) => {
    setOpen(true);
    setAnalyzing(true);
    setError('');
    setAnalysis(null);
    setFileName(file.name);

    try {
      if (!/^image\/(jpeg|jpg|png|webp)$/i.test(file.type)) throw new Error('format');
      if (file.size > 16 * 1024 * 1024) throw new Error('size');

      const imageDataUrl = await compressImage(file);
      setPreviewUrl(imageDataUrl);

      const [events, rows, columns] = await Promise.all([
        db.events.orderBy('date').toArray(),
        db.sheetRows.orderBy('createdAt').reverse().toArray(),
        db.sheetColumns.orderBy('position').toArray()
      ]);

      const currentColumns = columns.slice(0, 80);
      const response = await fetch('/api/noah-image', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          imageDataUrl,
          fileName: file.name,
          context: {
            localDateTime: new Date().toString(),
            events: events.slice(0, 160).map((event) => ({
              id: event.id,
              title: event.title,
              date: event.date,
              showTime: event.showTime || event.time,
              venue: event.venue,
              status: event.status
            })),
            sheetColumns: columnSnapshot(currentColumns),
            sheetRows: rows.slice(0, 120).map((row) => ({
              id: row.id,
              label: row.label,
              category: row.category,
              amount: row.amount,
              currency: row.currency || 'MXN',
              financialType: row.financialType,
              calendarDate: row.calendarDate,
              cells: currentColumns
                .map((column) => ({
                  columnId: column.id,
                  columnName: column.name,
                  value: row.values?.[column.key]
                }))
                .filter((cell) => hasCellValue(cell.value))
            }))
          }
        })
      });

      if (!response.ok) throw new Error(`analysis_${response.status}`);
      const payload = await response.json() as AnalysisPayload;
      const actions = Array.isArray(payload.eventActions) ? payload.eventActions : [];
      const normalized: AnalysisPayload = {
        text: String(payload.text || 'Imagen analizada.'),
        rawText: String(payload.rawText || ''),
        warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
        findings: Array.isArray(payload.findings) ? payload.findings : [],
        eventActions: actions
      };
      setAnalysis(normalized);
      setSelected(new Set(actions.map((_, index) => index)));
    } catch (reason) {
      const message = String((reason as Error)?.message || '');
      if (message === 'format') setError('Usa una foto JPG, PNG o WEBP.');
      else if (message === 'size') setError('La imagen es demasiado grande.');
      else setError('Noah no pudo analizar esta foto. Intenta otra vez.');
    } finally {
      setAnalyzing(false);
    }
  };

  const apply = async () => {
    if (!analysis || applying) return;
    const actions = analysis.eventActions.filter((_, index) => selected.has(index));
    if (!actions.length) {
      setError('No hay acciones seleccionadas para guardar.');
      return;
    }

    setApplying(true);
    setError('');
    setOpen(false);
    try {
      await onApply(actions);
      reset();
    } catch {
      setOpen(true);
      setApplying(false);
      setError('Una de las acciones no pudo completarse. No se continuó con el resto.');
    }
  };

  const toggle = (index: number) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <>
      <input
        ref={inputRef}
        className="noah-image-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void analyze(file);
        }}
      />

      <button
        className="noah-image-trigger"
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label="Subir foto a Noah"
        title="Analizar foto con Noah"
      >
        <ImagePlus size={20} />
      </button>

      {open ? <div className="noah-image-backdrop" role="dialog" aria-modal="true" aria-label="Análisis de imagen con Noah">
        <section className="noah-image-panel">
          <header className="noah-image-head">
            <div>
              <span>NOAH · VISIÓN</span>
              <h2>{analyzing ? 'Leyendo la imagen' : 'Esto es lo que entendí'}</h2>
            </div>
            <button type="button" onClick={reset} aria-label="Cerrar"><X size={22} /></button>
          </header>

          {previewUrl ? <div className="noah-image-preview">
            <img src={previewUrl} alt="" />
            <div><span>FUENTE</span><strong>{fileName || 'Imagen'}</strong></div>
          </div> : null}

          {analyzing ? <div className="noah-image-thinking">
            <LoaderCircle size={28} className="spin" />
            <strong>Entendiendo fechas, eventos, montos y relaciones…</strong>
            <span>Noah todavía no está guardando nada.</span>
          </div> : null}

          {error ? <div className="noah-image-warning error"><AlertTriangle size={18} /><span>{error}</span></div> : null}

          {!analyzing && analysis ? <>
            <div className="noah-image-summary">
              <Sparkles size={18} />
              <p>{analysis.text}</p>
            </div>

            {analysis.findings.length ? <div className="noah-image-findings">
              <div className="noah-image-section-title">LECTURA</div>
              {analysis.findings.map((item, index) => <article key={`${item.title}-${index}`}>
                <div>
                  <span>{item.kind.toUpperCase()}</span>
                  <i className={item.confidence}>{item.confidence === 'high' ? 'ALTA' : item.confidence === 'medium' ? 'MEDIA' : 'BAJA'}</i>
                </div>
                <strong>{item.title}</strong>
                {item.detail ? <p>{item.detail}</p> : null}
              </article>)}
            </div> : null}

            {analysis.warnings.length ? <div className="noah-image-warnings">
              {analysis.warnings.map((warning, index) => <div className="noah-image-warning" key={index}><AlertTriangle size={16} /><span>{warning}</span></div>)}
            </div> : null}

            <div className="noah-image-plan">
              <div className="noah-image-section-title">PLAN · {selected.size}/{analysis.eventActions.length}</div>
              {analysis.eventActions.length ? analysis.eventActions.map((action, index) => {
                const checked = selected.has(index);
                return <button type="button" className={checked ? 'selected' : ''} key={index} onClick={() => toggle(index)}>
                  <span className="noah-image-check">{checked ? <Check size={15} /> : null}</span>
                  <div><small>{actionKind(action)}</small><strong>{actionLabel(action)}</strong></div>
                </button>;
              }) : <div className="noah-image-empty">No encontré acciones suficientemente claras para guardar.</div>}
            </div>

            {analysis.rawText ? <details className="noah-image-raw">
              <summary>Texto leído en la imagen</summary>
              <p>{analysis.rawText}</p>
            </details> : null}

            <footer className="noah-image-actions">
              <button type="button" className="secondary" onClick={reset}>Cancelar</button>
              <button type="button" className="primary" disabled={!selected.size || applying} onClick={() => void apply()}>
                {applying ? 'ORGANIZANDO…' : 'ORGANIZAR TODO'}
              </button>
            </footer>
          </> : null}
        </section>
      </div> : null}
    </>
  );
}
