# 01 · DJ NOA — TABLERO MAESTRO ÚNICO

**Fecha inicial:** 2026-11-18. Este es el único tablero activo. Los avances se marcan después de comprobarse, no por intención ni por tamaño de commits. No sumar subpasos solapados como defectos independientes.

| ID | Fase | Estado inicial | Cierre exigido |
|---|---|---|---|
| P00 | Respaldo, inventario y Cloudflare sin GitHub Actions | VERIFICADO | Sin workflows, build Cloudflare SUCCESS, respaldo confirmado |
| P01 | Mapa del código, importaciones, referencias y duplicados | VERIFICADO · auditoría y consolidación segura | Inventario de consumidores, huérfanos solo candidatos y duplicaciones demostradas |
| P02 | Contrato de datos, offline y respaldo | EN CURSO | Dexie 1–6, blobs manuales, PWA SW, recuperación y transacciones sin pérdida |
| P03 | Coordinador App y navegación | EN CURSO | Reducir `src/app/App.tsx` por extracción, sin nuevos estados ni pantallas duplicadas |
| P04 | Excel único y complementos | EN CURSO | `SheetWorkspace` + `ExcelModulesEnhancer` comparten fórmulas, filas y columnas |
| P05 | Motor financiero USD único | EN CURSO | Categorías, contratos, anticipos, cobros, gastos e históricos sin duplicidad |
| P06 | Eventos, Calendario, Tareas | EN CURSO | Un evento y un ID; fechas/recordatorios sincronizados sin tocar fechas manuales |
| P07 | Noah Voz, Imagen y IA | EN CURSO | Contratos de acciones/validación únicos, 1–5 fotos temporales y cero fotos automáticas almacenadas |
| P08 | Worker y API | PENDIENTE | Un ruteo de API, seguridad preservada y módulos de IA / recordatorios sin cambios de bindings |
| P09 | Deportes MLB/NBA y contexto | EN CURSO | Servicios, caché y presentación sin llamadas duplicadas ni cambios de resultados |
| P10 | CSS y diseño | EN CURSO | Sustituir capas duplicadas **con QA visual** Android/iPhone y conservar diseño aprobado |
| P11 | Velocidad, scroll, orientación y PWA offline | EN CURSO · rutas divididas y compiladas | Mediciones comparativas, service worker, navegación y Excel horizontal funcionando |
| P12 | Aceptación final, documentación y poda de ramas | EN CURSO | Build Cloudflare, QA real, revisión de backups y candidatos de ramas uno por uno |

## Estado de la estructura, 18/11/2026

- `src/` raíz: solo `main.tsx` y declaraciones de TypeScript (`react-css.d.ts`, `vite-env.d.ts`).
- `src/app/`: coordinador, navegación nativa e Inicio. `App.tsx` ahora tiene **281 líneas**; las 410 líneas de ejecución de acciones de Noah están en `src/app/controllers/noahActionCoordinator.ts` (solo un coordinador, sin segundo estado).
- `src/features/`: Eventos, Calendario, Excel, Tareas, Noah, Deportes, Seguridad e Inicio; sus componentes y CSS tienen carpetas de propietario.
- `src/domains/`: Finanzas USD, Eventos, Noah, Excel/sheet y probabilidades deportivas; reglas sin elementos visuales.
- `src/services/`: instancia Dexie, respaldos y optimización de medios manuales.
- `src/shared/`: contrato único de tipos y normalización de texto.
- `worker/src/`: Worker de producción original; `dj-noa-cloud/` sigue aislado y en pausa.
- Compilación final comprobada de `23ee054`: **91/91 tests, Cloudflare SUCCESS, deployment 100 %**. No constituye QA física Android/iPhone.
- **P12-a poda de ramas VERIFICADA (18/11/2026): GitHub devuelve únicamente `main`**. Fueron eliminadas las 74 ramas históricas mediante una ejecución única de GitHub Actions (run `44402947387`, SUCCESS), después de verificar sus SHA y PR. Se retiró el workflow temporal inmediatamente; `.github/workflows` no existe en `main`. Las referencias de backup desaparecieron pero sus commits ancestrales permanecen en la historia de `main`. P12 general sigue EN CURSO por QA física y aceptación final.

## P01 · corte certificado de limpieza semántica (18/11/2026)

- Auditor de importaciones PWA + Worker tras P01-f: **81 fuentes rastreadas / 81 alcanzables / 0 candidatos huérfanos**. Esto prueba alcance estático, no ausencia absoluta de código muerto.
- **P01-e verificado:** eliminadas dos funciones equivalentes de generación de clave `grid_...` (Excel y Noah) a favor de `makeGridColumnKey`; 93/93 pruebas y Cloudflare deployment **SUCCESS** del commit `5b61b4e`.
- **P01-f verificado:** retirado `src/domains/finance/finance.ts`, sin consumidores en producción. Las pruebas financieras históricas se redirigieron a la conciliación contractual USD vigente; **93/93**, Cloudflare build `ba08a33e-6e59-462c-b606-471e81512935` **SUCCESS**, deployment 100 % del commit `22acf2c`.
- Permanecen **33 hojas CSS** y **3,008 menciones `!important`**; son indicios de deuda en P10, no autorización de borrado. Revisar CSS con QA visual Android/iPhone, Excel/Noah con integridad de datos y navegadores.
- **P01 continúa EN CURSO**, por auditoría semántica más profunda de funciones y contratos; el grafo limpio no equivale a finalizar todo el proyecto.

## P01-g · Auditoría semántica y organización física: INVENTARIO VERIFICADO (18/11/2026)

- Se instaló `scripts/audit-semantic.mjs` en el build oficial Cloudflare (read-only, TypeScript AST + PostCSS). Analizó **85 archivos**, **1,217 funciones/métodos/callbacks**, **31 grupos de funciones exactos**, **31 parejas similares** y **49 nombres repetidos**. Estos recuentos son candidatos, no 31 errores listos para borrar.
- En CSS confirmó **183 selectores repetidos entre archivos**, **177 grupos con propiedades compartidas en el mismo media context**, **624 comparaciones de valores distintos**, **11 bloques CSS idénticos** y **3,008 `!important`**. Ver todo en `07-ANEXO-CSS-COMPLETO.md`.
- Informe completo con rutas y líneas: `05-CATALOGO-DUPLICACIONES.md`. Arquitectura y propietario de cada capacidad: `06-MAPA-PROPIETARIOS.md`.
- Ordenadas físicamente **5 rutas de deportes** en `worker/src/sports/` y **2 módulos de Noah** en `worker/src/noah/` sin copiar, alterar o reimplementar código; `entry.ts`, rutas y bindings permanecen. Regresiones de reubicación añadidas.
- Verificación de organización: `main` sin otras ramas, sin GitHub Actions; build `56f7464` Cloudflare **SUCCESS**, **97/97 pruebas**, deploy 100 %. Esta es una auditoría de coincidencias sintácticas y grafos; **NO acredita que todos los duplicados funcionales estén ya unificados**.
- **P01 inventario documentado; P01 integración/eliminación EN CURSO para la siguiente etapa.** No ejecutar una eliminación masiva de 183 selectores ni de 31 grupos sin equivalencias, rollback y QA.

## P01-h · Primera tanda de unificación efectiva VERIFICADA — 18/11/2026

**Comparación del mismo auditor de TypeScript/PostCSS (corte inicial → commit `bfff20b`):**

| Indicador | Antes | Después | Cambio |
|---|---:|---:|---:|
| Grupos de cuerpos de función idénticos entre archivos | 31 | **15** | **−16 (−51.6 %)** |
| Pares de cuerpos de función similares | 31 | **24** | −7 |
| Nombres de funciones repetidos entre archivos | 49 | **31** | −18 |
| Funciones/métodos/callbacks presentes en código analizado | 1,217 | **1,175** | −42 |
| Selectores CSS repetidos entre archivos | 183 | **183** | Sin tocar, QA visual obligatoria |
| `!important` CSS | 3,008 | **3,008** | Sin tocar, QA visual obligatoria |

**Seis lotes consolidados en la única `main`, todos con tests y Cloudflare SUCCESS:**
- **DUP-01a:** parsers, cuotas, estados y consenso idénticos MLB/NBA → `worker/src/sports/shared/espnCore.ts`.
- **DUP-01b:** parsers compartidos Context/Live/Analysis, identidad deportiva y fechas → `sports/shared/contextCore.ts`.
- **DUP-02a:** nombre de jugador y orden de bateo/lineups → `sports/shared/contextCore.ts`.
- **DUP-03a:** favoritos, cuotas, reloj y etiquetas en tarjetas MLB/NBA → `src/features/sports/sportsPresentation.ts`.
- **DUP-05a:** un solo snapshot Excel y detector de celdas vacías para Noah Voz/Visión → `src/domains/noah/noahSheetSnapshot.ts`.
- **DUP-05b:** voz usa normalizador canónico `src/shared/normalizeText.ts`.

**Último corte `bfff20b`: 114/114 pruebas, 0 fallos, Cloudflare SUCCESS, versión Worker desplegada al 100 %.** Los recuentos son indicios sintácticos de duplicación, no funciones eliminables automáticamente. P01 sigue EN CURSO por Excel/Dexie, recurrencia, IA y CSS.

## P01-i/j · Excel y Noah: consolidación VERIFICADA (18/11/2026)

- **DUP-06a**: una sola transacción de borrado de filas y fotos en src/services/storage/sheetMutations.ts. Consumidores: Noah Excel, ExcelModulesEnhancer y SheetWorkspace. Se conservan los métodos individuales/bulk y confirmaciones de cada superficie.
- **DUP-06b**: una sola función pura sheetFinancialPatch en src/domains/sheet/sheetFinancial.ts. Reutilizada por Noah y la grilla Excel para ingresos menos gastos menos inversiones, sin alterar guardas USD ni columnas neutrales.
- **Regresiones y publicación**: 121/121 pruebas aprobadas; Cloudflare SUCCESS, commit aff2ebd, despliegue 100 %. El primer intento falló solo por dependencia ausente en la prueba, y fue reemplazado por un store simulado; no se añadió dependencia.
- **Auditor de duplicaciones**: 31 grupos idénticos iniciales → 15 en el corte anterior → **14 grupos ahora**. Permanecen 24 pares similares; los 183 selectores CSS y 3,008 declaraciones !important siguen intactos.
- **Riesgo identificado y sin modificar**: borrar columnas se hace de tres maneras no equivalentes. Noah puede recalcular registros históricos MXN al borrar una columna; las otras interfaces no recalculan igual. Requiere contrato y pruebas de integridad antes de tocar esa ruta. P01/P04/P05 siguen EN CURSO, no hay QA física Android/iPhone.

## P01 · CIERRE DEL INVENTARIO Y LA CONSOLIDACIÓN DEMOSTRABLE (18/11/2026)

**Fuente:** compilación Cloudflare SUCCESS commit `3ea1565`, **153/153 pruebas**, Worker desplegado al 100 %. Auditor `scripts/audit-semantic.mjs`, 100 fuentes TS/CSS analizadas (67 código, 33 CSS). `scripts/audit-candidates.mjs`: 96 fuentes seguidas, 96 alcanzables, **0 archivos huérfanos confirmados**.

| Indicador auditor | Inicio | Corte verificado |
|---|---:|---:|
| Grupos de funciones sintácticamente idénticas | 31 | **1** (callback de formulario no intercambiable) |
| Pares de funciones similares | 31 | **8** (clasificados en el registro de excepciones) |
| Selectores presentes en varios CSS | 183 | **182** (no equivale a 182 duplicados borrables) |
| Reglas `!important` | 3,008 | **2,978** |
| Declaraciones anteriores inequívocamente repetidas, misma prioridad/medio/selector/valor | 36 | **0** pendientes de esta clase |

**Unificaciones efectivas:** utilidades ESPN, contexto MLB, resultados/mercado y fechas UTC; UI de cuota y refresco MLB/NBA; HTTP JSON Worker; funciones IA de texto/JSON y normalización con política de dólares separada; recurrencia cliente; Excel/Noah cálculo monetario y borrado de fila+foto; fotos/blob/DataURL y selección de filas. Publicación por Cloudflare, sin GitHub Actions ni ramas auxiliares.

**Decisión de cierre:** P01 **VERIFICADO como auditoría de dependencias y consolidación de duplicados equivalentes**. No significa que P03/P04/P07/P10/P11/P12 estén terminadas. Los **8 similares + 1 exacto** detectados son coincidencias que requieren mantener contratos distintos o una refactorización explícita de componentes, no implementaciones que se deban borrar sin más. Clasificados en `08-REGISTRO-EXCEPCIONES.md`.

**CSS P10 EN CURSO:** 33 hojas y 182 selectores compartidos, 11 bloques CSS idénticos, 175 coincidencias selector/contexto con propiedades comunes y 600 comparaciones de valores diferentes; 2,978 `!important`. Se retiraron 36 declaraciones exactas y el auditor PostCSS da **0 candidatas idénticas del tipo seguro**. Para reestructurar el resto se necesita verificación de cascada y QA real iOS/Android, no sólo bajar números. `src/app/App.tsx` y la escritura de columnas Excel siguen siendo deuda P03/P04. No tocar `dj-noa-cloud/` (pausada).

## Corte P03/P04/P10/P11 · consolidación de 19/11/2026 (publicada)

**Entrega verificable:** commit `7c796f7`, Cloudflare Workers Builds **SUCCESS**, Worker versión `b7e2fc9e-6262-49d5-9408-da8090659af6` al **100 %**. **167/167 pruebas aprobadas**, cero fallos, typecheck frontend/Worker/cloud y Vite production OK. GitHub sigue en **una sola `main` y cero Actions**.

| Área | Acción aplicada | Estado |
|---|---|---|
| **P03 · Coordinación** | Extraído ejecutor de Noah de `App.tsx` a `src/app/controllers/noahActionCoordinator.ts`; `App.tsx` de 682 a **281** líneas. Solo una navegación/DB, sin duplicar flujos. | Extracción VERIFICADA; P03 EN CURSO para aceptar el resto del coordinador |
| **P04 · Excel** | Una función de borrado de columnas **atómica**, compartida por clásica, grid y Noah; elimina las claves, recalcula sólo montos USD afectados. Creación de columnas financieras compartida entre grid/Noah, con nombre normalizado único bajo transacción. | Operaciones VERIFICADAS; P04 EN CURSO para escritor de metadatos y fórmulas clásicas |
| **P11 · Carga** | Rutas `CalendarWorkspace`, `MlbWorkspace`, `ReminderWorkspace`, `SheetWorkspace`, `EventsView`, `EventHub` y `EventEditor` bajo `React.lazy`; ejecutor Noah con `import()` al usarse. `vite-plugin-pwa` precache de chunks JS, sin activar otra PWA. | Carga y build VERIFICADOS; falta QA en móviles/offline real |
| **P10 · CSS** | Se conserva **exacto** el orden de los 33 CSS en `src/main.tsx`, ahora etiquetado por capas; nuevo mapa `src/styles/core/STYLE-CASCADE.md` y pruebas de propietario/prelación. | Organización VERIFICADA; reducción de 2,978 `!important` y QA visual pendientes |

**Medición del empaquetado:** `dist/assets/index` JavaScript **569.58 kB → 482.08 kB** (reducción ~15.4 %; gzip ~172.60 → 149.95 kB). Los trozos de las siete pantallas y del ejecutor Noah se cargan bajo demanda. `xlsx` se mantiene como chunk separado de **500.06 kB** por su motor de hojas de cálculo; no se ha suprimido ni reemplazado funcionalidad. No se confunde tamaño sin comprimir con transferencia gzip, ni build con medición de inicio real de dispositivo.

**Pendiente concreto de la fase siguiente:** `App` todavía coordina estado de UI; Excel clásico y editor financiero difieren en estructura de columnas, la actualización de columnas/comportamientos debe centralizarse con tests; el CSS `ios-dark-redesign.css` sigue cargado y no se han hecho capturas comparativas. La limpieza no autoriza resetear IndexedDB ni cambiar identidad o permisos de la IA.

## Corte P03/P04/P11 · 27/11/2026 · edición Excel, fórmulas y rutas de Inicio

**Confirmación de producción:** commit `59f6472f9518cd03fd7413f9d98bfefbb51c07d8`, Cloudflare Worker `dj-noa-pwa`, build `caa923f8-ea2f-44d2-aa51-d59da886994c` **SUCCESS**, **178/178 pruebas**, 0 fallos; versión desplegada `410a1767-5c8e-4fa2-bffc-2404b3bd4998` al **100 %**. GitHub sigue con una única `main`, cero workflows.

| Módulo | Mejora verificada | Pendiente para cierre integral |
|---|---|---|
| **P04 · Columnas** | `updateSheetColumn` en `src/services/storage/sheetColumnMutations.ts` se usa desde grilla Excel y Noah; nombre y comportamiento financiero editados en **una transacción**. Valida nombres equivalentes, recalcula sólo filas USD que contengan la celda afectada, protege totales manuales y montos históricos MXN. Tests con rollback y cobertura negativa. | La vista clásica y la grilla aún tienen modos de edición de columna distintos y deben comprobarse en la PWA real |
| **P04 · Fórmulas** | Evaluador y resolución de celdas movidos de `SheetWorkspace` a `src/domains/sheet/sheetFormula.ts` (módulo sin React ni DB). Corregidos operandos vacíos para evitar tratarlos como cero. `SheetWorkspace`: **524→462 líneas**. | QA en fórmulas reales, importaciones y exportaciones XLSX |
| **P03 · Navegación** | Inicio envía `onView` a `navigateTo` en vez de `setView`, con una sola pila de regreso y el mismo estado para Inicio/BottomNav. | Validar el gesto/botón nativo atrás en cada pantalla |
| **P11 · Carga** | NBA usa `React.lazy` en `HomeView`; el paquete `index` baja de **482.08→473.65 kB** (gzip **149.95→147.65 kB**). Chunk NBA `8.06 kB` separado. XLSX continúa separado y sin cambios. | Medir apertura real y verificar modo offline en Android/iPhone |
| **P12 · Pruebas** | `npm run test:ai` limita a 4 workers concurrentes pero sigue ejecutando `tests/*.test.mjs`. Auditorías, typecheck, pruebas y despliegue se realizan en Cloudflare sin gastar GitHub Actions. | QA física y aceptación total de P02–P11 |

**Importante:** 178 pruebas y compilación SUCCESS verifican código y publicación; no acreditan capturas o pruebas físicas de la PWA. No se modificaron `src/services/storage/db.ts`, migraciones Dexie 1–6, `dj-noa-cloud/`, esquema USD ni CSS. P03/P04/P11 permanecen **EN CURSO** hasta cerrar sus criterios reales, no se declaran artificialmente terminados.

## P06 · Sustitución del calendario por interfaz HAVANA V31 adaptada (27/11/2026)

**Origen solo como referencia de código y UX:** `Abnernoa97/havana-nice-events` (read-only); no se copiaron datos ni se tocó su despliegue, D1, R2, IA o configuración. **Destino único:** `Abnernoa97/dj-noa-pwa` → `main` → Cloudflare Worker.

- Se eliminó el `CalendarWorkspace` visual anterior de Mes/Semana/Día y se escribió una nueva coordinación de **Calendario, Eventos, Cotizaciones y Resumen**, con papelera recuperable, filtros por estado/fecha, años, miniaturas de fotos locales, búsqueda, selección múltiple, colores de estados y agenda por día con tareas y Excel.
- La navegación se divide en `CalendarWorkspace`, `HavanaMonthView`, `HavanaListView`, `HavanaSummaryView` y reglas puras `havanaCalendarModel`. Los tres CSS del mismo capítulo sustituyeron los antiguos estilos, sin importar CSS global ni servicios de Havana.
- Nuevo formulario con campos opcionales **weddingPlanner, city y quote**, en el objeto de DJ NOA (misma tabla y ID); cotización nueva comienza en estado `tentative`. El importe de texto de cotización no equivale a un cobro; el resumen consulta únicamente `portfolioUsdSettlement(sheetRows)`.
- Papelera implementada con `trashedAt`, sin borrar fotos/eventos/tareas/filas al archivar; restauración conserva las relaciones. Eliminación permanente mediante el dueño anterior `deleteEventWithRelations` y confirmación. `App.tsx` entrega a las pantallas/Noah solo eventos activos, más una colección separada de archivados para la papelera.
- **IA:** solamente `startNoah` y la arquitectura actual de DJ NOA. HAVANA ANALYTIC, su historial, D1, R2 y bridge Quotes quedan expresamente excluidos.
- **Conservación:** no se alteraron `src/services/storage/db.ts`, migraciones Dexie ni backend. Las relaciones antiguas (Excel, calendario, recordatorios y fotos) se mantienen. Cambios por contratos opcionales y UI; sin migración de datos.
- QA requerida: pruebas Android/iOS reales, presentación móvil, selección por fecha, papelera de eventos con fotos/finanzas, enlazado de Noah y actualización offline. **P06 continúa EN CURSO hasta esa aceptación**; las pruebas unitarias/compilación no equivalen a QA física.

## Orden obligatorio
P00 → P01 → P02. Después trabajar por dominio en secuencia P03 a P11; P12 cierra, no sustituye la verificación de cada bloque. Un problema crítico de seguridad/integridad puede adelantarse documentando el motivo.

## Protocolo por cada microtarea
- **ID de tarea**, archivo(s) exactos, qué sigue funcionando, sospecha y evidencia.
- Confirmar dónde se importa o utiliza, incluidos componentes dinámicos, Worker, CSS, tests, Service Worker y despliegue.
- Proponer **una sola ruta canónica** y migrar consumidores, sin crear wrapper vacío o copia escondida.
- Escribir/priorizar prueba de regresión negativa: qué no debe cambiar, qué datos no se pueden borrar.
- Ejecutar `npm run audit:structure`, `npm run typecheck`, `npm run typecheck:cloud`, `npm run test:ai`, `npm run build`.
- Comparar el diff: no más cambios que los aprobados; comprobar versión Cloudflare de producción; QA física cuando corresponda.
- Actualizar Pxx a **VERIFICADO** solamente con evidencia en `04-BITACORA.md`.

## Priorización de candidatos iniciales
1. **Excel:** existen vista clásica y complemento que monta su propia tabla. Revisión de responsabilidad, no borrar ninguna ahora.
2. **Moneda:** `finance.ts`, `moneyIntegrity.ts`, `financialOverview.ts` y cálculos en componentes. Consolidar sin redefinir contrato USD ni sumar fee+anticipo dos veces.
3. **CSS:** 33 hojas ya agrupadas en `src/features/*/styles/` y `src/styles/core/`; capas `styles`, `viewport-layout`, `visual-polish`, `sheet-focus`, `excel-modules`, `ios-dark-redesign`, `excel-landscape`. Revisar cascada y media queries; cifras de selectores repetidos serían solo candidatos, no defectos probados.
4. **App + Noah:** `src/app/App.tsx` concentra rutas, trabajo de IA, navegación y estado; extraer funciones puras/servicios primero.
5. **Ramas:** podadas y verificadas (74/74). Mantener únicamente `main`; no abrir ramas temporales durante la auditoría.

## Límites de la aceptación
- Build **SUCCESS** ≠ app comprobada físicamente.
- GitHub `main` actualizado ≠ despliegue Cloudflare exitoso.
- Lista de posibles archivos huérfanos ≠ código muerto confirmado.
- Menos líneas ≠ necesariamente mayor calidad.
- No tocar HAVANA V2, CLOUD, EVENTS, QUOTES, otros repos, cuentas o sus datos.
