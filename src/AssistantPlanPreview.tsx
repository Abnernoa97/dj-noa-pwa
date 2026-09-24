import { useEffect, useState } from 'react';
import type { AssistantAction, AssistantResponse } from './types';

type PlanPreview = {
  id: string;
  total: number;
  summary: string;
  steps: string[];
};

type PreviewDetail = PlanPreview & {
  finish: (proceed: boolean) => void;
};

const PREVIEW_EVENT = 'djnoa:plan-preview';

function isMutation(action: AssistantAction) {
  return [
    'create_event', 'update_event', 'delete_event',
    'create_reminder', 'update_reminder', 'delete_reminder',
    'add_sheet_row', 'update_sheet_row', 'delete_sheet_row', 'add_sheet_column'
  ].includes(action.type);
}

function actionFamily(action: AssistantAction): 'events' | 'tasks' | 'excel' | 'other' {
  if (['create_event', 'update_event', 'delete_event'].includes(action.type)) return 'events';
  if (['create_reminder', 'update_reminder', 'delete_reminder'].includes(action.type)) return 'tasks';
  if (['add_sheet_row', 'update_sheet_row', 'delete_sheet_row', 'add_sheet_column'].includes(action.type)) return 'excel';
  return 'other';
}

function stepLabel(action: AssistantAction) {
  if (action.type === 'create_event') return `Crear evento · ${action.title}`;
  if (action.type === 'update_event') return `Actualizar evento${action.title ? ` · ${action.title}` : ''}`;
  if (action.type === 'delete_event') return 'Eliminar evento';
  if (action.type === 'create_reminder') return `Crear tarea · ${action.title}`;
  if (action.type === 'update_reminder') return `Actualizar tarea${action.title ? ` · ${action.title}` : ''}`;
  if (action.type === 'delete_reminder') return 'Eliminar tarea';
  if (action.type === 'add_sheet_row') return `Agregar a Excel · ${action.label}`;
  if (action.type === 'update_sheet_row') return `Actualizar Excel${action.label ? ` · ${action.label}` : ''}`;
  if (action.type === 'delete_sheet_row') return 'Eliminar fila de Excel';
  if (action.type === 'add_sheet_column') return `Crear columna · ${action.name}`;
  if (action.type === 'navigate') return `Abrir ${action.view === 'sheet' ? 'Excel' : action.view === 'reminders' ? 'Tareas' : action.view === 'calendar' ? 'Calendario' : action.view === 'events' ? 'Eventos' : 'Inicio'}`;
  if (action.type === 'open_map') return 'Abrir ubicación';
  return '';
}

function buildPreview(actions: AssistantAction[]): PlanPreview | null {
  const meaningful = actions.filter((action) => action.type !== 'none' && action.type !== 'query_total');
  const mutations = meaningful.filter(isMutation);
  const families = new Set(mutations.map(actionFamily).filter((family) => family !== 'other'));

  const isLarge = mutations.length >= 4 || (mutations.length >= 3 && families.size >= 2);
  if (!isLarge) return null;

  const counts = mutations.reduce((acc, action) => {
    const family = actionFamily(action);
    if (family !== 'other') acc[family] += 1;
    return acc;
  }, { events: 0, tasks: 0, excel: 0 });

  const parts: string[] = [];
  if (counts.events) parts.push(`${counts.events} ${counts.events === 1 ? 'evento' : 'eventos'}`);
  if (counts.tasks) parts.push(`${counts.tasks} ${counts.tasks === 1 ? 'tarea' : 'tareas'}`);
  if (counts.excel) parts.push(`${counts.excel} ${counts.excel === 1 ? 'movimiento' : 'movimientos'} en Excel`);

  return {
    id: crypto.randomUUID(),
    total: mutations.length,
    summary: parts.join(' · '),
    steps: mutations.map(stepLabel).filter(Boolean).slice(0, 4)
  };
}

export async function previewAssistantResponse(response: AssistantResponse): Promise<AssistantResponse> {
  const plan = buildPreview(response.actions);
  if (!plan) return response;

  const proceed = await new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(value);
    };
    const timer = window.setTimeout(() => finish(true), 1900);
    window.dispatchEvent(new CustomEvent<PreviewDetail>(PREVIEW_EVENT, {
      detail: { ...plan, finish }
    }));
  });

  if (proceed) return response;
  return {
    reply: 'Cancelado antes de empezar. No hice cambios.',
    actions: [{ type: 'none', message: 'Plan cancelado por el usuario.' }]
  };
}

export default function AssistantPlanPreview() {
  const [preview, setPreview] = useState<PreviewDetail | null>(null);

  useEffect(() => {
    const onPreview = (event: Event) => {
      const detail = (event as CustomEvent<PreviewDetail>).detail;
      setPreview(detail);
    };
    window.addEventListener(PREVIEW_EVENT, onPreview);
    return () => window.removeEventListener(PREVIEW_EVENT, onPreview);
  }, []);

  if (!preview) return null;

  const finish = (proceed: boolean) => {
    preview.finish(proceed);
    setPreview(null);
  };

  return (
    <div className="dj-plan-preview" role="status" aria-live="polite">
      <div className="dj-plan-top">
        <div>
          <span>DJ NOA · PLAN</span>
          <strong>{preview.summary}</strong>
        </div>
        <small>{preview.total} PASOS</small>
      </div>
      <div className="dj-plan-steps">
        {preview.steps.map((step, index) => <span key={`${preview.id}-${index}`}>{step}</span>)}
      </div>
      <div className="dj-plan-actions">
        <button className="dj-plan-cancel" onClick={() => finish(false)}>CANCELAR</button>
        <button className="dj-plan-start" onClick={() => finish(true)}>EMPEZAR AHORA</button>
      </div>
      <div className="dj-plan-timer"><span /></div>
    </div>
  );
}
