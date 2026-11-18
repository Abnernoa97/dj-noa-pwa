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
- [ ] GitHub `main` contiene cero `.github/workflows/*.yml`.
- [ ] `npm run build` conserva el typecheck y ejecuta auditoría/tests.
- [ ] Cloudflare Workers Builds del commit nuevo: `success`.
- [ ] La app instalada y los datos existentes siguen intactos (QA física por confirmar, NO inferir del build).
- [ ] Actualizar el tablero P00 a VERIFICADO únicamente con la evidencia disponible y dejar QA física pendiente cuando aplique.

## Próximo bloque
**P01:** mapa de importaciones reales, CSS con propietarios, escritor canónico de cada dato y catálogo de candidatos. No borrar por similitud de nombres. Conservar esta bitácora como referencia única para otros chats.
