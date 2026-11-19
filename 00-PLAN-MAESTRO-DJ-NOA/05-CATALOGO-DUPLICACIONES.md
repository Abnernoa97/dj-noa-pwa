# 05 · DJ NOA — CATÁLOGO MAESTRO DE DUPLICACIONES (P01)

**Corte auditado:** 18/11/2026. Fuente: `scripts/audit-semantic.mjs` ejecutado en Cloudflare Workers Builds del commit `56f7464b08b52154ec12d52325b3a41d4c78fd6c` (**97/97 pruebas SUCCESS**). Auditoría de lectura sola, con analizador TypeScript y parser CSS PostCSS. El orden de los archivos puede cambiar tras traslados sin cambiar sus funciones.

## Seguimiento tras la primera consolidación — 18/11/2026

Este archivo conserva **el inventario inicial** de 31 grupos exactos y 31 parejas similares, con sus rutas/posiciones originales. El corte posterior del mismo auditor, tras las consolidaciones, arroja **15 grupos exactos y 24 parejas similares** en vez de 31/31. Ya se corrigieron completamente los clones seleccionados en **DUP-01a, DUP-01b, DUP-02a, DUP-03a, DUP-05a y DUP-05b** sin reemplazar protocolos de negocio.

Los seis commits de consolidación son `7480b1e`, `9e2c573`, `9087af4`, `b350a96`, `4a35b06` y `bfff20b`. El siguiente ciclo debe empezar por regenerar el inventario con `npm run audit:semantics`, revisar los 15 grupos **actuales** y fijar contratos de datos antes de tocar Excel/recurrencia/Noah IA/CSS. No borrar el catálogo inicial: permite contrastar el avance, no se debe confundir con el estado actual.

## Seguimiento P01-i/j · Excel y Noah (18/11/2026)

- DUP-06a consolidado: las tres superficies de Excel/Noah borran filas y fotografías en una transacción canónica, con la semántica previa para una fila y selección múltiple.
- DUP-06b consolidado: cálculo puro de neto financiero compartido entre Noah y la grilla.
- El auditor registra **14 grupos exactos y 24 parejas similares**, frente a 31/31 inicialmente. El CSS no ha cambiado.
- La eliminación de columnas requiere un protocolo específico: Noah recalcula todas las filas en esa acción y puede alterar históricos MXN, mientras las demás interfaces no hacen lo mismo. No fusionar automáticamente.

## Corte FINAL de auditoría P01 y clasificación — 18/11/2026

- Resultado del auditor en Cloudflare SUCCESS `3ea1565`: **1 grupo de función exacta detectado y 8 pares similares**, contra 31/31 históricos. El último grupo exacto pertenece a **callbacks de formularios diferentes**, NO es un bloque de negocio que se pueda fusionar directamente.
- Los ocho pares similares están individualmente clasificados, con responsabilidad y razón para conservarlos, en `08-REGISTRO-EXCEPCIONES.md`. No confundir similitud sintáctica con duplicación funcional.
- CSS: **182 selectores transversales** y **2,978 `!important`**; el barrido PostCSS retiró **36 declaraciones anteriores** idénticas (mismo selector, media, propiedad, valor y prioridad), redujo 3,008→2,978 `!important` y reporta ahora **0 eliminaciones seguras del mismo tipo**. Las 11 reglas completas idénticas y 600 diferencias siguen en P10 hasta QA visual.
- **P01 VERIFICADO** para su alcance de inventario, clasificación y eliminación de clones equivalentes con tests. P03/P04/P05/P07/P08/P09/P10/P11/P12 mantienen sus criterios específicos y no heredan cierre automático.
- Código canónico ya consolidado: `src/domains/reminders/reminderRecurrence.ts`, `src/services/media/{photoPreviews,blobDataUrl}.ts`, `src/shared/collectionOps.ts`, `src/domains/sheet/sheetFinancial.ts`, `src/services/storage/sheetMutations.ts`, `src/features/sports/{SportsBookRows,useSportsAutoRefresh}`, `worker/src/shared/http.ts`, `worker/src/noah/{aiResponse,aiNormalization}.ts`, `worker/src/sports/shared/{espnCore,contextCore}.ts`.

## Alcance exacto, no estimaciones

| Evidencia | Resultado |
|---|---:|
| Archivos TS/TSX/JS/CSS analizados en PWA, Worker y código de nube aislada | **85** |
| Archivos de código (sin CSS) | **52** |
| Archivos CSS | **33** |
| Funciones, métodos y callbacks inspeccionados | **1217** |
| Grupos con cuerpo idéntico entre archivos | **31** |
| Pares con cuerpo muy similar (heurística) | **31** |
| Nombres de funciones presentes en varios archivos | **49** |
| Coincidencias de siete líneas consecutivas (muestra limitada) | **35** |
| Selectores CSS encontrados en varios archivos, excluyendo keyframes | **183** |
| Grupos CSS con propiedades superpuestas en el mismo contexto de media query | **177** |
| Comparaciones de propiedades con valor diferente, no necesariamente errores | **624** |
| Cuerpos de reglas CSS iguales entre archivos | **11** |
| Declaraciones CSS con `!important` | **3008** |

**Interpretación:** un nombre repetido, un CSS que sobrescribe otro, o dos callbacks iguales no autorizan borrado. Los recuentos de propiedades CSS incluyen comparaciones de pares: no equivalen a errores únicos. Se inspeccionaron fuentes ejecutables; pruebas y herramientas se revisan por sus contratos, pero sus repeticiones no se confunden con duplicaciones del producto. El auditor no garantiza detectar equivalencias de comportamiento distintas a nivel sintáctico.

## Priorización por propiedad de la lógica

| ID | Candidatos y ubicación | Propietario único propuesto | Riesgo / condición de unificación |
|---|---|---|---|
| DUP-01 | Worker MLB/NBA: `rec/list/str/num`, estado, cuotas, consenso, fechas, ordenación y parsing | `worker/src/sports/shared/` | Preservar los formatos de cada API y respuestas MLB/NBA; pruebas de casos reales y fallbacks |
| DUP-02 | `sportsContext` y `sportsLive`: `loadMlbGameContext` (91% similar), `lineupFromBoxscoreSide`, `aggregate`, `dateOnly` | Servicio de contexto MLB único en `worker/src/sports/` | Diferenciar caché y datos históricos vs directos; no duplicar llamadas |
| DUP-03 | MLB/NBA interfaz: probabilidades, favoritos, reloj, etiqueta de mercado y modelos Game/Standing/BookOdds | `src/domains/sports/` para reglas y tipos; `src/features/sports/` solo UI | No alterar las cuotas ni los identificadores de caché; juegos en curso vs próximos |
| DUP-04 | Worker Noah chat/imagen: lectura y parseo de salida IA, normalización y JSON | `worker/src/noah/shared/` | Respetar límites de tamaño, procedencia de evidencia, sanitizer y autenticación |
| DUP-05 | Noah voz/imagen: `columnSnapshot`, `hasCellValue`, normalizador de texto, snapshots de Excel | `src/domains/noah/` y `src/domains/sheet/` | Fotografía de Visión temporal; guardado solo de datos estructurados; evitar reinsertar duplicados |
| DUP-06 | Excel clásico + complemento + comandos Noah: `addRow`, `deleteColumn`, actualización de celdas y recálculo | Servicio único de operaciones `src/services/storage/` y reglas puras `src/domains/sheet/` | Alto: preservar Dexie v6, USD, MXN histórico, anticipo/fee, fórmulas e IDs; UI distinta puede mantenerse |
| DUP-07 | `App.nextReminderDate`, `ReminderWorkspace.nextOccurrence`, `worker/index.nextRepeatedDueAt` | Contrato único de recurrencia documentado en `src/domains/events/` y adaptador Worker | Alto: zona horaria, cambio de mes, DST y sincronización push |
| DUP-08 | `NoahImageIntake.blobToDataUrl` y `dataBackup.blobToDataUrl`, funciones de borrar foto en Eventos y Excel | `src/services/media/` para conversión y `src/services/storage/` para escrituras | No mezclar imágenes de análisis IA con copias originales/manuales y restauración |
| DUP-09 | CSS: `styles/core`, enfoques de pantalla, scroll y overlays, 183 selectores repetidos | Componente dueño por carpeta; solo tokens/patrones realmente generales en `src/styles/core/` | Muy alto: orden, media queries, iOS, Android, landscape, overlays y scroll; exige QA visual |
| DUP-10 | `App.tsx` coordina navegación, Noah, calendario y estado de datos | `src/app/` solo coordinación; servicios por dominio | No duplicar hooks/estado ni romper historial de regreso |
| DUP-11 | Worker `entry.ts` y `index.ts` tienen `fetch` y rutas distintos | `entry.ts` API exterior; `index.ts` push/recordatorios/assets | **No tratar como duplicación a eliminar**: separación intencional de seguridad |
| DUP-12 | Writers IndexedDB repartidos entre Excel, Noah, Eventos y Tareas | Tablas/escrituras por un propietario canónico, preservando transacciones | El número de escrituras no prueba duplicidad; centralizar sin borrar datos |
| DUP-13 | `dj-noa-cloud/` aislada y sin publicar | Mantener aislada hasta autorización específica | **No fusionar** con Worker actual ni modificar credenciales/bindings |

## Restricciones que ninguna poda puede infringir

- Una sola `main`; GitHub Actions fuera del flujo de publicación. Solo Cloudflare Workers Builds.
- Base IndexedDB `dj-noa-local` y esquema Dexie 1–6 intactos; no convertir ni limpiar históricos automáticamente.
- USD operativo; MXN anterior archivado y fuera del balance USD. No sumar fee y anticipo como dos contratos.
- Ninguna foto original analizada por Noah Visión se guarda automáticamente. Fotografías manuales y respaldos se conservan.
- Sin cambio de rutas ni seguridad de `/api/noah-chat`, `/api/noah-image`, deportes, push o recordatorios.
- Sin cambio del CSS aprobado hasta contar con QA Android/iPhone y comparaciones del orden de la cascada.

## Anexo A — TODOS los grupos de cuerpos de función exactos detectados (31)

1. **210 tokens idénticos** — worker/src/sports/mlb.ts:145 `(callback)` ; worker/src/sports/nba.ts:267 `(callback)`
2. **172 tokens idénticos** — worker/src/sports/mlb.ts:96 `marketView` ; worker/src/sports/nba.ts:126 `marketView`
3. **117 tokens idénticos** — worker/src/sports/mlb.ts:123 `marketConsensus` ; worker/src/sports/nba.ts:158 `marketConsensus`
4. **115 tokens idénticos** — worker/src/sports/mlb.ts:72 `statusView` ; worker/src/sports/nba.ts:81 `statusView` ; worker/src/sports/sportsLive.ts:79 `statusView`
5. **94 tokens idénticos** — src/features/sports/MlbWorkspace.tsx:87 `favoriteForGame` ; src/features/sports/NbaWorkspace.tsx:57 `favoriteForGame`
6. **82 tokens idénticos** — src/features/sports/MlbWorkspace.tsx:106 `gameClock` ; src/features/sports/NbaWorkspace.tsx:66 `gameClock`
7. **79 tokens idénticos** — worker/src/sports/mlb.ts:82 `teamView` ; worker/src/sports/nba.ts:99 `teamView`
8. **70 tokens idénticos** — worker/src/sports/mlb.ts:59 `nextDate` ; worker/src/sports/nba.ts:46 `nextDate`
9. **67 tokens idénticos** — worker/src/sports/sportsContext.ts:207 `lineupFromBoxscoreSide` ; worker/src/sports/sportsLive.ts:368 `lineupFromBoxscoreSide`
10. **63 tokens idénticos** — worker/src/sports/mlb.ts:136 `(callback)` ; worker/src/sports/nba.ts:314 `(callback)`
11. **61 tokens idénticos** — src/features/noah/NoahImageIntake.tsx:52 `columnSnapshot` ; src/features/noah/NoahVoice.tsx:49 `sheetColumnSnapshot`
12. **59 tokens idénticos** — worker/src/sports/mlb.ts:115 `americanFromProbability` ; worker/src/sports/nba.ts:145 `americanFromProbability`
13. **56 tokens idénticos** — worker/src/sports/sportsContext.ts:104 `aggregate` ; worker/src/sports/sportsLive.ts:309 `aggregate`
14. **55 tokens idénticos** — src/app/App.tsx:43 `nextReminderDate` ; src/features/tasks/ReminderWorkspace.tsx:31 `nextOccurrence`
15. **52 tokens idénticos** — src/features/noah/NoahVoice.tsx:41 `normalizeSpeech` ; src/shared/normalizeText.ts:3 `normalizeText`
16. **51 tokens idénticos** — src/features/sports/MlbWorkspace.tsx:75 `impliedProbability` ; src/features/sports/NbaWorkspace.tsx:51 `impliedProbability` ; src/features/sports/SportsGameDetail.tsx:77 `implied`
17. **49 tokens idénticos** — worker/src/sports/mlb.ts:88 `marketMoneyLine` ; worker/src/sports/nba.ts:118 `marketMoneyLine`
18. **48 tokens idénticos** — src/features/events/EventWorkspace.tsx:288 `(callback)` ; src/features/excel/SheetWorkspace.tsx:175 `(callback)` ; src/features/excel/SheetWorkspace.tsx:334 `(callback)`
19. **43 tokens idénticos** — src/features/sports/MlbWorkspace.tsx:70 `odd` ; src/features/sports/SportsGameDetail.tsx:72 `odd`
20. **42 tokens idénticos** — src/features/sports/MlbWorkspace.tsx:121 `marketLabel` ; src/features/sports/NbaWorkspace.tsx:77 `marketLabel`
21. **42 tokens idénticos** — src/features/sports/MlbWorkspace.tsx:160 `(callback)` ; src/features/sports/NbaWorkspace.tsx:167 `(callback)`
22. **41 tokens idénticos** — src/features/noah/NoahImageIntake.tsx:53 `(callback)` ; src/features/noah/NoahVoice.tsx:50 `(callback)`
23. **40 tokens idénticos** — src/features/sports/MlbWorkspace.tsx:101 `shortTeamName` ; src/features/sports/NbaWorkspace.tsx:65 `shortTeamName` ; src/features/sports/SportsGameDetail.tsx:90 `shortTeam`
24. **40 tokens idénticos** — worker/src/sports/sportsContext.ts:31 `dateOnly` ; worker/src/sports/sportsLive.ts:45 `dateOnly`
25. **38 tokens idénticos** — src/features/events/EventWorkspace.tsx:73 `(callback)` ; src/features/events/EventWorkspace.tsx:82 `(callback)` ; src/features/excel/SheetWorkspace.tsx:255 `(callback)`
26. **38 tokens idénticos** — worker/src/sports/mlb.ts:52 `num` ; worker/src/sports/nba.ts:39 `num` ; worker/src/sports/sportsContext.ts:25 `num` ; worker/src/sports/sportsLive.ts:40 `num`
27. **35 tokens idénticos** — src/domains/noah/noahExcel.ts:207 `(callback)` ; src/features/excel/ExcelModulesEnhancer.tsx:182 `(callback)`
28. **34 tokens idénticos** — src/features/sports/MlbWorkspace.tsx:306 `(callback)` ; src/features/sports/NbaWorkspace.tsx:265 `(callback)`
29. **32 tokens idénticos** — src/features/excel/SheetWorkspace.tsx:512 `(callback)` ; src/features/tasks/ReminderWorkspace.tsx:244 `(callback)`
30. **32 tokens idénticos** — worker/src/sports/sportsContext.ts:202 `playerName` ; worker/src/sports/sportsLive.ts:363 `playerName`
31. **30 tokens idénticos** — worker/src/noah/noahChat.ts:16 `json` ; worker/src/noah/noahImage.ts:20 `json` ; worker/src/sports/mlb.ts:294 `json` ; worker/src/sports/nba.ts:436 `json` ; worker/src/sports/sportsAnalysis.ts:12 `json` ; worker/src/sports/sportsContext.ts:295 `json` ; worker/src/sports/sportsLive.ts:59 `json`

## Anexo B — TODOS los pares de función similares detectados (31)

1. **91% similitud de fragmentos** — worker/src/sports/sportsContext.ts:220 `loadMlbGameContext` ⇄ worker/src/sports/sportsLive.ts:381 `loadMlbGameContext`
2. **88% similitud de fragmentos** — worker/src/sports/mlb.ts:135 `sortGames` ⇄ worker/src/sports/nba.ts:313 `sortGames`
3. **86% similitud de fragmentos** — worker/src/sports/mlb.ts:59 `nextDate` ⇄ worker/src/sports/sportsLive.ts:63 `shiftDate`
4. **86% similitud de fragmentos** — worker/src/sports/nba.ts:46 `nextDate` ⇄ worker/src/sports/sportsLive.ts:63 `shiftDate`
5. **85% similitud de fragmentos** — worker/src/noah/noahChat.ts:26 `readText` ⇄ worker/src/noah/noahImage.ts:30 `readText`
6. **84% similitud de fragmentos** — worker/src/sports/nba.ts:440 `handleNbaRequest` ⇄ worker/src/sports/mlb.ts:298 `handleMlbRequest`
7. **82% similitud de fragmentos** — src/features/noah/NoahVoice.tsx:41 `normalizeSpeech` ⇄ worker/src/noah/noahChat.ts:51 `normalize`
8. **82% similitud de fragmentos** — src/shared/normalizeText.ts:3 `normalizeText` ⇄ worker/src/noah/noahChat.ts:51 `normalize`
9. **82% similitud de fragmentos** — worker/src/sports/nba.ts:267 `(callback)` ⇄ worker/src/sports/mlb.ts:143 `parseEspnGames`
10. **80% similitud de fragmentos** — src/features/noah/NoahVoice.tsx:41 `normalizeSpeech` ⇄ worker/src/noah/noahImage.ts:70 `normalize`
11. **80% similitud de fragmentos** — src/shared/normalizeText.ts:3 `normalizeText` ⇄ worker/src/noah/noahImage.ts:70 `normalize`
12. **80% similitud de fragmentos** — worker/src/sports/nba.ts:44 `abbr` ⇄ worker/src/sports/mlb.ts:57 `abbr`
13. **78% similitud de fragmentos** — worker/src/sports/nba.ts:314 `(callback)` ⇄ worker/src/sports/mlb.ts:135 `sortGames`
14. **78% similitud de fragmentos** — src/features/sports/MlbWorkspace.tsx:273 `(callback)` ⇄ src/features/sports/NbaWorkspace.tsx:237 `(callback)`
15. **75% similitud de fragmentos** — worker/src/sports/mlb.ts:136 `(callback)` ⇄ worker/src/sports/nba.ts:313 `sortGames`
16. **74% similitud de fragmentos** — src/features/noah/NoahImageIntake.tsx:89 `blobToDataUrl` ⇄ src/services/storage/dataBackup.ts:22 `blobToDataUrl`
17. **74% similitud de fragmentos** — src/features/excel/SheetWorkspace.tsx:527 `(callback)` ⇄ src/features/events/EventWorkspace.tsx:375 `(callback)`
18. **72% similitud de fragmentos** — src/features/noah/NoahVoice.tsx:41 `normalizeSpeech` ⇄ src/domains/events/eventIntegrity.ts:7 `normalizedEventIdentity`
19. **72% similitud de fragmentos** — src/shared/normalizeText.ts:3 `normalizeText` ⇄ src/domains/events/eventIntegrity.ts:7 `normalizedEventIdentity`
20. **66% similitud de fragmentos** — src/features/noah/NoahImageIntake.tsx:90 `(callback)` ⇄ src/services/storage/dataBackup.ts:23 `(callback)`
21. **66% similitud de fragmentos** — worker/src/noah/noahChat.ts:51 `normalize` ⇄ worker/src/noah/noahImage.ts:70 `normalize`
22. **66% similitud de fragmentos** — worker/src/noah/noahImage.ts:70 `normalize` ⇄ src/domains/events/eventIntegrity.ts:7 `normalizedEventIdentity`
23. **66% similitud de fragmentos** — src/features/noah/NoahImageIntake.tsx:249 `(callback)` ⇄ src/features/noah/NoahVoice.tsx:340 `(callback)`
24. **65% similitud de fragmentos** — worker/src/sports/mlb.ts:123 `marketConsensus` ⇄ worker/src/sports/sportsLive.ts:208 `consensus`
25. **65% similitud de fragmentos** — worker/src/sports/nba.ts:158 `marketConsensus` ⇄ worker/src/sports/sportsLive.ts:208 `consensus`
26. **61% similitud de fragmentos** — worker/src/sports/sportsLive.ts:203 `americanFromProbability` ⇄ worker/src/sports/mlb.ts:115 `americanFromProbability`
27. **61% similitud de fragmentos** — worker/src/sports/sportsLive.ts:203 `americanFromProbability` ⇄ worker/src/sports/nba.ts:145 `americanFromProbability`
28. **60% similitud de fragmentos** — worker/src/noah/noahChat.ts:51 `normalize` ⇄ src/domains/events/eventIntegrity.ts:7 `normalizedEventIdentity`
29. **59% similitud de fragmentos** — worker/src/sports/sportsLive.ts:139 `marketsFrom` ⇄ worker/src/sports/mlb.ts:96 `marketView`
30. **59% similitud de fragmentos** — worker/src/sports/sportsLive.ts:139 `marketsFrom` ⇄ worker/src/sports/nba.ts:126 `marketView`
31. **58% similitud de fragmentos** — worker/src/noah/noahChat.ts:31 `parseJsonObject` ⇄ worker/src/noah/noahImage.ts:38 `parseJsonObject`

## Anexo C — TODOS los nombres repetidos entre archivos detectados (49)

1. **`json`** — worker/src/entry.ts:25 · worker/src/noah/noahChat.ts:16 · worker/src/noah/noahImage.ts:20 · worker/src/sports/mlb.ts:294 · worker/src/sports/nba.ts:436 · worker/src/sports/sportsAnalysis.ts:12 · worker/src/sports/sportsContext.ts:295 · worker/src/sports/sportsLive.ts:59
2. **`fetch`** — dj-noa-cloud/src/entry.ts:44 · dj-noa-cloud/src/entry.ts:50 · worker/src/entry.ts:75 · worker/src/index.ts:157 · worker/src/index.ts:290
3. **`normalize`** — src/domains/sports/hardRockOdds.ts:35 · worker/src/noah/noahChat.ts:51 · worker/src/noah/noahImage.ts:70 · worker/src/sports/sportsContext.ts:30 · worker/src/sports/sportsLive.ts:44
4. **`impliedProbability`** — src/features/sports/MlbWorkspace.tsx:75 · src/features/sports/NbaWorkspace.tsx:51 · worker/src/sports/mlb.ts:111 · worker/src/sports/nba.ts:141 · worker/src/sports/sportsLive.ts:199
5. **`rec`** — worker/src/sports/mlb.ts:49 · worker/src/sports/nba.ts:36 · worker/src/sports/sportsAnalysis.ts:9 · worker/src/sports/sportsContext.ts:22 · worker/src/sports/sportsLive.ts:37
6. **`list`** — worker/src/sports/mlb.ts:50 · worker/src/sports/nba.ts:37 · worker/src/sports/sportsAnalysis.ts:11 · worker/src/sports/sportsContext.ts:23 · worker/src/sports/sportsLive.ts:38
7. **`str`** — worker/src/sports/mlb.ts:51 · worker/src/sports/nba.ts:38 · worker/src/sports/sportsAnalysis.ts:10 · worker/src/sports/sportsContext.ts:24 · worker/src/sports/sportsLive.ts:39
8. **`odd`** — src/features/sports/HardRockMarketEnhancer.tsx:13 · src/features/sports/MlbWorkspace.tsx:70 · src/features/sports/NbaWorkspace.tsx:50 · src/features/sports/SportsGameDetail.tsx:72
9. **`num`** — worker/src/sports/mlb.ts:52 · worker/src/sports/nba.ts:39 · worker/src/sports/sportsContext.ts:25 · worker/src/sports/sportsLive.ts:40
10. **`getJson`** — worker/src/sports/mlb.ts:66 · worker/src/sports/nba.ts:62 · worker/src/sports/sportsContext.ts:33 · worker/src/sports/sportsLive.ts:52
11. **`statusView`** — worker/src/sports/mlb.ts:72 · worker/src/sports/nba.ts:81 · worker/src/sports/sportsLive.ts:79
12. **`teamView`** — worker/src/sports/mlb.ts:82 · worker/src/sports/nba.ts:99 · worker/src/sports/sportsLive.ts:89
13. **`marketMoneyLine`** — worker/src/sports/mlb.ts:88 · worker/src/sports/nba.ts:118 · worker/src/sports/sportsLive.ts:117
14. **`americanFromProbability`** — worker/src/sports/mlb.ts:115 · worker/src/sports/nba.ts:145 · worker/src/sports/sportsLive.ts:203
15. **`cleanTime`** — src/domains/noah/noahImageReconcile.ts:43 · worker/src/noah/noahChat.ts:55
16. **`deletePhoto`** — src/features/events/EventWorkspace.tsx:313 · src/features/excel/SheetWorkspace.tsx:340
17. **`addRow`** — src/features/excel/ExcelModulesEnhancer.tsx:131 · src/features/excel/SheetWorkspace.tsx:237
18. **`deleteColumn`** — src/features/excel/ExcelModulesEnhancer.tsx:229 · src/features/excel/SheetWorkspace.tsx:357
19. **`hasCellValue`** — src/features/noah/NoahImageIntake.tsx:48 · src/features/noah/NoahVoice.tsx:45
20. **`blobToDataUrl`** — src/features/noah/NoahImageIntake.tsx:89 · src/services/storage/dataBackup.ts:22
21. **`toggle`** — src/features/noah/NoahImageIntake.tsx:454 · src/features/tasks/ReminderWorkspace.tsx:66
22. **`onVisibility`** — src/features/noah/NoahVoice.tsx:456 · src/features/safety/AppMaintenance.tsx:7
23. **`readCachedSnapshot`** — src/features/sports/MlbWorkspace.tsx:57 · src/features/sports/NbaWorkspace.tsx:46
24. **`writeCachedSnapshot`** — src/features/sports/MlbWorkspace.tsx:66 · src/features/sports/NbaWorkspace.tsx:49
25. **`favoriteFromOdds`** — src/features/sports/MlbWorkspace.tsx:80 · src/features/sports/NbaWorkspace.tsx:52
26. **`favoriteForGame`** — src/features/sports/MlbWorkspace.tsx:87 · src/features/sports/NbaWorkspace.tsx:57
27. **`shortTeamName`** — src/features/sports/MlbWorkspace.tsx:101 · src/features/sports/NbaWorkspace.tsx:65
28. **`gameClock`** — src/features/sports/MlbWorkspace.tsx:106 · src/features/sports/NbaWorkspace.tsx:66
29. **`dateLabel`** — src/features/sports/MlbWorkspace.tsx:114 · src/features/sports/NbaWorkspace.tsx:73
30. **`marketLabel`** — src/features/sports/MlbWorkspace.tsx:121 · src/features/sports/NbaWorkspace.tsx:77
31. **`implied`** — src/features/sports/SportsGameDetail.tsx:77 · worker/src/sports/sportsLive.ts:154
32. **`readText`** — worker/src/noah/noahChat.ts:26 · worker/src/noah/noahImage.ts:30
33. **`parseJsonObject`** — worker/src/noah/noahChat.ts:31 · worker/src/noah/noahImage.ts:38
34. **`cleanString`** — worker/src/noah/noahChat.ts:45 · worker/src/noah/noahImage.ts:52
35. **`int`** — worker/src/sports/mlb.ts:56 · worker/src/sports/nba.ts:43
36. **`abbr`** — worker/src/sports/mlb.ts:57 · worker/src/sports/nba.ts:44
37. **`nextDate`** — worker/src/sports/mlb.ts:59 · worker/src/sports/nba.ts:46
38. **`marketView`** — worker/src/sports/mlb.ts:96 · worker/src/sports/nba.ts:126
39. **`marketConsensus`** — worker/src/sports/mlb.ts:123 · worker/src/sports/nba.ts:158
40. **`sortGames`** — worker/src/sports/mlb.ts:135 · worker/src/sports/nba.ts:313
41. **`officialStatus`** — worker/src/sports/mlb.ts:172 · worker/src/sports/nba.ts:91
42. **`loadEspnGames`** — worker/src/sports/mlb.ts:221 · worker/src/sports/nba.ts:264
43. **`loadGames`** — worker/src/sports/mlb.ts:228 · worker/src/sports/nba.ts:294
44. **`loadStandings`** — worker/src/sports/mlb.ts:288 · worker/src/sports/nba.ts:413
45. **`dateOnly`** — worker/src/sports/sportsContext.ts:31 · worker/src/sports/sportsLive.ts:45
46. **`aggregate`** — worker/src/sports/sportsContext.ts:104 · worker/src/sports/sportsLive.ts:309
47. **`playerName`** — worker/src/sports/sportsContext.ts:202 · worker/src/sports/sportsLive.ts:363
48. **`lineupFromBoxscoreSide`** — worker/src/sports/sportsContext.ts:207 · worker/src/sports/sportsLive.ts:368
49. **`loadMlbGameContext`** — worker/src/sports/sportsContext.ts:220 · worker/src/sports/sportsLive.ts:381

## Anexo D — ventanas de código idénticas (muestra, 35)

1. src/features/sports/MlbWorkspace.tsx:14 ⇄ src/features/sports/NbaWorkspace.tsx:9 ⇄ src/features/sports/SportsEnhancer.tsx:6 ⇄ src/features/sports/SportsGameDetail.tsx:18
2. src/features/sports/MlbWorkspace.tsx:15 ⇄ src/features/sports/NbaWorkspace.tsx:10 ⇄ src/features/sports/SportsEnhancer.tsx:7 ⇄ src/features/sports/SportsGameDetail.tsx:19
3. src/features/sports/MlbWorkspace.tsx:16 ⇄ src/features/sports/NbaWorkspace.tsx:11 ⇄ src/features/sports/SportsEnhancer.tsx:8 ⇄ src/features/sports/SportsGameDetail.tsx:20
4. worker/src/sports/mlb.ts:47 ⇄ worker/src/sports/nba.ts:34 ⇄ worker/src/sports/sportsContext.ts:20 ⇄ worker/src/sports/sportsLive.ts:35
5. worker/src/sports/mlb.ts:49 ⇄ worker/src/sports/nba.ts:36 ⇄ worker/src/sports/sportsContext.ts:22 ⇄ worker/src/sports/sportsLive.ts:37
6. worker/src/sports/mlb.ts:70 ⇄ worker/src/sports/nba.ts:79 ⇄ worker/src/sports/sportsLive.ts:77
7. worker/src/sports/mlb.ts:72 ⇄ worker/src/sports/nba.ts:81 ⇄ worker/src/sports/sportsLive.ts:79
8. worker/src/sports/mlb.ts:73 ⇄ worker/src/sports/nba.ts:82 ⇄ worker/src/sports/sportsLive.ts:80
9. worker/src/sports/mlb.ts:74 ⇄ worker/src/sports/nba.ts:83 ⇄ worker/src/sports/sportsLive.ts:81
10. src/features/noah/NoahImageIntake.tsx:53 ⇄ src/features/noah/NoahVoice.tsx:50
11. src/features/sports/MlbWorkspace.tsx:107 ⇄ src/features/sports/NbaWorkspace.tsx:67
12. src/features/sports/MlbWorkspace.tsx:108 ⇄ src/features/sports/NbaWorkspace.tsx:68
13. src/features/sports/MlbWorkspace.tsx:252 ⇄ src/features/sports/NbaWorkspace.tsx:216
14. src/features/sports/MlbWorkspace.tsx:253 ⇄ src/features/sports/NbaWorkspace.tsx:217
15. src/features/sports/MlbWorkspace.tsx:254 ⇄ src/features/sports/NbaWorkspace.tsx:218
16. src/features/sports/MlbWorkspace.tsx:255 ⇄ src/features/sports/NbaWorkspace.tsx:219
17. src/features/sports/MlbWorkspace.tsx:256 ⇄ src/features/sports/NbaWorkspace.tsx:220
18. src/features/sports/MlbWorkspace.tsx:257 ⇄ src/features/sports/NbaWorkspace.tsx:221
19. src/features/sports/MlbWorkspace.tsx:259 ⇄ src/features/sports/NbaWorkspace.tsx:223
20. src/features/sports/MlbWorkspace.tsx:260 ⇄ src/features/sports/NbaWorkspace.tsx:224
21. src/features/sports/MlbWorkspace.tsx:261 ⇄ src/features/sports/NbaWorkspace.tsx:225
22. src/features/sports/MlbWorkspace.tsx:262 ⇄ src/features/sports/NbaWorkspace.tsx:226
23. src/features/sports/MlbWorkspace.tsx:292 ⇄ src/features/sports/NbaWorkspace.tsx:251
24. src/features/sports/MlbWorkspace.tsx:293 ⇄ src/features/sports/NbaWorkspace.tsx:252
25. src/features/sports/MlbWorkspace.tsx:295 ⇄ src/features/sports/NbaWorkspace.tsx:254
26. src/features/sports/MlbWorkspace.tsx:296 ⇄ src/features/sports/NbaWorkspace.tsx:255
27. src/features/sports/MlbWorkspace.tsx:297 ⇄ src/features/sports/NbaWorkspace.tsx:256
28. src/features/sports/MlbWorkspace.tsx:298 ⇄ src/features/sports/NbaWorkspace.tsx:257
29. src/features/sports/MlbWorkspace.tsx:299 ⇄ src/features/sports/NbaWorkspace.tsx:258
30. src/features/sports/MlbWorkspace.tsx:300 ⇄ src/features/sports/NbaWorkspace.tsx:259
31. src/features/sports/MlbWorkspace.tsx:301 ⇄ src/features/sports/NbaWorkspace.tsx:260
32. src/features/sports/MlbWorkspace.tsx:302 ⇄ src/features/sports/NbaWorkspace.tsx:261
33. src/features/sports/MlbWorkspace.tsx:311 ⇄ src/features/sports/NbaWorkspace.tsx:270
34. src/features/sports/MlbWorkspace.tsx:312 ⇄ src/features/sports/NbaWorkspace.tsx:271
35. src/features/sports/MlbWorkspace.tsx:313 ⇄ src/features/sports/NbaWorkspace.tsx:272

## Anexo E — bloques CSS idénticos entre archivos (11)

1. `.app-shell:has(.calendar-page) .content` en src/features/calendar/styles/calendar-focus.css:14 ⇄ `.app-shell:has(.events-page) .content` en src/features/events/styles/events-focus.css:8 ⇄ `.app-shell:has(.sheet-classic) .content` en src/features/excel/styles/sheet-focus.css:10 ⇄ `.app-shell:has(.reminders-workspace) .content` en src/features/tasks/styles/reminders-focus.css:14
2. `.events-page` en src/features/events/styles/events-focus.css:12 ⇄ `.sheet-classic` en src/features/excel/styles/sheet-focus.css:14 ⇄ `.reminders-workspace` en src/features/tasks/styles/reminders-focus.css:26
3. `.event-hub-header` en src/features/events/styles/event-hub.css:1 ⇄ `.sheet-detail-header` en src/features/excel/styles/sheet.css:1
4. `.event-hub-header>button` en src/features/events/styles/event-hub.css:1 ⇄ `.sheet-detail-header>button` en src/features/excel/styles/sheet.css:1
5. `.event-hub-header strong` en src/features/events/styles/event-hub.css:1 ⇄ `.sheet-detail-header strong` en src/features/excel/styles/sheet.css:1
6. `.event-editor` en src/features/events/styles/events.css:1 ⇄ `.reminder-editor` en src/features/tasks/styles/reminders.css:1
7. `.event-editor-head` en src/features/events/styles/events.css:1 ⇄ `.reminder-editor-head` en src/features/tasks/styles/reminders.css:1
8. `.event-editor-head h3` en src/features/events/styles/events.css:1 ⇄ `.reminder-editor-head h3` en src/features/tasks/styles/reminders.css:1
9. `.event-form input,.event-form select,.event-form textarea` en src/features/events/styles/events.css:1 ⇄ `.reminder-form input,.reminder-form select,.reminder-form textarea` en src/features/tasks/styles/reminders.css:1
10. `.sheet-classic .sheet-classic-head .eyebrow` en src/features/excel/styles/sheet-focus.css:18 ⇄ `.reminders-workspace .reminder-topline .eyebrow` en src/features/tasks/styles/reminders-focus.css:60
11. `.sheet-classic .sheet-mini-summary` en src/features/excel/styles/sheet-focus.css:24 ⇄ `.reminders-workspace .reminder-metrics` en src/features/tasks/styles/reminders-focus.css:88

## Anexo F — inventario de responsabilidades detectadas por búsquedas léxicas

### apiFetch
- `src/features/tasks/reminderNotifications.ts`: 4 coincidencia(s) léxica(s)
- `worker/src/index.ts`: 4 coincidencia(s) léxica(s)
- `src/features/sports/SportsGameDetail.tsx`: 3 coincidencia(s) léxica(s)
- `worker/src/entry.ts`: 3 coincidencia(s) léxica(s)
- `dj-noa-cloud/src/entry.ts`: 2 coincidencia(s) léxica(s)
- `src/features/noah/NoahImageIntake.tsx`: 1 coincidencia(s) léxica(s)
- `src/features/noah/NoahVoice.tsx`: 1 coincidencia(s) léxica(s)
- `src/features/sports/MlbWorkspace.tsx`: 1 coincidencia(s) léxica(s)
- `src/features/sports/NbaWorkspace.tsx`: 1 coincidencia(s) léxica(s)
- `worker/src/sports/mlb.ts`: 1 coincidencia(s) léxica(s)
- `worker/src/sports/nba.ts`: 1 coincidencia(s) léxica(s)
- `worker/src/sports/sportsContext.ts`: 1 coincidencia(s) léxica(s)
- `worker/src/sports/sportsLive.ts`: 1 coincidencia(s) léxica(s)

### routing
- `worker/src/index.ts`: 11 coincidencia(s) léxica(s)
- `worker/src/entry.ts`: 10 coincidencia(s) léxica(s)
- `dj-noa-cloud/src/entry.ts`: 2 coincidencia(s) léxica(s)
- `dj-noa-cloud/src/googleDriveOAuth.ts`: 1 coincidencia(s) léxica(s)
- `worker/src/sports/mlb.ts`: 1 coincidencia(s) léxica(s)
- `worker/src/sports/nba.ts`: 1 coincidencia(s) léxica(s)
- `worker/src/sports/sportsContext.ts`: 1 coincidencia(s) léxica(s)
- `worker/src/sports/sportsLive.ts`: 1 coincidencia(s) léxica(s)

### dbWrite
- `src/domains/events/eventMutations.ts`: 16 coincidencia(s) léxica(s)
- `src/services/storage/dataBackup.ts`: 15 coincidencia(s) léxica(s)
- `src/features/excel/ExcelModulesEnhancer.tsx`: 13 coincidencia(s) léxica(s)
- `src/domains/noah/noahExcel.ts`: 11 coincidencia(s) léxica(s)
- `src/features/excel/SheetWorkspace.tsx`: 11 coincidencia(s) léxica(s)
- `src/features/tasks/ReminderWorkspace.tsx`: 6 coincidencia(s) léxica(s)
- `src/app/App.tsx`: 3 coincidencia(s) léxica(s)
- `src/domains/noah/noahVisionCommit.ts`: 2 coincidencia(s) léxica(s)
- `src/features/events/EventWorkspace.tsx`: 2 coincidencia(s) léxica(s)
- `src/services/media/photoOptimization.ts`: 2 coincidencia(s) léxica(s)
- `src/features/tasks/reminderNotifications.ts`: 1 coincidencia(s) léxica(s)

### events
- `src/features/excel/ExcelModulesEnhancer.tsx`: 4 coincidencia(s) léxica(s)
- `src/app/navigationBack.ts`: 2 coincidencia(s) léxica(s)
- `src/domains/noah/noahExcel.ts`: 2 coincidencia(s) léxica(s)
- `src/features/sports/SportsGameDetail.tsx`: 2 coincidencia(s) léxica(s)
- `src/features/tasks/ReminderWorkspace.tsx`: 2 coincidencia(s) léxica(s)
- `src/features/excel/useExcelLandscape.ts`: 1 coincidencia(s) léxica(s)
- `src/features/noah/NoahVoice.tsx`: 1 coincidencia(s) léxica(s)
- `src/features/safety/AppMaintenance.tsx`: 1 coincidencia(s) léxica(s)
- `src/features/sports/SportsEnhancer.tsx`: 1 coincidencia(s) léxica(s)
- `src/main.tsx`: 1 coincidencia(s) léxica(s)

### persistence
- `src/features/excel/SheetWorkspace.tsx`: 3 coincidencia(s) léxica(s)
- `src/features/noah/NoahVoice.tsx`: 2 coincidencia(s) léxica(s)
- `src/features/sports/MlbWorkspace.tsx`: 2 coincidencia(s) léxica(s)
- `src/features/sports/NbaWorkspace.tsx`: 2 coincidencia(s) léxica(s)
- `src/features/sports/SportsGameDetail.tsx`: 2 coincidencia(s) léxica(s)
- `src/features/tasks/reminderNotifications.ts`: 2 coincidencia(s) léxica(s)
- `src/features/sports/SportsEnhancer.tsx`: 1 coincidencia(s) léxica(s)

## Estado

**P01: inventario documentado; NO autoriza eliminar los grupos de arriba.** Organización física de los módulos Worker en `worker/src/sports/` y `worker/src/noah/` realizada sin alterar lógica ni APIs, con pruebas. El siguiente paso de eliminación será por grupos pequeños, con pruebas de equivalencia y rollback por commit, priorizando DUP-01/02 y los duplicados puros; después escritura Excel, fecha/recordatorios y CSS con QA real.
