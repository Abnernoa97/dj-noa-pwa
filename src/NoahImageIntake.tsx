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
  sourceName?: string;
};

type DraftEvent = {
  title: string;
  dateText: string;
  dateISO: string | null;
  monthDay: string | null;
  showTime?: string;
  venue?: string;
  address?: string;
  notes?: string;
  confidence: 'high' | 'medium' | 'low';
};

type AnalysisPayload = {
  text: string;
  rawText?: string;
  warnings: string[];
  findings: Finding[];
  draftEvents: DraftEvent[];
  pendingExcelAmounts?: number;
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

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('file_read_failed'));
    reader.readAsDataURL(blob);
  });
}

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

async function compressImage(file: File) {
  const objectUrl = URL.createObjectURL(file);
  let image: HTMLImageElement | null = null;

  try {
    image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('image_decode_failed'));
      img.src = objectUrl;
    });

    const render = async (maxSide: number, quality: number) => {
      const scale = Math.min(1, maxSide / Math.max(image!.naturalWidth, image!.naturalHeight));
      const width = Math.max(1, Math.round(image!.naturalWidth * scale));
      const height = Math.max(1, Math.round(image!.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('canvas_unavailable');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(image!, 0, 0, width, height);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas!.toBlob((value) => value ? resolve(value) : reject(new Error('image_encode_failed')), 'image/jpeg', quality);
      });
      const dataUrl = await blobToDataUrl(blob);
      canvas.width = 1;
      canvas.height = 1;
      return dataUrl;
    };

    let dataUrl = await render(1800, 0.88);
    if (dataUrl.length > 4_500_000) dataUrl = await render(1500, 0.82);
    if (dataUrl.length > 4_500_000) dataUrl = await render(1200, 0.76);
    return dataUrl;
  } catch (error) {
    if (file.size <= 3_300_000) return blobToDataUrl(file);
    throw error;
  } finally {
    if (image) image.src = '';
    URL.revokeObjectURL(objectUrl);
  }
}

async function requestImageAnalysis(
  imageDataUrl: string,
  fileName: string,
  context: Record<string, unknown>
) {
  let lastStatus = 0;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch('/api/noah-image', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ imageDataUrl, fileName, context })
    });
    if (response.ok) return response.json() as Promise<AnalysisPayload>;

    lastStatus = response.status;
    if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 2) break;
    await wait(700 * (attempt + 1));
  }
  throw new Error(`analysis_${lastStatus || 'failed'}`);
}

export default function NoahImageIntake({ onApply }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [previews, setPreviews] = useState<Array<{ url: string; name: string; state: 'pending' | 'reading' | 'done' | 'error' }>>([]);
  const [analysisProgress, setAnalysisProgress] = useState({ current: 0, total: 0 });
  const [analysis, setAnalysis] = useState<AnalysisPayload | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selectedDrafts, setSelectedDrafts] = useState<Set<number>>(new Set());
  const [documentYear, setDocumentYear] = useState('');
  const [error, setError] = useState('');

  const reset = () => {
    previews.forEach((preview) => {
      if (preview.url.startsWith('blob:')) URL.revokeObjectURL(preview.url);
    });
    setOpen(false);
    setAnalyzing(false);
    setApplying(false);
    setPreviews([]);
    setAnalysisProgress({ current: 0, total: 0 });
    setAnalysis(null);
    setSelected(new Set());
    setSelectedDrafts(new Set());
    setDocumentYear('');
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const analyze = async (incomingFiles: File[]) => {
    const files = incomingFiles.slice(0, 5);
    if (!files.length) return;

    setOpen(true);
    setAnalyzing(true);
    setError('');
    setAnalysis(null);
    previews.forEach((preview) => {
      if (preview.url.startsWith('blob:')) URL.revokeObjectURL(preview.url);
    });
    const initialPreviews = files.map((file) => ({
      url: URL.createObjectURL(file),
      name: file.name,
      state: 'pending' as const
    }));
    setPreviews(initialPreviews);
    setAnalysisProgress({ current: 0, total: files.length });

    try {
      for (const file of files) {
        if (!/^image\/(jpeg|jpg|png|webp)$/i.test(file.type)) throw new Error('format');
        if (file.size > 16 * 1024 * 1024) throw new Error('size');
      }

      const [events, rows, columns] = await Promise.all([
        db.events.orderBy('date').toArray(),
        db.sheetRows.orderBy('createdAt').reverse().toArray(),
        db.sheetColumns.orderBy('position').toArray()
      ]);

      const currentColumns = columns.slice(0, 80);
      const context = {
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
      };

      const payloads: Array<{ payload: AnalysisPayload; fileName: string }> = [];
      const failed: string[] = [];

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        setAnalysisProgress({ current: index + 1, total: files.length });

        try {
          setPreviews((current) => current.map((preview, previewIndex) =>
            previewIndex === index ? { ...preview, state: 'reading' } : preview
          ));
          const imageDataUrl = await compressImage(file);
          const payload = await requestImageAnalysis(imageDataUrl, file.name, context);
          payloads.push({ payload, fileName: file.name });
          setPreviews((current) => current.map((preview, previewIndex) =>
            previewIndex === index ? { ...preview, state: 'done' } : preview
          ));
        } catch {
          failed.push(file.name);
          setPreviews((current) => current.map((preview, previewIndex) =>
            previewIndex === index ? { ...preview, state: 'error' } : preview
          ));
        }

        if (index < files.length - 1) await wait(350);
      }

      if (!payloads.length) throw new Error('all_failed');

      const actionMap = new Map<string, NoahChatAction>();
      const draftMap = new Map<string, DraftEvent>();
      const findingMap = new Map<string, Finding>();
      const warningSet = new Set<string>();
      const rawParts: string[] = [];
      let pendingExcelAmounts = 0;

      const actionKey = (action: NoahChatAction) => {
        if (action.type === 'create_event') return `event|${action.event.title.toLowerCase()}|${action.event.date}`;
        if (action.type === 'create_calendar_series') return `series|${action.event.title.toLowerCase()}|${action.startDate}|${action.endDate}`;
        if (action.type === 'create_sheet_row') return `sheet|${String(action.row.label || '').toLowerCase()}|${action.row.calendarDate || ''}|${action.row.amount}`;
        if (action.type === 'create_sheet_grid_row') return `grid|${action.label.toLowerCase()}|${JSON.stringify(action.cells)}`;
        if (action.type === 'navigate_section') return `nav|${action.section}`;
        return JSON.stringify(action);
      };

      payloads.forEach(({ payload, fileName }, payloadIndex) => {
        const actions = Array.isArray(payload.eventActions) ? payload.eventActions : [];
        const drafts = Array.isArray(payload.draftEvents) ? payload.draftEvents : [];
        const findings = Array.isArray(payload.findings) ? payload.findings : [];
        const warnings = Array.isArray(payload.warnings) ? payload.warnings : [];

        actions.forEach((action) => {
          const key = actionKey(action);
          if (!actionMap.has(key)) actionMap.set(key, action);
        });

        drafts.forEach((draft) => {
          const key = `${draft.title.toLowerCase()}|${draft.dateISO || draft.monthDay || draft.dateText}`;
          if (!draftMap.has(key)) draftMap.set(key, draft);
        });

        findings.forEach((finding) => {
          const enriched = { ...finding, sourceName: fileName };
          const key = `${finding.kind}|${finding.title.toLowerCase()}|${finding.detail || ''}`;
          if (!findingMap.has(key)) findingMap.set(key, enriched);
        });

        warnings.forEach((warning) => warningSet.add(files.length > 1 ? `Foto ${payloadIndex + 1}: ${warning}` : warning));
        if (payload.rawText) rawParts.push(`IMAGEN ${payloadIndex + 1} · ${fileName}\n${payload.rawText}`);
        pendingExcelAmounts += Number(payload.pendingExcelAmounts || 0);
      });

      failed.forEach((name) => warningSet.add(`No pude leer “${name}”. Las demás imágenes sí fueron procesadas.`));

      const actions = [...actionMap.values()];
      const drafts = [...draftMap.values()];
      const findings = [...findingMap.values()];
      const normalized: AnalysisPayload = {
        text: files.length === 1
          ? String(payloads[0]?.payload.text || 'Imagen analizada.')
          : `${payloads.length} de ${files.length} imágenes analizadas · ${findings.length} elementos detectados.`,
        rawText: rawParts.join('\n\n'),
        warnings: [...warningSet],
        findings,
        draftEvents: drafts,
        pendingExcelAmounts,
        eventActions: actions
      };

      setAnalysis(normalized);
      setSelected(new Set(actions.map((_, index) => index)));
      setSelectedDrafts(new Set(drafts.map((_, index) => index)));
    } catch (reason) {
      const message = String((reason as Error)?.message || '');
      if (message === 'format') setError('Usa solamente fotos JPG, PNG o WEBP.');
      else if (message === 'size') setError('Una de las imágenes es demasiado grande.');
      else setError('Noah no pudo analizar estas imágenes. Intenta otra vez.');
    } finally {
      setAnalyzing(false);
    }
  };

  const apply = async () => {
    if (!analysis || applying) return;
    const actions = analysis.eventActions.filter((_, index) => selected.has(index));
    const year = Number(documentYear);
    const selectedPending = analysis.draftEvents.filter((_, index) => selectedDrafts.has(index));
    if (selectedPending.length && (!Number.isInteger(year) || year < 2000 || year > 2100)) {
      setError('Confirma el año del documento para organizar estas fechas.');
      return;
    }
    for (const draft of selectedPending) {
      if (!draft.monthDay) continue;
      actions.push({
        type: 'create_event',
        surface: 'calendar',
        createExcelConcept: true,
        event: {
          title: draft.title,
          date: `${year}-${draft.monthDay}`,
          showTime: draft.showTime,
          venue: draft.venue,
          address: draft.address,
          notes: draft.notes,
          status: 'confirmed'
        }
      });
    }
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

  const toggleDraft = (index: number) => {
    setSelectedDrafts((current) => {
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
        multiple
        onChange={(event) => {
          const files = Array.from(event.target.files || []).slice(0, 5);
          if (files.length) void analyze(files);
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

          {previews.length ? <div className="noah-image-preview-strip">
            {previews.map((preview, index) => <div className="noah-image-preview" key={`${preview.name}-${index}`}>
              <img src={preview.url} alt="" />
              <div>
                <span>IMAGEN {index + 1} · {preview.state === 'pending' ? 'EN ESPERA' : preview.state === 'reading' ? 'LEYENDO' : preview.state === 'done' ? 'LISTA' : 'ERROR'}</span>
                <strong>{preview.name}</strong>
              </div>
            </div>)}
          </div> : null}

          {analyzing ? <div className="noah-image-thinking">
            <LoaderCircle size={28} className="spin" />
            <strong>{analysisProgress.total > 1 ? `Leyendo imagen ${analysisProgress.current} de ${analysisProgress.total}` : 'Entendiendo fechas, eventos, montos y relaciones…'}</strong>
            <span>Cada imagen se analiza por separado. Noah todavía no está guardando nada.</span>
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
                  <span>{item.kind.toUpperCase()}{item.sourceName && previews.length > 1 ? ` · ${item.sourceName}` : ''}</span>
                  <i className={item.confidence}>{item.confidence === 'high' ? 'ALTA' : item.confidence === 'medium' ? 'MEDIA' : 'BAJA'}</i>
                </div>
                <strong>{item.title}</strong>
                {item.detail ? <p>{item.detail}</p> : null}
              </article>)}
            </div> : null}

            {analysis.warnings.length ? <div className="noah-image-warnings">
              {analysis.warnings.map((warning, index) => <div className="noah-image-warning" key={index}><AlertTriangle size={16} /><span>{warning}</span></div>)}
            </div> : null}

            {analysis.draftEvents.length ? <div className="noah-image-year">
              <div>
                <span>AÑO DEL DOCUMENTO</span>
                <strong>Falta solo este dato para crear los eventos.</strong>
              </div>
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={documentYear}
                placeholder="2026"
                onChange={(event) => setDocumentYear(event.target.value.replace(/\D/g, '').slice(0, 4))}
                aria-label="Año del documento"
              />
            </div> : null}

            <div className="noah-image-plan">
              <div className="noah-image-section-title">PLAN · {selected.size + selectedDrafts.size}/{analysis.eventActions.length + analysis.draftEvents.length}</div>
              {analysis.draftEvents.map((draft, index) => {
                const checked = selectedDrafts.has(index);
                const date = draft.monthDay ? `${documentYear || 'AÑO'}-${draft.monthDay}` : draft.dateText;
                return <button type="button" className={checked ? 'selected' : ''} key={`draft-${index}`} onClick={() => toggleDraft(index)}>
                  <span className="noah-image-check">{checked ? <Check size={15} /> : null}</span>
                  <div><small>CALENDARIO + EVENTOS + EXCEL</small><strong>{draft.title} · {date}</strong><em>Excel: Concepto creado · monto pendiente</em></div>
                </button>;
              })}
              {analysis.eventActions.length ? analysis.eventActions.map((action, index) => {
                const checked = selected.has(index);
                return <button type="button" className={checked ? 'selected' : ''} key={index} onClick={() => toggle(index)}>
                  <span className="noah-image-check">{checked ? <Check size={15} /> : null}</span>
                  <div><small>{actionKind(action)}</small><strong>{actionLabel(action)}</strong></div>
                </button>;
              }) : analysis.draftEvents.length ? null : <div className="noah-image-empty">No encontré acciones suficientemente claras para guardar.</div>}
            </div>

            {analysis.rawText ? <details className="noah-image-raw">
              <summary>Texto leído en la imagen</summary>
              <p>{analysis.rawText}</p>
            </details> : null}

            <footer className="noah-image-actions">
              <button type="button" className="secondary" onClick={reset}>Cancelar</button>
              <button type="button" className="primary" disabled={!(selected.size || selectedDrafts.size) || applying} onClick={() => void apply()}>
                {applying ? 'ORGANIZANDO…' : 'ORGANIZAR TODO'}
              </button>
            </footer>
          </> : null}
        </section>
      </div> : null}
    </>
  );
}
