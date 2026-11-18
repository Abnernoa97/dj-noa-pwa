# Dominio único de Excel / Celdas

- `sheetValues.ts`: normalización compartida, `numberValue`, `behaviorOf`, `makeGridColumnKey`. Empleadas por Excel clásico, portal y Noah.
- **Pendiente P01/P04:** un escritor transaccional canónico para cambios de celdas, columnas, filas y recálculos USD; el código actual todavía escribe desde varias superficies. No mover los datos ni cambiar IDs para consolidar.

La hoja visual clásica y el portal pueden seguir siendo dos componentes siempre que compartan reglas y operaciones, sin convertirse en dos motores financieros.
