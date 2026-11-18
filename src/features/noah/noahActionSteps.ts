import type { NoahActionStep, NoahEventPatch, NoahFinanceInput } from '../../domains/noah/noahEvents';

export function financeText(finance: NoahFinanceInput) {
  try {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: finance.currency,
      maximumFractionDigits: 0
    }).format(finance.amount);
  } catch {
    return `${finance.amount} ${finance.currency}`;
  }
}

const fieldLabels: Partial<Record<keyof NoahEventPatch, string>> = {
  title: 'Nombre',
  date: 'Fecha',
  callTime: 'Llamada',
  soundcheckTime: 'Prueba de sonido',
  showTime: 'Show',
  venue: 'Venue',
  address: 'Dirección',
  details: 'Detalles',
  dressCode: 'Vestuario',
  contactName: 'Contacto',
  contactPhone: 'Teléfono',
  mapUrl: 'Google Maps',
  notes: 'Notas',
  status: 'Estado'
};

function fieldValue(key: keyof NoahEventPatch, value: unknown) {
  if (key === 'status') return value === 'confirmed' ? 'Confirmado' : value === 'tentative' ? 'Por confirmar' : value === 'done' ? 'Terminado' : '';
  return String(value ?? '').trim();
}

export function patchEntries(patch: NoahEventPatch) {
  return (Object.entries(patch) as Array<[keyof NoahEventPatch, unknown]>)
    .filter(([key]) => key !== 'time')
    .filter(([key]) => Boolean(fieldLabels[key]));
}

export function progressSteps(entries: Array<[keyof NoahEventPatch, unknown]>, prefix: string, activeIndex: number, complete = false): NoahActionStep[] {
  return [
    { id: `${prefix}-open`, label: prefix === 'create' ? 'Preparando ficha' : 'Abriendo ficha', state: complete || activeIndex > 0 ? 'done' : 'active' },
    ...entries.map(([key, value], index) => ({
      id: `${prefix}-${String(key)}`,
      label: fieldLabels[key] || String(key),
      value: fieldValue(key, value),
      state: complete || index + 1 < activeIndex ? 'done' : index + 1 === activeIndex ? 'active' : 'pending'
    } as NoahActionStep)),
    { id: `${prefix}-save`, label: 'Guardando cambios', state: complete ? 'done' : activeIndex > entries.length ? 'active' : 'pending' }
  ];
}

export function matrixSteps(title: string, date: string, finance: NoahFinanceInput | undefined, stage: number, complete = false): NoahActionStep[] {
  const steps: NoahActionStep[] = [
    { id: 'matrix-calendar', label: 'Calendario', value: date, state: complete || stage > 0 ? 'done' : 'active' },
    { id: 'matrix-event', label: 'Evento', value: title, state: complete || stage > 1 ? 'done' : stage === 1 ? 'active' : 'pending' }
  ];
  if (finance) {
    steps.push({
      id: 'matrix-excel',
      label: 'Excel',
      value: financeText(finance),
      state: complete || stage > 2 ? 'done' : stage === 2 ? 'active' : 'pending'
    });
  }
  steps.push({
    id: 'matrix-link',
    label: 'Sincronizando todo',
    state: complete ? 'done' : stage > (finance ? 2 : 1) ? 'active' : 'pending'
  });
  return steps;
}

export function calendarSeriesSteps(created: number, total: number, monthLabel: string, finance?: NoahFinanceInput, complete = false): NoahActionStep[] {
  const steps: NoahActionStep[] = [
    { id: 'series-pattern', label: 'Patrón entendido', state: 'done' },
    { id: 'series-calendar', label: 'Calendario abierto', state: 'done' },
    {
      id: 'series-write',
      label: complete ? 'Fechas creadas' : 'Agregando fechas',
      value: complete ? `${created}` : `${monthLabel} · ${created}/${total}`,
      state: complete ? 'done' : 'active'
    }
  ];
  if (finance) {
    steps.push({
      id: 'series-excel',
      label: 'Excel vinculado',
      value: complete ? `${created} movimientos` : financeText(finance),
      state: complete ? 'done' : created > 0 ? 'active' : 'pending'
    });
  }
  steps.push({ id: 'series-save', label: 'Sincronizando serie', state: complete ? 'done' : 'pending' });
  return steps;
}

