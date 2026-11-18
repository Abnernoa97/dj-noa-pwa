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

## Próximo bloque
**P01:** mapa de importaciones reales, CSS con propietarios, escritor canónico de cada dato y catálogo de candidatos. No borrar por similitud de nombres. Conservar esta bitácora como referencia única para otros chats.
