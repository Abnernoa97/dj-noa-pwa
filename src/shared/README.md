# Contratos compartidos · DJ NOA

- `types.ts`: tipos e interfaces de Eventos, Calendario, Excel, Tareas y navegación; **un único contrato**, no volver a copiar las interfaces a cada módulo.
- `normalizeText.ts`: regla común de normalización de conceptos que comparten Excel, Finanzas y Noah.

Los tipos son contratos de almacenamiento y de interfaz. Las migraciones de Dexie se mantienen en `src/services/storage/db.ts`. `CurrencyCode` incluye MXN exclusivamente para conservar históricos existentes; los registros operativos nuevos se validan como USD en el dominio de finanzas/Excel.

- `collectionOps.ts`: selección inmutable de IDs con Set para acordeones y listas de Eventos/Excel.
