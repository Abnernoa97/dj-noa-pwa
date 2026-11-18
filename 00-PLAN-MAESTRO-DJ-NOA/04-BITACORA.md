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
