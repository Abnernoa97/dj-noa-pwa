# 04 · BITÁCORA DE CAMBIOS Y DECISIONES

Este documento registra **hechos verificados**; no equivale a un nuevo plan. No escribir «terminado» hasta comprobar Cloudflare y, cuando corresponda, el teléfono.

## 18/11/2026 — P00, auditoría inicial
- **Origen:** repo `Abnernoa97/dj-noa-pwa`, `main` `31d47ae5b9d90ebd86709ebc755240318f2b783a`.
- **Inventario:** 117 archivos, 33 CSS, 39 TS/TSX en `src/`, 74 ramas previas, 3 workflows GitHub; ninguna PR abierta.
- **Backup:** `backup-before-djnoa-master-reorganization-20261118` creado y confirmado sobre el SHA de `main` anterior.
- **Patrones inspeccionados:** HAVANA NICE V2, HAVANA CLOUD, HAVANA EVENTS, HAVANA QUOTES (sólo lectura).
- **Cloudflare:** Worker `dj-noa-pwa` bajo cuenta de producción «Soloaplicaciones97», conexión GitHub `main`, comandos `npm run build` / `npx wrangler deploy`, último build anterior `success` (commit `31d47ae`) y deployment 100 %.
- **Hallazgos candidatos:** CSS con múltiples capas, código financiero dividido, dos vistas de Excel, coordinador `App.tsx`; **no** se certificó código muerto ni se borró ninguno.
- **Decisión:** retirar los tres GitHub Actions en una sola actualización de `main`, junto con trasladar comprobaciones al build Cloudflare, documentar un solo tablero y añadir un auditor de solo lectura.
- **Protecciones:** no activar ni editar `dj-noa-cloud/`; sin borrar información, ramas o código vivo.

### Comprobación de cierre P00
- [x] GitHub `main` contiene cero `.github/workflows/*.yml`.
- [x] `npm run build` conserva el typecheck y ejecuta auditoría/tests.
- [x] Cloudflare Workers Builds del commit nuevo: `success` (commit `021b2d20fab49bcf1abd68871211bec4534aa325`; build `4fc04bcb-c034-4bfb-a306-4f3cae7b215b`; versión `fb6481b6-0e5d-46b9-947f-f301b27d7f56` al 100 %, 18/11/2026).
- [ ] La app instalada y los datos existentes siguen intactos (QA física por confirmar, NO inferir del build).
- [x] Tablero P00 = VERIFICADO para infraestructura y publicación Cloudflare; QA física permanece pendiente bajo P11/P12.

## P01 · primer candidato comprobado — 18/11/2026
- Se verificó en código fuente que `SheetWorkspace.tsx`, `ExcelModulesEnhancer.tsx` y `noahExcel.ts` tenían tres copias iguales de `numberValue` y `normalize`; los dos últimos repetían además `behaviorOf`.
- Se preparó un helper puro en `src/domains/sheet/sheetValues.ts` y pruebas de regresión en `tests/dj-noa-sheet-shared.test.mjs` para retirar esas copias sin alterar valores USD, contratos ni el UI. **El cierre de este paso depende del build de Cloudflare del nuevo commit.**
- El build previo avisó de 11 vulnerabilidades de dependencias (1 baja, 4 moderadas y 6 altas) y de un chunk Vite mayor que 500 kB. Son **riesgos a clasificar**, no instrucciones para ejecutar `npm audit fix --force`.

## P01-c · referencia de dependencias y CSS
- Se añadió el analizador no destructivo `scripts/audit-candidates.mjs` a la comprobación de Cloudflare, más `tests/dj-noa-audit-readonly.test.mjs`.
- Contadores y posibles archivos huérfanos se archivarán tras leer los logs del build real; **no se borran fuentes por una sospecha de ausencia de imports**.
- P01 permanece EN CURSO; finanzas, Visión y Excel conservan sus contratos.

## 18/11/2026 · Compuerta P01-b/c y corrección de test
- El build Cloudflare `0539facd-7297-40b8-96e5-35c067f29039` del commit `54dfc3d` falló en las pruebas Node (`ERR_MODULE_NOT_FOUND`): el runtime no resuelve importaciones `.ts` sin extensión en los módulos cargados por tests. **El deploy de esa revisión NO ocurrió; permaneció activa la versión anterior `30e5da29`**.
- Corrección acotada: declarar la extensión `.ts` en las cuatro referencias a `src/shared/normalizeText.ts` y exigirlo en el test. Sin cambio de funciones, montos o almacenamiento. Requiere un nuevo build **SUCCESS** para cerrar.
- El auditor experimental encontró 81 fuentes, 80 alcanzables y un candidato `src/finance.ts`. No borrarlo: revisar exportaciones y consumidores de tests antes de clasificarlo como obsoleto.
- CSS: 33 hojas y 3,008 apariciones de `!important`; dato heurístico para P10, no defectos confirmados.

## 18/11/2026 · P10-a, organización física de CSS por capítulos
- Los **33 archivos CSS** se trasladaron sin editar su contenido a `src/features/{calendar,events,excel,tasks,noah,safety,home,sports}/styles/` (27) y `src/styles/core/` (6).
- El orden original de las 33 importaciones en `src/main.tsx` se conservó. No quedan copias CSS en la raíz de `src/`.
- La primera compilación Cloudflare de commit `8aefe2ed` detuvo el despliegue correctamente: 67/70 tests SUCCESS, pero 3 tests exigían las rutas antiguas de estilos. La app de producción **no** cambió durante ese build fallido.
- Se corrigieron las tres referencias de pruebas, sin cambiar el CSS ni el diseño. Se añadió `tests/dj-noa-css-chapters.test.mjs` para conservar los capítulos y la precedencia. Cerrar P10 solo después del build corregido y QA visual en teléfonos.
- **No se han borrado ramas**: la limpieza de refs queda pendiente de inventariar commits únicos y de un método de eliminación de ramas autorizado en la conexión actual.

## Próximo bloque
**P01:** mapa de importaciones reales, CSS con propietarios, escritor canónico de cada dato y catálogo de candidatos. No borrar por similitud de nombres. Conservar esta bitácora como referencia única para otros chats.

## 18/11/2026 · P04-a · Estructura de Excel por capítulo
- Traslado del editor clásico, cuadrícula dinámica y hook de orientación a `src/features/excel/`. CSS del capítulo ya ubicado en `styles/`.
- No se duplican los archivos de origen. Se reescribieron rutas en App, entrypoint, auditor y pruebas, y se añadió guard para impedir regresiones de estructura.
- Se conservan internamente los módulos de cálculo/persistencia y las opciones actuales; **P04 sigue EN CURSO** hasta consolidar las responsabilidades de ambas tablas y QA móvil.
- Certificación de Cloudflare para esta tanda: pendiente del resultado del build.

## 18/11/2026 · P06-a · Capítulos Eventos, Calendario y Tareas
- Traslado sin copias de 7 archivos: vistas Eventos/Calendario/Tareas, avisos de Tareas, lógica de identidad, mutaciones transaccionales y horarios vinculados a eventos.
- Rutas definitivas: `src/features/{events,calendar,tasks}/` y `src/domains/events/`.
- Actualización de imports de App y Noah, referencias de pruebas, auditor de estructura y guard específico. Sin migración IndexedDB ni cambios funcionales previstos.
- P06 permanece EN CURSO: aún falta auditar sincronización real entre módulos y QA de teléfonos; publicar únicamente tras Cloudflare SUCCESS.

## 18/11/2026 · P07-a · Noah por capítulos
- Componentes de interfaz (voz, análisis de fotos y avisos) ubicados en `src/features/noah/` sin copiar archivos anteriores.
- Reglas de acciones, Excel, conciliación visual y escritura transaccional ubicadas en `src/domains/noah/`.
- Optimización de fotos **manual** ubicada en `src/services/media/`, independiente del guardado de fotos analizadas por Noah.
- Actualizados importadores App, mantenimiento, mutaciones de eventos, pruebas y auditor estructural. Sin cambiar rutas Worker, contratos USD o datos almacenados. Cloudflare build y QA pendientes de aceptación.

## 18/11/2026 · P09-a · Deportes ordenados por capítulo
- Cinco componentes deportivos trasladados a `src/features/sports/`, con sus estilos existentes; `hardRockOdds.ts` separado en `src/domains/sports/`.
- Referencias actualizadas en `App.tsx` y `main.tsx`; los endpoints, el Worker y los cálculos se mantienen iguales.
- Añadida prueba estructural de módulos sin copias; publicación y validación de Cloudflare pendientes.
- P09 en curso hasta revisión de llamadas, caché, y QA de resultados en el teléfono.

## 18/11/2026 · P05-a · Dominio financiero con ruta canónica
- `finance.ts`, `financialOverview.ts` y `moneyIntegrity.ts` agrupados bajo `src/domains/finance/` sin conservar copias anteriores.
- Consumo actualizado en Home/App, Excel, Calendario y Eventos; pruebas previas de USD e históricos mantienen sus mismos casos.
- Sin cambios de fórmula ni de datos. Continúa pendiente revisión de lógica duplicada/ambigüedad, pruebas móviles y cierre de P05.

## 18/11/2026 · P02-a · Seguridad y respaldo por capítulos
- `DataSafetyPanel` y `AppMaintenance` trasladados a `src/features/safety/` y el servicio de copias `dataBackup` a `src/services/storage/`.
- No cambia el archivo de datos, schema Dexie, el origen de la PWA ni el contrato de restauración. Se eliminan las rutas previas y se añaden pruebas de estructura.
- P02 sigue EN CURSO: todavía falta el inventario completo de datos y la prueba física del respaldo en dispositivos.

## 18/11/2026 · P03-a · Coordinador y navegación agrupados
- Traslado de `App.tsx` y `navigationBack.ts` a `src/app/`, sin crear copias ni modificar reglas de negocio.
- `src/main.tsx` sigue siendo el bootstrap PWA; todas las pantallas usan `src/app/navigationBack.ts` como única implementación.
- Ajustados componentes, pruebas y auditor de estructura para las rutas canónicas. Se agregó prueba de capítulo y documentación.
- P03 permanece EN CURSO: extracción semántica de responsabilidades y QA de retroceso nativo quedan pendientes. Cierre del traslado solo tras Cloudflare SUCCESS.

## 18/11/2026 · P02-b · Base local en capítulo único
- `src/db.ts` se traslada a `src/services/storage/db.ts` sin duplicaciones; la implementación es idéntica salvo la ruta del import de tipos.
- Se conserva la identidad Dexie `dj-noa-local`, esquema de versiones 1–6 y sus siete tablas; no se hace migración, borrado de caché ni cambios de valores.
- Los módulos de eventos, Excel, Noah, Tareas y respaldos apuntan al mismo archivo; se incorporó un test de contrato de almacenamiento. Publicación pendiente de Cloudflare SUCCESS y QA local posterior.

## 18/11/2026 · P01-d · Contrato de tipos centralizado
- Todas las interfaces compartidas pasan de `src/types.ts` a `src/shared/types.ts`, sin cambiar una línea del contenido de los tipos; las importaciones de todos los consumidores se redirigen a la única carpeta canónica.
- Se añade guard de capítulo y documentación. `CurrencyCode` mantiene la compatibilidad de históricos MXN; la operación nueva continúa solo USD.
- Sin migraciones de Dexie, sin duplicar interfaces ni tocar el Worker. Cloudflare y QA pendientes de aceptación final.

## 18/11/2026 · P03-b · Extracción real de lógica de presentación Noah
- Se extrajeron `financeText`, `patchEntries`, `progressSteps`, `matrixSteps`, `calendarSeriesSteps` y sus funciones auxiliares al capítulo `src/features/noah/noahActionSteps.ts`.
- `src/app/App.tsx` baja de 785 a 687 líneas sin modificar el comportamiento; ahora importa un único proveedor de pasos, con tests de equivalencia de estados y valores.
- No hay llamadas a bases de datos ni network en el módulo extraído. P03 continúa EN CURSO, requieren más separaciones y pruebas en móvil.

## 18/11/2026 · P03-b certificado y estado de ramas
- Cloudflare build para `23ee05407964dfc41a8839be2034faf5908aa793`: **SUCCESS**, 91/91 tests, despliegue del Worker `dj-noa-pwa` al **100 %** versión `3a10e48a-a1de-4257-8efb-81f20fbaf450`.
- Solo la rama `main` publica. Se comprobaron 75 ramas en GitHub (74 adicionales), aún **sin eliminar**. No hay operación de borrado de rama disponible en el conector actual. Preservar los respaldos y documentar candidatos antes de una poda autorizada.
- Persisten tareas pendientes: App de 687 líneas, Excel con editor y complemento, CSS con capas de override, audit de dependencias, QA real Android/iPhone y ramas históricas.

## 18/11/2026 · P12-a · Auditoría de las 74 ramas históricas
- Corte previo a la poda: `main` = `ecbbd856184b11dc0eb27350a351d31d0c17dd6a`; 75 ramas en total (`main` + 74). No hay ramas marcadas `protected`.
- Comprobadas individualmente con `compare main...<rama>`: **68 ramas con `ahead_by=0`** (`behind`); sus commits se encuentran en el historial de `main` y no requieren ninguna fusión.
- **Tres ramas divergentes sin diferencias netas de archivos**: `ai-tests-hardening`, `before-mlb-css-api-fix`, `before-noah-turn-taking-fix`. Sus dos commits individuales crean/retiran marcadores o archivos temporales; no aportan código pendiente.
- **Dos ramas divergentes fusionadas por PR**: `finance-vision-no-image-storage-20261021` (PR #2, merged 22/10/2026) y `excel-landscape-android-20261022` (PR #3, merged 22/10/2026). Los módulos y tests correspondientes existen en `main`; su diferencia de historial no implica dependencia de la rama.
- **Una rama abandonada explícitamente**: `stage5-noah-vision-integrity-20261017` (PR #1 cerrado sin fusionar y superado por PR #2). Su propuesta de persistir fotos originales de Visión contradice el contrato actual de analizar y guardar solo información estructurada; NO fusionarla.
- Cloudflare Workers Builds tiene `branch_includes=[main]`; la publicación solo depende de `main`, no de las 74 referencias antiguas. No hay workflows de GitHub Actions en `main`.
- **Resultado: 74 ramas candidatas a eliminación, ninguna pendiente de fusionar. La eliminación todavía NO se ha ejecutado**: el conector GitHub disponible permite leer/comparar/actualizar archivos y refs, pero NO proporciona la operación DELETE de una referencia. No simular la eliminación moviendo las ramas al SHA de main.
- Criterio para ejecutar la poda desde una sesión autorizada con GitHub CLI: revalidar nombres, SHA de las seis ramas divergentes y estados de PR; eliminar `heads/<rama>` excepto `main`; volver a listar y confirmar `main` como única rama. Registrar resultado antes de cerrar P12.

## 18/11/2026 · P12-a CERRADO — eliminación definitiva de 74 ramas
- La auditoría P12-a ya estaba concluida: **68 ramas históricas sin commits únicos**, 3 ramas divergentes con diff final vacío, 2 ramas con PR #2/#3 fusionados y 1 rama `stage5-noah-vision-integrity-20261017` explícitamente descartada por PR #1.
- Mecanismo recuperado de HAVANA CLOUD: tarea **temporal** GitHub Actions con `GITHUB_TOKEN`, `permissions: contents: write`, ejecutor Ubuntu estándar de repositorio público y `gh api -X DELETE repos/Abnernoa97/dj-noa-pwa/git/refs/heads/<rama>`. No es mecanismo de publicación; Cloudflare Workers Builds sigue siendo el único deploy.
- Workflow temporal `.github/workflows/dj-noa-prune-once.yml`, creado en `main` con commit `20210c5cf2ff7ef8cd6fc9bf6b0dec57126f839b`. Comparó 74 nombres + SHA exactos, protección de ramas, tres divergencias vacías, PR cerrados/mergeados y `main` intacta antes de ejecutar cualquier borrado.
- **GitHub Actions run `44402947387`, job `135150542078`, conclusion SUCCESS**, logs con 74 líneas `DELETED N/74`, última `DELETED 74/74: visual-polish`. Al terminar, GitHub devolvió exactamente una rama: `main`.
- **Workflow temporal eliminado** inmediatamente: commit `81de301b56a8790b63d36758045f4a0f0cbc6406`. Verificado que ya no existe la carpeta `.github/workflows` en `main`.
- Resultado verificado por segunda lectura de GitHub: **1 rama total, `main`**; no se fusionó código antiguo, no se alteraron Dexie, datos locales ni bindings de Worker. En la referencia histórica de `main` siguen accesibles los commits ancestrales; ya no hay referencias de backup dedicadas.
- **P12-a = VERIFICADO** (poda completada); **P12 general = EN CURSO**, pendiente QA física Android/iPhone, rendimiento, aceptación y control de integridad de aplicación. Prohibido crear nuevas ramas por conveniencia: continuar sobre `main`.

## 18/11/2026 · P01-e · Claves de columnas Excel / Noah unificadas
- Confirmadas **dos implementaciones idénticas** de la clave `grid_<nombre_normalizado>_<6 caracteres UID>` en `ExcelModulesEnhancer` y `noahExcel`. No eran funciones independientes ni se necesitaba mantener ambas.
- Sustituidas por un único helper puro `makeGridColumnKey(name, generatedId)` en `src/domains/sheet/sheetValues.ts`, manteniendo exactamente normalización, fallback `columna`, prefijo `grid_` y primeros seis caracteres del ID que genera cada consumidor.
- Los dos consumidores siguen usando `uid()` en el mismo punto y creando sus propias filas/columnas como antes; no cambia IndexedDB, nombres de columnas guardadas, tipos, fórmulas, moneda USD ni Worker.
- Añadidas pruebas de equivalencia de IDs y un guard contra copias locales en `tests/dj-noa-sheet-shared.test.mjs`. **P01 permanece EN CURSO**; Cloudflare y regresiones del commit deben aprobarse antes de dar este paso por verificado.

## 18/11/2026 · P01-f · Retiro de motor financiero antiguo sin consumidores reales
- El auditor de importaciones reportó **una sola fuente sin acceso desde los entrypoints PWA/Worker**: `src/domains/finance/finance.ts`. Su clasificación `financialTypeForCategory` y resumen `financialSummary` no eran invocados por la app; únicamente tenían consumidores en tests de compatibilidad histórica.
- El motor anterior clasifica importes mediante etiquetas de categoría, una ruta conceptual distinta de la conciliación contractual USD actual. Se elimina ese archivo **de código fuente**, no datos financieros.
- Se reemplaza la prueba del resumen obsoleto por una regresión de `eventUsdSettlement`: contrato USD, anticipo recibido, nota neutra y fila MXN histórica, todos diferenciados sin contar dos veces.
- Se ajustan los tests del normalizador, el guard de arquitectura y el README. Se mantiene **exactamente** la implementación de `financialOverview.ts`, `moneyIntegrity.ts`, Dexie, tablas, Worker, IA y pantallas. Los archivos históricos siguen disponibles en Git y los registros de dinero en IndexedDB son intocables.
- P01-f exige build/QA Cloudflare SUCCESS antes del cierre; P01 general continúa EN CURSO por CSS, Excel y contratos.

## 18/11/2026 · P01-e/f certificados por Cloudflare
- P01-e commit `5b61b4e654ab112469fd27c8afb4cde6aa059a6f`: **93/93 tests, 0 fallos**, Workers Builds `7143a074-c25f-4906-94d1-fd3ff32f3fcf` SUCCESS, Worker desplegado al 100 % versión `ecdde1b1-f233-4b1f-a33f-57809cd45687`.
- P01-f commit `22acf2c2b6b9bcbd408a23ceb66c8146f363f310`: **93/93 tests, 0 fallos**, Workers Builds `ba08a33e-6e59-462c-b606-471e81512935` SUCCESS, Worker desplegado al 100 % versión `4d031b0b-9386-4c90-bda4-d6dcc086990d`.
- Auditor P01-f: **81/81 fuentes accesibles, cero candidatos huérfanos** desde las entradas PWA y Worker. Se retiró una implementación histórica no invocada; el resto requiere auditoría de duplicidad semántica y QA físico, no borrado automatizado.
- No se han creado ramas ni workflows GitHub Actions. Los dos cambios se aplicaron en `main` con commits atómicos y Cloudflare como publicación oficial. P01 general continúa EN CURSO; P02–P11 no se dan por cerrados por tests sintéticos.
