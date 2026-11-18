# 02 · AUDITORÍA REAL Y ARQUITECTURA OBJETIVO

**Corte inicial verificable:** 18/11/2026, `main` `31d47ae5b9d90ebd86709ebc755240318f2b783a`. Lectura estática de GitHub, NO prueba de teléfono ni diagnóstico completo de código muerto.

## Primeros duplicados confirmados por comparación de código
- `numberValue`: tres implementaciones del mismo parseo de monto (`SheetWorkspace`, `ExcelModulesEnhancer` y `noahExcel`).
- `normalize`: las mismas tres implementaciones de normalización, con distinto nombre local del parámetro.
- `behaviorOf`: dos implementaciones equivalentes (`ExcelModulesEnhancer` y `noahExcel`).
- Se preparó un helper puro en `src/domains/sheet/sheetValues.ts` para reducir duplicación, conservando resultados y requiriendo pruebas de regresión de Cloudflare.
- El build P00 confirmó 0 workflows, importaciones resueltas, tipos y tests; también señaló 11 advertencias de vulnerabilidad npm y un chunk Vite superior a 500 kB. Auditar ambos antes de actualizar dependencias o dividir bundles.

## Inventario
- 117 archivos rastreados, de los que 33 son CSS en `src/` y 39 TS/TSX en `src/`.
- 13 archivos de pruebas bajo `tests/`; pruebas adicionales de IndexedDB en `integration-tests/`.
- 74 ramas antes del respaldo `backup-before-djnoa-master-reorganization-20261118`; cero PR abiertas al corte.
- Tres workflows de GitHub Actions: `build-check.yml`, `excel-landscape-safety.yml` y `finance-vision-safety.yml`, candidatos a eliminar **juntos** al transferir controles a Cloudflare.
- Componentes destacados por tamaño: `src/App.tsx` 36.3 kB, `src/SheetWorkspace.tsx` 33.4 kB, `worker/src/noahChat.ts` 30.6 kB, `src/NoahImageIntake.tsx` 26.4 kB, `src/EventWorkspace.tsx` 25.9 kB y `src/ios-dark-redesign.css` 39.2 kB. Tamaño es indicador de revisión, no defecto.
- PWA Vite/React + Worker Cloudflare + Dexie IndexedDB local. En el árbol también existe `dj-noa-cloud/`, código en pausa y explícitamente fuera de la limpieza de publicación.
- Los estilos se importan en `src/main.tsx` y su orden de cascada es significativo: cambiarlo puede romper la imagen iOS aprobada.

## Inventario de responsabilidades y prioridad
| Fuente | Responsabilidad observada | Hipótesis de trabajo | Prohibición |
|---|---|---|---|
| `src/App.tsx` | Coordinación de pantallas, datos, comandos Noah y efectos | Extraer servicios y acciones con tests de equivalencia | No crear una segunda base de estado |
| `src/SheetWorkspace.tsx` | Excel clásico, importación/exportación, detalle | Distinguir editor de datos de presentador | No cambiar columnas/filas existentes |
| `src/ExcelModulesEnhancer.tsx` | Tabla dinámica montada vía portal, columnas y cálculo | Unificar acceso a operaciones y presentación de totales | No quitar portal antes de migrar consumidores |
| `src/finance.ts`, `src/financialOverview.ts` y `src/moneyIntegrity.ts` | Clasificación financiera y resúmenes USD | Identificar funciones redundantes antes de consolidar | No convertir MXN histórico ni duplicar anticipos |
| `src/eventMutations.ts`, `src/eventIntegrity.ts`, `src/eventSchedule.ts` | Escrituras y reglas compartidas | Mantener único escritor transaccional | No alterar fechas manuales |
| `src/noahImageReconcile.ts` y `src/noahVisionCommit.ts` | Extracción, conciliación, guardado atómico | Contratos claros entre análisis y persistencia | No guardar imágenes de Visión automáticamente |
| `worker/src/entry.ts`, `worker/src/index.ts`, `worker/src/noahChat.ts`, `worker/src/noahImage.ts` | API, recordatorios y AI | Reducir acoplamiento entre rutas | No cambiar bindings ni introducir acceso público |
| `src/ios-dark-redesign.css` y capas de diseño | Diseño final, Excel, deportes, overlays | Inventario de selectores con origen/orden | No corregir diseño por intuición |
| `src/db.ts` | Dexie `dj-noa-local` (versions 1–6) | Fuente canónica de datos local | No resetear, migrar o borrar por limpieza |
| `src/main.tsx` y `vite.config.ts` | Bootstrap, SW, PWA | Preservar recarga/actualización y orientación Excel | No cambiar el scope de la PWA |

## Arquitectura objetivo progresiva (NO mover todo de inmediato)

`src/app/` — entrada, estado y navegación
`src/features/events/` — componentes y editores de eventos
`src/features/calendar/` — vistas y fechas
`src/features/sheet/` — un editor Excel, importación/exportación
`src/features/tasks/` — recordatorios
`src/features/noah/` — voz, visión, reconciliación, comandos
`src/features/sports/` — MLB/NBA
`src/domains/` — reglas puras: eventos, calendarios, finanzas USD, validación de importaciones
`src/services/` — capa IndexedDB/repositorios, notificaciones, APIs
`src/styles/` — cascada coherente, tokens y estilos por módulo
`worker/src/` — entrada estable; rutas/servicios por responsabilidad
`tests/` — contratos de integridad, estructura, finanzas, navegación y visual/offline

Estas rutas son **objetivo**, no reflejan implementación terminada. Antes de cada traslado verificar imports directos/dinámicos, aliases, CSS, assets y bundles. Conservar nombres exportados mientras tengan consumidores reales; borrar el origen **en el mismo cambio** solo tras equivalencia.

## Inventario automatizado P01-c
- `scripts/audit-candidates.mjs` analiza el grafo de importaciones desde las entradas PWA y Worker y reporta candidatos sin referencia, **no** confirma que estén muertos.
- También registra número de hojas CSS, `!important`, reglas `@media` y capas más sobreescritas; estos conteos no se interpretan como defectos.
- Se ejecuta durante el build de Cloudflare antes del typecheck para que el resultado permanezca en los logs de publicación. No tiene escrituras ni efectos en producción.

## Cómo decidir si se borra
- **ACTIVO:** está referenciado por código, HTML, Service Worker, configuración o tests necesarios.
- **HISTÓRICO:** archivo/rama deliberadamente retenido para rollback o datos, no código que se ejecuta.
- **CANDIDATO:** no hay referencias encontradas en el análisis inicial, falta validación semántica.
- **INCIERTO:** carga dinámica, CSS indirecto, plataforma, binding Worker o pruebas físicas por confirmar.
- **OBSOLETO CONFIRMADO:** pruebas + referencias + equivalencia funcional permiten eliminar sin regresión.

El auditor `scripts/audit-structure.mjs` **no borra**; informa candidatos de tamaño y validación. No usar conteos heurísticos como sentencia de archivo muerto.

## Referencias comparadas
- `havana-nice-v2/docs/PLAN-MAESTRO.md`: separación app/features/services/shared, entrada única de Worker.
- `havana-nice-quotes/scripts/project-audit.mjs`: auditoría conservadora y guard de estructura.
- `havana-nice-events/README.md`: identificación de escritores y contratos de IDs, offline.
- `havana-nice-cloud/00-PLAN-MAESTRO-HAVANA-CLOUD`: tablero, bitácora y QA real diferenciada.

Los proyectos comparados no se modificaron. «HAVANA GLOW» no se encontró como repositorio independiente visible en la cuenta conectada; comparación limitada a fuentes inspeccionadas.
