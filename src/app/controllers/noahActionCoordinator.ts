import type { Dispatch, SetStateAction } from 'react';
import { addDays, format, parseISO, startOfMonth } from 'date-fns';
import { db, uid } from '../../services/storage/db';
import { normalizedEventIdentity } from '../../domains/events/eventIntegrity';
import { financeText, patchEntries, progressSteps, matrixSteps, calendarSeriesSteps } from '../../features/noah/noahActionSteps';
import { createEventWithRelations, createEventsWithRelations, updateEventWithRelations, deleteEventWithRelations, syncEventFinance } from '../../domains/events/eventMutations';
import { eventActionLabel, sectionName, type NoahActionActivity, type NoahActionStep, type NoahEventAction, type NoahEventActionResult } from '../../domains/noah/noahEvents';
import type { AppView, EventItem, SheetRow } from '../../shared/types';

type Setter<T> = Dispatch<SetStateAction<T>>;
type Context = {
  events: EventItem[];
  sheetRows: SheetRow[];
  eventHubId: string | null;
  navigateTo: (view: AppView) => void;
  refresh: () => Promise<void>;
  showNoahActivity: (activity: NoahActionActivity) => void;
  setMlbOpen: Setter<boolean>;
  setEventEditorOpen: Setter<boolean>;
  setSelectedEvent: Setter<EventItem | null>;
  setEventCreateDate: Setter<string | null>;
  setEventHubId: Setter<string | null>;
  setMonth: Setter<Date>;
  setNoahCalendarDates: Setter<string[]>;
  setEvents: Setter<EventItem[]>;
  setSheetRows: Setter<SheetRow[]>;
  setSelectedSheetRowId: Setter<string | null>;
};

function sortEvents(items: EventItem[]) {
  return [...items].sort((a, b) => `${a.date}T${a.showTime || a.time || '00:00'}`.localeCompare(`${b.date}T${b.showTime || b.time || '00:00'}`));
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

/**
 * Cross-feature Noah command coordinator.
 * App passes current screen state and setters; the actual event / Excel
 * persistence remains in their existing transactional domain owners.
 * No React hook, alternate app store or second navigation stack is created.
 */
export function createNoahActionExecutor(context: Context) {
  const {
    events, sheetRows, eventHubId, navigateTo, refresh, showNoahActivity,
    setMlbOpen, setEventEditorOpen, setSelectedEvent, setEventCreateDate,
    setEventHubId, setMonth, setNoahCalendarDates, setEvents, setSheetRows, setSelectedSheetRowId
  } = context;

  const executeNoahEventAction = async (action: NoahEventAction): Promise<NoahEventActionResult> => {
    const label = eventActionLabel(action, events);

    try {
      setMlbOpen(false);
      setEventEditorOpen(false);
      setSelectedEvent(null);
      setEventCreateDate(null);

      if (action.type === 'navigate_section') {
        const name = sectionName(action.section);
        showNoahActivity({ phase: 'working', title: `Pasando a ${name}`, detail: 'Cambiando de contexto', scope: 'NAVEGACIÓN' });
        setEventHubId(null);
        if (action.section === 'calendar') setMonth(startOfMonth(new Date()));
        navigateTo(action.section);
        await sleep(180);
        showNoahActivity({ phase: 'done', title: name, detail: 'Listo', scope: 'NAVEGACIÓN' });
        return { ok: true, message: `Perfecto, pasamos a ${name}.` };
      }

      if (action.type === 'open_events') {
        showNoahActivity({ phase: 'working', ...label });
        setEventHubId(null);
        navigateTo('events');
        await sleep(150);
        showNoahActivity({ phase: 'done', title: 'Eventos', detail: 'Agenda lista', scope: 'EVENTOS' });
        return { ok: true, message: 'Aquí están tus eventos.' };
      }

      if (action.type === 'create_sheet_row') {
        if (action.row.currency !== 'USD') return { ok: false, message: 'DJ NOA opera solo en USD. No modifiqué el monto ni lo convertí.' };
        const now = new Date().toISOString();
        // Only an exact, unique name+date match may auto-link a financial
        // movement. A similar venue, date alone, or repeated event is not enough.
        const date = action.row.calendarDate;
        const title = (action.row.label || '').trim();
        const possibleEvents = date && title
          ? events.filter((candidate) => candidate.date === date &&
              normalizedEventIdentity(candidate.title, candidate.date) === normalizedEventIdentity(title, date))
          : [];
        const uniqueEvent = possibleEvents.length === 1 ? possibleEvents[0] : undefined;
        const row: SheetRow = {
          id: uid(),
          label: action.row.label || 'Movimiento',
          category: action.row.category || (action.row.financialType === 'expense' ? 'Gasto' : 'General'),
          amount: action.row.amount,
          currency: action.row.currency,
          status: action.row.status || 'pending',
          financialType: action.row.financialType || 'neutral',
          eventId: uniqueEvent?.id,
          calendarDate: action.row.calendarDate,
          calendarDateSource: date ? 'manual' : undefined,
          syncManaged: false,
          notes: action.row.notes,
          description: action.row.description,
          values: {},
          createdAt: now,
          updatedAt: now
        };
        showNoahActivity({
          phase: 'working',
          title: 'Agregando a Excel',
          detail: row.label,
          scope: 'EXCEL',
          steps: [
            { id: 'sheet-read', label: 'Movimiento entendido', value: financeText(action.row), state: 'done' },
            { id: 'sheet-write', label: 'Escribiendo fila', state: 'active' },
            { id: 'sheet-save', label: 'Guardando', state: 'pending' }
          ]
        });
        await db.sheetRows.add(row);
        setSheetRows((current) => [row, ...current]);
        await sleep(160);
        if (action.surface === 'calendar' && row.calendarDate) {
          navigateTo('calendar');
          setMonth(startOfMonth(parseISO(row.calendarDate)));
          setNoahCalendarDates([row.calendarDate]);
        } else {
          navigateTo('sheet');
          setSelectedSheetRowId(row.id);
        }
        showNoahActivity({
          phase: 'done',
          title: 'Movimiento guardado',
          detail: `${row.label} · ${financeText(action.row)}`,
          scope: 'EXCEL',
          steps: [
            { id: 'sheet-read', label: 'Movimiento entendido', value: financeText(action.row), state: 'done' },
            { id: 'sheet-write', label: 'Fila creada', state: 'done' },
            { id: 'sheet-save', label: 'Guardado', state: 'done' }
          ]
        });
        return { ok: true, message: uniqueEvent ? 'Listo, quedó en Excel y vinculado al evento.' : 'Listo, quedó en Excel.' };
      }

      if (action.type === 'create_calendar_series') {
        const start = parseISO(action.startDate);
        const end = parseISO(action.endDate);
        const wantedWeekdays = new Set(action.weekdays);
        const dates: string[] = [];
        for (let day = start; day <= end; day = addDays(day, 1)) {
          if (wantedWeekdays.has(day.getDay())) dates.push(format(day, 'yyyy-MM-dd'));
        }
        if (!dates.length) {
          showNoahActivity({ phase: 'error', title: 'No encontré fechas', detail: 'Revisa el patrón solicitado', scope: 'CALENDARIO' });
          return { ok: false, message: 'No encontré fechas para ese patrón.' };
        }

        setEventHubId(null);
        navigateTo('calendar');
        setMonth(startOfMonth(start));
        setNoahCalendarDates([]);
        showNoahActivity({
          phase: 'working',
          title: action.finance ? 'Construyendo matriz' : 'Creando serie en Calendario',
          detail: action.event.title,
          scope: action.finance ? 'MATRIZ' : 'CALENDARIO',
          steps: calendarSeriesSteps(0, dates.length, 'Preparando', action.finance)
        });
        await sleep(160);

        const monthGroups = new Map<string, string[]>();
        for (const date of dates) {
          const key = date.slice(0, 7);
          const group = monthGroups.get(key) || [];
          group.push(date);
          monthGroups.set(key, group);
        }

        let created = 0;
        let skipped = 0;
        const firstMonthDates = monthGroups.values().next().value as string[] | undefined;

        for (const groupDates of monthGroups.values()) {
          const monthDate = startOfMonth(parseISO(groupDates[0]));
          const monthLabel = format(monthDate, 'MMMM yyyy', { locale: es });
          setMonth(monthDate);
          setNoahCalendarDates(groupDates);

          const drafts = groupDates.map((date) => ({
            title: action.event.title.trim(),
            date,
            time: action.event.showTime ?? action.event.time ?? '',
            callTime: action.event.callTime,
            soundcheckTime: action.event.soundcheckTime,
            showTime: action.event.showTime ?? action.event.time ?? '',
            venue: action.event.venue,
            address: action.event.address,
            details: action.event.details,
            dressCode: action.event.dressCode,
            contactName: action.event.contactName,
            contactPhone: action.event.contactPhone,
            mapUrl: action.event.mapUrl,
            notes: action.event.notes,
            status: action.event.status || 'confirmed' as const
          }));
          // Each month is a single transaction: event + Excel or neither.
          const batchResult = await createEventsWithRelations(drafts, {
            finance: action.finance,
            createExcelConcept: !action.finance,
            skipDuplicates: true
          });
          created += batchResult.created.length;
          skipped += batchResult.skipped;
          if (batchResult.created.length) {
            setEvents((current) => sortEvents([...current, ...batchResult.created]));
          }
          if (batchResult.sheetRows.length) {
            setSheetRows((current) => [...batchResult.sheetRows, ...current]);
          }

          showNoahActivity({
            phase: 'working',
            title: action.finance ? 'Sincronizando matriz' : 'Escribiendo en Calendario',
            detail: action.event.title,
            scope: action.finance ? 'MATRIZ' : 'CALENDARIO',
            steps: calendarSeriesSteps(created + skipped, dates.length, monthLabel, action.finance)
          });
          await sleep(125);
        }

        if (firstMonthDates?.length) {
          setMonth(startOfMonth(parseISO(firstMonthDates[0])));
          setNoahCalendarDates(firstMonthDates);
        }
        const detail = skipped ? `${created} creados · ${skipped} ya existían` : `${created} eventos creados`;
        showNoahActivity({
          phase: 'done',
          title: action.finance ? 'Matriz sincronizada' : 'Serie creada',
          detail,
          scope: action.finance ? 'MATRIZ' : 'CALENDARIO',
          steps: calendarSeriesSteps(created + skipped, dates.length, '', action.finance, true)
        });
        return {
          ok: true,
          message: action.finance
            ? `Listo, creé ${created} eventos con Excel vinculado.`
            : skipped ? `Listo. Creé ${created} y omití ${skipped} que ya existían.` : `Listo, creé ${created} eventos en Calendario.`
        };
      }

      if (action.type === 'create_event') {
        const calendarSurface = action.surface !== 'events';
        const syncExcel = Boolean(action.finance || action.createExcelConcept);
        const scope = syncExcel ? 'MATRIZ' : calendarSurface ? 'CALENDARIO' : 'EVENTOS';
        const entries = patchEntries(action.event);
        showNoahActivity({
          phase: 'working',
          title: syncExcel ? 'Construyendo matriz' : 'Creando evento',
          detail: action.event.title,
          scope,
          steps: action.finance ? matrixSteps(action.event.title, action.event.date, action.finance, 0) : progressSteps(entries, 'create', 0)
        });
        setEventHubId(null);
        if (calendarSurface) {
          navigateTo('calendar');
          setMonth(startOfMonth(parseISO(action.event.date)));
          setNoahCalendarDates([action.event.date]);
        } else {
          navigateTo('events');
        }
        await sleep(150);

        const now = new Date().toISOString();
        const showTime = action.event.showTime ?? action.event.time ?? '';
        let item: EventItem = {
          id: uid(),
          title: action.event.title.trim(),
          date: action.event.date,
          time: showTime,
          callTime: action.event.callTime,
          soundcheckTime: action.event.soundcheckTime,
          showTime,
          venue: action.event.venue,
          address: action.event.address,
          details: action.event.details,
          dressCode: action.event.dressCode,
          contactName: action.event.contactName,
          contactPhone: action.event.contactPhone,
          mapUrl: action.event.mapUrl,
          notes: action.event.notes,
          status: action.event.status || 'confirmed',
          createdAt: now,
          updatedAt: now
        };

        if (action.finance) {
          showNoahActivity({ phase: 'working', title: 'Construyendo matriz', detail: item.title, scope: 'MATRIZ', steps: matrixSteps(item.title, item.date, action.finance, 1) });
        }
        const result = await createEventWithRelations(item, {
          finance: action.finance,
          createExcelConcept: Boolean(action.createExcelConcept) || Boolean(action.finance),
          skipDuplicates: true
        });
        if (result.skipped || !result.event) {
          showNoahActivity({ phase: 'done', title: 'Evento existente', detail: `${item.title} · ${item.date}`, scope });
          return { ok: true, message: 'El evento ya existe en esa fecha. No dupliqué sus registros.' };
        }
        item = result.event;
        setEvents((current) => sortEvents([...current, item]));
        if (result.row) setSheetRows((current) => [result.row!, ...current]);
        await sleep(130);

        if (action.finance) {
          showNoahActivity({ phase: 'working', title: 'Sincronizando Excel', detail: item.title, scope: 'MATRIZ', steps: matrixSteps(item.title, item.date, action.finance, 2) });
          // Finance was committed together with the event in one transaction.
          await sleep(130);
          showNoahActivity({ phase: 'working', title: 'Vinculando todo', detail: item.title, scope: 'MATRIZ', steps: matrixSteps(item.title, item.date, action.finance, 3) });
          await sleep(120);
        } else if (action.createExcelConcept) {
          showNoahActivity({
            phase: 'working',
            title: 'Creando concepto en Excel',
            detail: item.title,
            scope: 'MATRIZ',
            steps: [
              { id: 'photo-calendar', label: 'Calendario', value: item.date, state: 'done' },
              { id: 'photo-event', label: 'Evento', value: item.title, state: 'done' },
              { id: 'photo-excel', label: 'Excel · concepto', value: item.title, state: 'active' },
              { id: 'photo-money', label: 'Monto', value: 'Pendiente', state: 'pending' }
            ]
          });
          // The empty Excel concept was committed with the event.
          await sleep(130);
        }

        if (!calendarSurface) setEventHubId(item.id);
        showNoahActivity({
          phase: 'done',
          title: syncExcel ? 'Todo sincronizado' : 'Evento creado',
          detail: item.title,
          scope,
          steps: action.finance
            ? matrixSteps(item.title, item.date, action.finance, 4, true)
            : action.createExcelConcept
              ? [
                  { id: 'photo-calendar', label: 'Calendario', value: item.date, state: 'done' },
                  { id: 'photo-event', label: 'Evento', value: item.title, state: 'done' },
                  { id: 'photo-excel', label: 'Excel · concepto', value: item.title, state: 'done' },
                  { id: 'photo-money', label: 'Monto', value: 'Pendiente', state: 'done' }
                ]
              : progressSteps(entries, 'create', entries.length + 2, true)
        });
        return {
          ok: true,
          message: action.finance
            ? 'Listo, quedó sincronizado en Calendario, Eventos y Excel.'
            : action.createExcelConcept
              ? 'Listo, quedó en Calendario, Eventos y Excel. El monto queda pendiente.'
              : calendarSurface ? 'Listo, ya está en Calendario.' : 'Listo, evento creado.'
        };
      }

      const target = events.find((event) => event.id === action.eventId);
      if (!target) {
        showNoahActivity({ phase: 'error', title: 'Evento no encontrado', detail: 'No hice cambios', scope: 'EVENTOS' });
        return { ok: false, message: 'No encontré ese evento.' };
      }

      if (action.type === 'sync_event_finance') {
        showNoahActivity({
          phase: 'working',
          title: 'Sincronizando monto',
          detail: target.title,
          scope: 'MATRIZ',
          steps: [
            { id: 'finance-event', label: 'Evento localizado', value: target.title, state: 'done' },
            { id: 'finance-excel', label: 'Excel', value: financeText(action.finance), state: 'active' },
            { id: 'finance-link', label: 'Vínculo por eventId', state: 'pending' }
          ]
        });
        const row = await syncEventFinance(target.id, action.finance);
        await sleep(150);
        if (action.surface === 'calendar') {
          navigateTo('calendar');
          setMonth(startOfMonth(parseISO(target.date)));
          setNoahCalendarDates([target.date]);
        } else if (action.surface === 'events') {
          navigateTo('events');
          setEventHubId(target.id);
        } else {
          navigateTo('sheet');
          setSelectedSheetRowId(row.id);
        }
        showNoahActivity({
          phase: 'done',
          title: 'Monto sincronizado',
          detail: `${target.title} · ${financeText(action.finance)}`,
          scope: 'MATRIZ',
          steps: [
            { id: 'finance-event', label: 'Evento localizado', value: target.title, state: 'done' },
            { id: 'finance-excel', label: 'Excel actualizado', value: financeText(action.finance), state: 'done' },
            { id: 'finance-link', label: 'Vínculo por eventId', state: 'done' }
          ]
        });
        return { ok: true, message: 'Listo, el monto quedó sincronizado con el evento.' };
      }

      if (action.type === 'open_event') {
        showNoahActivity({ phase: 'working', title: 'Abriendo ficha', detail: target.title, scope: 'EVENTOS' });
        navigateTo('events');
        setEventHubId(target.id);
        await sleep(160);
        showNoahActivity({ phase: 'done', title: target.title, detail: 'Ficha abierta', scope: 'EVENTOS' });
        return { ok: true, message: 'Aquí está.' };
      }

      if (action.type === 'update_event') {
        const entries = patchEntries(action.patch);
        const linkedRows = sheetRows.filter((row) => row.eventId === target.id);
        showNoahActivity({ phase: 'working', title: 'Actualizando evento', detail: target.title, scope: linkedRows.length && action.patch.date ? 'MATRIZ' : 'EVENTOS', steps: progressSteps(entries, 'update', 0) });
        navigateTo('events');
        setEventHubId(target.id);
        await sleep(200);

        // Apply all fields and inherited dates in a single transaction.
        const currentTarget = await updateEventWithRelations(target.id, action.patch);
        setEvents((current) => sortEvents(current.map((event) => event.id === target.id ? currentTarget : event)));
        await refresh();

        showNoahActivity({ phase: 'done', title: 'Evento actualizado', detail: currentTarget.title, scope: linkedRows.length && action.patch.date ? 'MATRIZ' : 'EVENTOS', steps: progressSteps(entries, 'update', entries.length + 2, true) });
        return { ok: true, message: linkedRows.length && action.patch.date ? 'Listo, moví el evento y mantuve Excel sincronizado.' : 'Listo, quedó actualizado.' };
      }

      if (action.type === 'delete_event') {
        const steps: NoahActionStep[] = [
          { id: 'delete-locate', label: 'Evento localizado', value: target.title, state: 'active' },
          { id: 'delete-links', label: 'Revisando vínculos', state: 'pending' },
          { id: 'delete-final', label: 'Eliminando', state: 'pending' }
        ];
        navigateTo('events');
        setEventHubId(target.id);
        showNoahActivity({ phase: 'working', title: 'Eliminando evento', detail: target.title, scope: 'EVENTOS', steps });
        await sleep(220);
        showNoahActivity({ phase: 'working', title: 'Eliminando evento', detail: target.title, scope: 'EVENTOS', steps: steps.map((step, index) => ({ ...step, state: index === 0 ? 'done' : index === 1 ? 'active' : 'pending' })) });
        await sleep(220);
        await deleteEventWithRelations(target.id);
        if (eventHubId === target.id) setEventHubId(null);
        await refresh();
        showNoahActivity({ phase: 'done', title: 'Evento eliminado', detail: target.title, scope: 'EVENTOS', steps: steps.map((step) => ({ ...step, state: 'done' })) });
        return { ok: true, message: 'Listo, quedó eliminado.' };
      }

      showNoahActivity({ phase: 'error', title: 'Acción no disponible', detail: 'No hice cambios', scope: 'EVENTOS' });
      return { ok: false, message: 'Esa acción todavía no está disponible.' };
    } catch {
      showNoahActivity({ phase: 'error', title: 'No pude completar la acción', detail: label.detail, scope: label.scope || 'EVENTOS' });
      return { ok: false, message: 'No pude completar ese cambio.' };
    }
  };
  return executeNoahEventAction;
}
