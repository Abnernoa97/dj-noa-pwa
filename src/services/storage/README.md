# Servicios de almacenamiento

- `dataBackup.ts`: exportación/restauración de datos del usuario con el contrato existente.
- La base `dj-noa-local` y sus índices/versiones son **contratos protegidos**. No editar ni resetear el esquema como parte de reorganizar carpetas.
- La ubicación del código no afecta los datos IndexedDB guardados bajo el mismo origen.

- `db.ts`: única instancia Dexie `dj-noa-local` y único esquema de migraciones 1–6; las siete tablas no cambian.
- `dataBackup.ts`: exportación/importación de respaldos locales que utiliza esa misma instancia, sin bases duplicadas.

- `sheetMutations.ts`: única transacción de eliminación de filas Excel **junto con sus fotos**. Noah y la vista de grilla delegan borrado individual; `SheetWorkspace` delega selección múltiple. Mantiene `Table.delete` para uno y `bulkDelete` en selección, sin alterar versiones Dexie.

- `sheetColumnMutations.ts`: único borrado de columna y limpieza de valores por transacción para las dos vistas Excel y Noah. Si se borra una columna financiera, recalcula solo filas USD que tenían una celda de esa columna; conserva registros manuales y montos MXN. Columnas neutrales no modifican dinero.

- `sheetColumnMutations.ts` también concentra `createGridSheetColumn`: creación única para el Excel financiero y las órdenes de Noah, con comprobación de nombre existente dentro de una transacción. El editor de columnas clásicas conserva su contrato de claves de fórmula.

- `updateSheetColumn` en `sheetColumnMutations.ts`: único cambio de nombre y comportamiento para la grilla Excel y Noah, con nombres normalizados sin colisiones. Cambio financiero y actualización de filas USD afectadas ocurren en **una misma transacción**. Las filas sin esa celda, importes manuales y registros históricos MXN mantienen su valor.
