# Capítulo Seguridad y mantenimiento

- `DataSafetyPanel.tsx`: exportar y restaurar copias de datos locales, con la misma interfaz existente.
- `AppMaintenance.tsx`: tareas de mantenimiento ya implementadas, sin crear copias de datos.
- `styles/`: apariencia original de protección de datos.

La capa de operaciones de respaldo permanece en `src/services/storage/`. El almacenamiento sigue siendo Dexie `dj-noa-local` y no se borra ni migra en esta reorganización.
