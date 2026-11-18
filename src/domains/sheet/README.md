# Dominio único de Excel / Celdas

- `sheetValues.ts`: normalización compartida, `numberValue`, `behaviorOf`, `makeGridColumnKey`. Empleadas por Excel clásico, portal y Noah.
- **Pendiente P01/P04:** un escritor transaccional canónico para cambios de celdas, columnas, filas y recálculos USD; el código actual todavía escribe desde varias superficies. No mover los datos ni cambiar IDs para consolidar.

La hoja visual clásica y el portal pueden seguir siendo dos componentes siempre que compartan reglas y operaciones, sin convertirse en dos motores financieros.

- `sheetFinancial.ts`: **un solo cálculo puro** de ingresos − gastos − inversiones y clasificación del neto. Consumido por Noah y la grilla Excel. La grilla mantiene su regla de no recalcular al editar columnas neutrales ni tocar MXN.
