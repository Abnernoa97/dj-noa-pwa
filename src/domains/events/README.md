# Dominio Eventos · reglas canónicas

- `eventIntegrity.ts`: validación, identidad y relaciones con filas de Excel.
- `eventMutations.ts`: creación, actualización y borrado transaccional de eventos y vínculos, escritor único.
- `eventSchedule.ts`: reglas de horario y recordatorios vinculados al evento.

**No crear una segunda mutación** dentro de Calendario, Excel o Noah. Proteger Dexie `dj-noa-local`, USD operacional e históricos, idempotencia y fechas de cobros independientes.
