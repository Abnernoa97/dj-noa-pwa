# Dominio Noah · Una lógica por capacidad

- `noahEvents.ts`: contrato de acciones e información financiera de eventos.
- `noahExcel.ts`: modificación controlada de filas y columnas de Excel.
- `noahImageReconcile.ts`: conciliación de información de múltiples fotos.
- `noahVisionCommit.ts`: guardado transaccional de datos revisados sin persistir los archivos originales de Visión.

Comparte reglas de identidad y escrituras de eventos desde `src/domains/events/` y conversiones de celda desde `src/domains/sheet/`. No duplicar ni modificar la lógica USD o las fotos manuales.

- `noahSheetSnapshot.ts`: representación limitada (80 columnas) y filtro de celdas vacías compartidos entre Voz y Visión. No accede a IndexedDB ni guarda fotos.
