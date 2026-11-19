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
| P11 | Velocidad, scroll, orientación y PWA offline | PENDIENTE | Mediciones comparativas, service worker, navegación y Excel horizontal funcionando |
| P12 | Aceptación final, documentación y poda de ramas | EN CURSO | Build Cloudflare, QA real, revisión de backups y candidatos de ramas uno por uno |

## Estado de la estructura, 18/11/2026

- `src/` raíz: solo `main.tsx` y declaraciones de TypeScript (`react-css.d.ts`, `vite-env.d.ts`).
- `src/app/`: coordinador, navegación nativa e Inicio. `App.tsx` ahora tiene 687 líneas tras extraer 98 líneas de presentadores Noah.
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
