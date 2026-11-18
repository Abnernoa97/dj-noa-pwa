# Capítulo Eventos

- `EventWorkspace.tsx`: vistas, editor y ficha de evento.
- `styles/`: apariencia del capítulo; se importa desde `src/main.tsx` en el orden original.
- Las reglas de identidad, fechas y escritura **no están duplicadas aquí**: viven en `src/domains/events/`.
- Los eventos existentes conservan `eventId`, `date`, `updatedAt` y relaciones con Excel y Tareas. No hay migración de Dexie.
