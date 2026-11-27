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

## 18/11/2026 · P01-g · auditoría integral y clasificación de duplicaciones
- Scanner conservador `scripts/audit-semantic.mjs`: recorre `src/`, `worker/src/` y `dj-noa-cloud/src/` **en lectura sola**, AST TypeScript + parser PostCSS. Integrado en `npm run build`; fallo inicial de guard de comandos rígido corregido con 95/95 tests y luego 97/97.
- Conteos certificables del commit `56f7464`, Worker Cloudflare SUCCESS: 85 fuentes (52 JS/TS/TSX y 33 CSS), 1,217 funciones/métodos/callbacks inspeccionados, 31 grupos de cuerpos de función idénticos, 31 pares similares, 49 nombres repetidos y 35 ventanas de siete líneas idénticas reportadas.
- CSS: 183 selectores comunes entre archivos (sin steps keyframe), 177 grupos en igual contexto de media con propiedades compartidas, 624 comparaciones de valores diferentes, 11 cuerpos de reglas CSS idénticos y 3,008 `!important`. Ninguno constituye prueba de que se puedan borrar 183 selectores; consulta `07-ANEXO-CSS-COMPLETO.md`.
- Reorganización física del servidor: `worker/src/sports/` recibió MLB, NBA, Context, Live, Analysis (5 archivos originales MOVED, no duplicados), commit `54e677c`, 96/96 pruebas y deployment Cloudflare SUCCESS; `worker/src/noah/` recibió Chat y Vision (2 originales MOVED), commit `0cc8aea`. Tres tests todavía referían las rutas viejas; corregidos en `aeccd87` sin cambiar lógica, 97/97 pruebas y Cloudflare SUCCESS.
- Se crearon inventarios únicos de funciones `05-CATALOGO-DUPLICACIONES.md`, propietario físico `06-MAPA-PROPIETARIOS.md` y anexo CSS de 183/177 `07-ANEXO-CSS-COMPLETO.md`. Estos forman parte del Plan Maestro único, no son nuevos planes.
- Se conserva la misma `main`, Dexie v1–6, dinero USD/históricos MXN, fotos manuales, Vision sin blobs, CSS y rutas/seguridad Worker. **P01-g inventario certificado; P01 general EN CURSO, consolidación funcional para el siguiente lote.**

## 18/11/2026 · P01/DUP-01a: parsers ESPN MLB y NBA compartidos
- Inspección de los dos módulos confirmó **seis bloques equivalentes** (cinco idénticos byte a byte y uno con diferencias únicamente de espacios) que contienen **12 funciones**: `rec`, `list`, `str`, `num`, `int`, `nextDate`, `statusView`, `marketMoneyLine`, `marketView`, `impliedProbability`, `americanFromProbability`, `marketConsensus`.
- Se mueven a `worker/src/sports/shared/espnCore.ts`, fuente única; `mlb.ts` y `nba.ts` importan el helper sin wrappers/copias paralelas. Se conservan abreviaturas de equipos, normalización de API oficial, `getJson`, `sortGames` y fuentes de datos específicas de cada liga.
- Pruebas nuevas de parsing, fechas bisiestas, valores vacíos, status, odds y consenso en `tests/dj-noa-sports-shared.test.mjs`. **Validar Cloudflare antes de declarar VERIFICADO**. No altera Dexie, fotos, CSS, Worker entry, rutas ni bindings.

## 18/11/2026 · P01/DUP-01b: utilidades comunes Context, Live y Analysis
- Context y Live importan desde `sports/shared/espnCore.ts` los cuatro parsers idénticos `rec/list/str/num`; Live además reutiliza el mismo `statusView`. Analysis utiliza los parsers `rec/str`, manteniendo `list` local por su firma TS distinta.
- `normalize` y `dateOnly`, textualmente equivalentes, se consolidan en `worker/src/sports/shared/contextCore.ts`. La fecha conserva exactamente la validación lexical previa.
- Nueva prueba `tests/dj-noa-sports-context-shared.test.mjs`. No se alteran rutas API, headers HTTP, proveedores, datos locales, ni CSS. Verificar Cloudflare antes del cierre.

## 18/11/2026 · P01/DUP-02a · Nombres y alineaciones MLB unificados
- `playerName` y `lineupFromBoxscoreSide` eran exactamente idénticas en `sportsContext` y `sportsLive` (572 caracteres de código repetidos). Se retiraron ambos originales y se dejaron en el único `sports/shared/contextCore.ts` conservando todas las condiciones de fallback, orden, límite nueve y comportamiento para datos ausentes.
- Regresiones con orden de bateo, ID prefijados, nombres faltantes y rutas estáticas en `tests/dj-noa-sports-lineup-shared.test.mjs`.
- No se fusionó `loadMlbGameContext` todavía: sus matchers de equipo y expectativas pueden diferir; requiere fixture de red/semántica y no una mera coincidencia textual. Confirmar Cloudflare antes de marcar este paso verificado.

## 18/11/2026 · P01/DUP-03a: presentación deportiva unificada
- Extraídas las 8 funciones equivalentes de tarjetas MLB/NBA: `odd`, `impliedProbability`, `favoriteFromOdds`, `favoriteForGame`, `shortTeamName`, `gameClock`, `dateLabel`, `marketLabel` a `src/features/sports/sportsPresentation.ts`.
- Sustituidas definiciones locales por importación común en `MlbWorkspace` y `NbaWorkspace`. Se conservan los tipos de respuesta por liga, claves caché diferentes, peticiones a sus endpoints, navegación, CSS y lógica NBA de temporada anterior.
- Añadida prueba `tests/dj-noa-sports-presentation.test.mjs` con cuotas, votos, empates, fecha/estado y política de cache diferenciado. Requiere test/Cloudflare SUCCESS; no se tocó Dexie, Noah ni finanzas.

## 18/11/2026 · P01/DUP-05a: snapshots de Excel compartidos entre Noah Voz y Visión
- Se verificaron dos bloques con semántica idéntica: `hasCellValue` y `sheetColumnSnapshot`/`columnSnapshot` en `NoahVoice` y `NoahImageIntake`.
- Se eliminaron implementaciones locales y se migraron ambos componentes a `src/domains/noah/noahSheetSnapshot.ts`, manteniendo el límite de 80 columnas, orden, comportamiento neutro por defecto y tratamiento de `null`, cadena vacía, cero y falso.
- Añadidas pruebas puras y de ausencia de duplicados `tests/dj-noa-noah-snapshot.test.mjs`. Sin cambio en almacenamiento de fotos/Visión, transacciones, moneda ni endpoints. Cloudflare/regresiones deben aprobarse antes de marcar verificado.

## 18/11/2026 · P01/DUP-05b: normalización de voz unificada
- La función `normalizeSpeech` del componente Noah Voz era cuerpo idéntico a `src/shared/normalizeText.ts`. Se retiró la definición local y se importa `normalizeText as normalizeSpeech` (sin wrapper ni conversión nueva), conservando su único consumidor de sesión de voz.
- Añadida prueba de import único y normalización con acentos a `tests/dj-noa-normalization-unified.test.mjs`. Sin alterar reconocimiento de voz, permisos, base de datos, navegación ni API.

## 18/11/2026 · P01-h · Primera consolidación funcional certificada
- Seis entregas protegidas en `main`: `7480b1e` (ESPN core), `9e2c573` (Context/Live/Analysis), `9087af4` (alineaciones; corrige resolución ESM del commit previo `d3d2ad5`), `b350a96` (visual MLB/NBA), `4a35b06` (Noah snapshots) y `bfff20b` (normalización de voz).
- Cada entrega tuvo regresión y publicación Cloudflare SUCCESS; la última finalizó con **114/114 pruebas, cero fallos**, build `c5ff02e1-1dc6-4282-a443-3f23ee3364b7`, Worker deployment al 100 % versión `8116cb4c-ca03-4ad5-a386-d02083aae25b`.
- Auditor semántico mismo método antes/después: exact duplicates 31→**15**, similitud 31→**24**, nombres repetidos 49→**31**, funciones/métodos/callbacks 1,217→**1,175**; CSS mantiene 183 selectores repetidos y 3,008 `!important`, intactos deliberadamente.
- No se alteraron bases Dexie, rutas HTTP, bindings, imágenes de Visión, ni datos/movimientos USD. La publicación automátizada usa solo Cloudflare; no se abrieron ramas ni GitHub Actions.
- **Resultado**: seis grupos funcionales con propietarios canónicos, más pruebas y menor duplicidad. **Pendiente**: 15 grupos exactos, 24 parejas similares, escrituras Excel, recurrencia, parsing IA, CSS y QA real de teléfonos; P01 general EN CURSO.

## 18/11/2026 · P01-i / DUP-06a · único borrado transaccional de filas Excel
- Tres rutas existentes (`noahExcel`, `ExcelModulesEnhancer`, `SheetWorkspace`) eliminaban filas de Excel y sus fotos mediante sus propias transacciones Dexie. Se centralizaron en `src/services/storage/sheetMutations.ts`.
- El método individual usa `Table.delete` y el masivo usa `bulkDelete`, conservando los métodos anteriores y el orden fotos→filas en **una transacción**; siguen vigentes `window.confirm` en UI, la validación de existencia de Noah, avisos `djnoa` y callbacks visuales.
- `tests/dj-noa-sheet-mutations.test.mjs`: valida 1 fila, selección múltiple, persistencia de fotografías ajenas y rollback total de fila + foto por transacción externa fallida. No altera tablas Dexie, datos financieros, fotos de Visión ni semántica de borrado de columnas.
- **Diferencias que impiden consolidación automática de columnas:** Noah recalcula valores financieros y también puede afectar filas MXN; ExcelModulesEnhancer solo quita la clave; SheetWorkspace no usa transacción. No fusionar hasta definir explícitamente la política de históricos USD/MXN y pruebas de equivalencia. Estado P01 en curso hasta Cloudflare SUCCESS.

### P01-i · corrección del harness de pruebas
- La primera ejecución de Cloudflare del commit `79ba003` se detuvo con `ERR_MODULE_NOT_FOUND: fake-indexeddb` (librería no instalada en build); **no se desplegó ese commit fallido**.
- Se reemplazó el test por inyección de un store simulado en `createSheetRowDeletion(db)`; se prueban orden, selección, preservación de fotos ajenas y rollback de la transacción **sin agregar dependencias ni abrir IndexedDB real**. El factory usa la instancia Dexie original para producción. Este test verifica orquestación y rollback simulado; no reemplaza QA de IndexedDB real en dispositivo.

## 18/11/2026 · P01-j / DUP-06b · Cálculo de neto financiero Excel/Noah unificado
- `noahExcel.ts` y `ExcelModulesEnhancer.tsx` calculaban independientemente ingresos − gastos − inversiones, monto absoluto y signo financiero. Extraje la función pura de Noah, sin alterar una condición, como `sheetFinancialPatch` en `src/domains/sheet/sheetFinancial.ts` y ambos consumidores la usan.
- **Importante:** la grilla conserva el guard `row.currency !== 'USD'` y continúa sin recalcular si se modifica una columna neutra; Noah conserva sus casos de recálculo y mensajes. La unificación no autoriza cambiar importes históricos ni atribuir equivalencia a los borrados de columna.
- Pruebas de netos positivos/negativos/neutros, neutralidad, entradas numéricas y ausencia de escrituras en `tests/dj-noa-sheet-financial.test.mjs`. Cloudflare pendiente; P01/P04 sigue EN CURSO.

## 18/11/2026 · P01-i/j CERTIFICADO
- Commit 79ba003: primer intento de prueba con fake-indexeddb no instalado, Cloudflare lo rechazó y no publicó.
- Commit 6d5f15a: service de borrado + prueba de store simulado, 118/118 tests y Cloudflare SUCCESS, 100 % publicado.
- Commit aff2ebd: función financiera única, 121/121 tests y Cloudflare SUCCESS, Worker versión 8b260413-8aa6-4ed4-afb2-5620068c37f3 desplegada al 100 %, build 9a79c0e0-c462-40e4-a3e8-e1d278ed1b34.
- Auditor semántico 14 grupos exactos y 24 pares similares. P01/P04/P05 EN CURSO: diferencias de borrado de columnas e integridad USD/MXN todavía no resueltas; QA física pendiente.

## 18/11/2026 · P01-k · cierre del inventario y consolidación funcional
- La última compilación **Cloudflare SUCCESS** de funcionalidad fue `3ea1565b7a2505fd22706ba81b1486aabf04e909`, build `972a9a06-79bc-4a07-9d69-1534fae032a1`, **153/153 pruebas, 0 fallos**, Worker `cf9dca24-6a72-4e20-a486-6c640b158c33` publicado al 100 %.
- **P01 auditoría VERIFICADA:** funciones idénticas sintácticas 31→1 (callback de formulario no intercambiable); parejas similares 31→8 (clasificadas una por una en `08-REGISTRO-EXCEPCIONES.md`); source candidates 96/96 alcanzables, cero archivos huérfanos probados. Una rama `main`, cero GitHub Actions.
- **Operaciones unificadas desde el último corte:** recurrencia de recordatorios cliente, `SportsGameDetail` presentación, refresh y filas de cuotas MLB/NBA; respuesta HTTP JSON de 8 handlers, parsing ESPN del evento y equipo, resumen W/L, lineup+probables MLB en contexto/en vivo, consenso y conversión de cuotas, cambio de fecha UTC; Noah lectura de respuesta IA, JSON y normalización/acento con dólares preservados en chat; lectores Blob/DataURL, previsualización Blob y Set de selección en Eventos/Excel.
- **CSS P10:** declaración completa 3,008→2,978 `!important`; selectores en varios archivos 183→182; 36 declaraciones redundantes exactas retiradas en cinco hojas y `audit-css-prunable.mjs` verifica cero candidatos con el mismo criterio (no confundir con cero deuda visual). 33 hojas, 11 bloques CSS idénticos y 600 pares de valores distintos pendientes de diagnóstico/QA de cascada.
- **Fallos de compilación intermedios resueltos antes de publicar:** (a) test antiguo buscaba la regla scroll en `excel-scroll-fix.css` tras dejarla en su propietario posterior `sheet-focus.css`; (b) import `num` faltante en nuevo helper MLB; (c) prueba antigua esperaba parser de lineup en módulos consumidores, ahora en su único dueño `contextCore`; (d) script PostCSS con shebang desplazado corregido. No se publicaron esos commits fallidos.
- **No se ha efectuado QA visual física** en iPhone/Android. Los cambios CSS se verificaron por tests y Cloudflare, no por comparación de pantallas. P03 App, P04 columnas Excel, P10 cascada completa, P11 QA y P12 aceptación siguen abiertos. No se tocó `dj-noa-cloud/` ni la base IndexedDB.

## 19/11/2026 · P03/P04/P10/P11 · segunda tanda VERIFICADA (trabajo parcial, proyecto no terminado)
- **Compilación de producción:** último commit de código `7c796f7c0d2e28c0a9e2ef278d7b19f2aac54c40`; Cloudflare build `42b702da-e4ec-4681-9546-93fc536b9ede`, **SUCCESS**, **167/167 pruebas**, cero errores; Worker `dj-noa-pwa` versión `b7e2fc9e-6262-49d5-9408-da8090659af6`, reparto de tráfico 100 %.
- **App P03:** 682→281 líneas; 410+ líneas del ejecutor transaccional/noah trasladadas a `src/app/controllers/noahActionCoordinator.ts` sin nueva instancia Dexie, ni estado ni motor de navegación. Se añadió import asíncrono del ejecutor sólo cuando Noah ejecuta una acción. Fallos transitorios de compilación por import de locale `es` y tests que asumían App monolítico corregidos antes de publicar.
- **Excel P04:** `src/services/storage/sheetColumnMutations.ts` único propietario de borrado transaccional de columnas para `SheetWorkspace`, `ExcelModulesEnhancer` y `noahExcel`; la actualización de una columna financiera recalcula únicamente filas USD con esa celda. `createGridSheetColumn` es único para Excel financiero y Noah, con comprobación de nombre dentro de una transacción. Tests con store simulado validan eliminación/rollbacks, clasificación financiera, creación y deduplicación; QA de IndexedDB real sigue pendiente.
- **Carga P11:** imports dinámicos para Calendario, Eventos (lista/detalle/editor), Excel, Recordatorios y MLB; componentes portales no removidos y Worker/DB intactos. Bundles JS: index **569.58→482.08 kB**, index gzip **172.60→149.95 kB**. XLSX **500.06 kB** queda como chunk dedicado, sin quitar Excel. Chunks JS precacheados por VitePWA según configuración existente.
- **CSS P10:** se anotaron cuatro tramos de precedencia manteniendo orden byte-equivalente de imports; `STYLE-CASCADE.md` indexa las 33 hojas y prueba nueva impide duplicar imports o mover las dos últimas capas. **Ninguna declaración CSS se editó en esta tanda**; siguen 2,978 `!important` y 182 selectores compartidos, P10 EN CURSO. No hay QA visual en Android/iPhone.
- **Sin GitHub Actions**, una rama `main`, sin cambiar `dj-noa-cloud`, la estructura Dexie 1–6 ni las fotografías almacenadas. Los commits intermedios rechazados por Cloudflare no se desplegaron; su corrección quedó integrada antes de la publicación verificada.

## 27/11/2026 · P03/P04/P11: columnas, fórmulas, navegación y carga NBA

- Reanudada la limpieza sobre el único `main` anterior `a09e9d3`; se verificaron una sola rama, 214 archivos iniciales, cero workflows GitHub y build base Cloudflare SUCCESS. No había modificaciones externas adicionales que mezclar.
- **P04 · Escritura de columnas:** la grilla actualizaba `behavior` sin recalcular importes mientras Noah realizaba otro recálculo no transaccional de todas las filas USD. Ahora ambas rutas llaman `updateSheetColumn` en `src/services/storage/sheetColumnMutations.ts`: nombre único normalizado, actualización transaccional y solo filas con la celda modificada, exclusivamente USD. No reescribir MXN, filas manuales sin esa celda ni registros heredados. Pruebas de preservación y rollback.
- **P04 · Fórmulas:** `src/domains/sheet/sheetFormula.ts` concentra el parser y resolvedor; las expresiones incompletas ya no se interpretan como cero por `Number('')`. Se preservan precedencia, fórmulas antiguas y división explícita entre cero. `SheetWorkspace` de 524 a 462 líneas.
- **P03/P11 · Inicio:** `HomeView` usa `navigateTo` (historial canónico) en lugar de saltarse `viewRef` con `setView`; NBA pasa de import estático a `lazy()`/Suspense sin modificar su pantalla ni su gesto de regreso.
- **Rendimiento de compilación:** index JS `482.08 → 473.65 kB`, gzip `149.95 → 147.65 kB`, NBA `8.06 kB` como chunk, XLSX sigue `500.06 kB` separado. El tamaño generado no mide arranque real en teléfono.
- **Pruebas:** `npm run test:ai` impone `--test-concurrency=4` en Node y mantiene todos los casos. Se localizaron errores de tests por un parser más estricto y una prueba histórica que aún buscaba guardas USD dentro de Noah tras migrarse a su propietario. Pruebas corregidas para verificar contratos en el nuevo módulo, con cobertura negativa; no se saltaron pruebas ni se publicaron compilaciones fallidas.
- **Publicación final de esta tanda:** commit `59f6472f9518cd03fd7413f9d98bfefbb51c07d8`, build Cloudflare `caa923f8-ea2f-44d2-aa51-d59da886994c` SUCCESS, **178/178 pruebas**, 0 fallos, Worker `dj-noa-pwa` versión `410a1767-5c8e-4fa2-bffc-2404b3bd4998` al 100 %. Una sola `main`, cero GitHub Actions. Sin editar DB/migraciones, estilos, Worker, ni la nube aislada.
- **Abierto:** P02 respaldo/offline, P04 modo clásico/export-import XLSX, P10 cascada visual, P11 QA Android/iPhone, P12 aceptación. No se declara completada la app solo por build SUCCESS.

## 27/11/2026 · P06 · sustitución de calendario basada en HAVANA CALENDARIO

- Se consultó de solo lectura el repositorio fuente `Abnernoa97/havana-nice-events` (V31) para estudiar 4 vistas, estados, listas por año, agenda por día, formularios y colores. No hubo transferencia de datos, D1, R2, fotografías, IA, sincronización ni despliegue fuente.
- El antiguo `CalendarWorkspace` (204 líneas) fue reemplazado por una coordinación de 4 vistas + papelera; componentes en `src/features/calendar/HavanaMonthView.tsx`, `HavanaListView.tsx`, `HavanaSummaryView.tsx` y `havanaCalendarModel.ts`. Se sustituyeron los CSS del capítulo, sin un segundo calendario ni otro motor global.
- Se enlazaron las acciones a `App.tsx` y a los propietarios existentes (`eventMutations`, `eventTrash`, Noah y resumen USD): estados, nuevos eventos/cotizaciones, búsqueda, archivo/recuperación, miniaturas desde `db.eventPhotos` y agenda de recordatorios/Excel.
- Nuevos metadatos opcionales `weddingPlanner`, `city`, `quote`, `trashedAt` sin migraciones, nuevos stores ni datos ajenos; `EventEditor` y `EventHub` ahora muestran estos campos. Los importes los calcula solamente Excel.
- Agregadas pruebas de filtros, papeleras atómicas, preservación y ausencia de `HN_SYNC`, `ANALYTIC_AI`, historial o endpoints de Havana en el nuevo calendario. QA visual de teléfonos/offline permanece abierta.
