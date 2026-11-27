# DJ NOA · Calendario inspirado en HAVANA CALENDARIO V31

**Propietario:** `src/features/calendar/`. La pantalla anterior de Mes/Semana/Día fue sustituida por cuatro vistas: Calendario, Eventos, Cotizaciones y Resumen, más papelera recuperable.

## Código organizado por responsabilidad
- `CalendarWorkspace.tsx`: navegación interna, colores locales por estado, papelera y conexiones con las acciones que proporciona `App.tsx`.
- `HavanaMonthView.tsx`: cuadrícula mensual, etiquetas de eventos y agenda del día con tareas y Excel vinculados.
- `HavanaListView.tsx`: Eventos por realizar/realizados y Cotizaciones futuras/pasadas, años desplegables, estados, búsqueda, selección múltiple y portadas de fotos locales bajo demanda.
- `HavanaSummaryView.tsx`: estadísticas locales, rankings de venues/planners/ciudades, historial anual y acceso a Noah, sin HAVANA ANALYTIC.
- `havanaCalendarModel.ts`: fechas, estados, filtros y recuentos puros; conserva `tentative` → Por concretar, `confirmed` → Concretado y `done` → Realizado.
- `styles/calendar.css`: estructura, mes y agenda del día. `styles/calendar-focus.css`: móvil, scroll y tamaños. `styles/calendar-week-day.css`: listas anuales, resumen, ajustes y papelera (se conserva nombre de archivo por el orden de cascada existente).

## Datos, IA y seguridad
- Solo se usan `dj-noa-local`, `db.events`, `db.eventPhotos`, `db.reminders` y `db.sheetRows` ya existentes; no hay nueva DB, bucket, API, cookies o sincronización de HAVANA.
- No se importan registros, cotizaciones ni imágenes de HAVANA CALENDARIO; ninguna conexión D1/R2 o puente HAVANA QUOTES. La IA del calendario es **Noah**, mediante el asistente existente de DJ NOA.
- Los nuevos campos opcionales de evento `weddingPlanner`, `city` y `quote` no requieren migración Dexie y son solo descripciones; los importes USD contratados/recibidos siguen saliendo exclusivamente del capítulo financiero de Excel.
- `src/domains/events/eventTrash.ts` es la operación reversible de papelera: marca `trashedAt` sin cambiar IDs ni borrar fotos, tareas o Excel; la eliminación definitiva sigue en `deleteEventWithRelations` con una confirmación explícita.
- `src/app/App.tsx` entrega todos los callbacks y filtra únicamente eventos archivados fuera de las vistas/IA; la copia de seguridad existente conserva objetos completos.
- No se copia el motor HAVANA ANALYTIC, su historial, su voz, sus conexiones de Google ni el bridge HAVANA QUOTES.

**Criterio de cierre:** probar creación y edición, movimiento a papelera/restauración, fechas originadas en Noah y ficha Evento, scroll y visualización en iPhone/Android, enlaces de Excel y recordatorios, fotos locales sin red y la actualización PWA. Las pruebas de compilación no sustituyen esa QA visual.
