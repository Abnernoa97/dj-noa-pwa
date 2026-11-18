# Capítulo Excel · DJ NOA

**Propietario de interfaz:** `SheetWorkspace.tsx` mantiene el editor clásico, importación/exportación y detalle de filas. `ExcelModulesEnhancer.tsx` monta la cuadrícula dinámica. Ambas piezas son necesarias hasta comprobar una unificación funcional; **no crear una tercera tabla**.

- `useExcelLandscape.ts` controla la orientación al entrar en Excel y solicita vertical al salir.
- `styles/` contiene los seis archivos de estilos de Excel, que siguen cargándose en su orden global original desde `src/main.tsx`.
- Normalización y números compartidos: `src/domains/sheet/sheetValues.ts`, no duplicarlos aquí.
- IndexedDB `dj-noa-local` y finanzas USD siguen siendo contratos independientes.
- No convertir históricos MXN, no contar un anticipo dos veces, no guardar fotos de Noah Visión automáticamente.
- Los tests leen la ruta definitiva `src/features/excel/` y bloquean nuevas copias en la raíz.

**Regla:** un archivo canónico para cada componente, sin espejos ni wrappers obsoletos.
