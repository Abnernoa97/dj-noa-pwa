# 01 · DJ NOA — TABLERO MAESTRO ÚNICO

**Fecha inicial:** 2026-11-18. Este es el único tablero activo. Los avances se marcan después de comprobarse, no por intención ni por tamaño de commits. No sumar subpasos solapados como defectos independientes.

| ID | Fase | Estado inicial | Cierre exigido |
|---|---|---|---|
| P00 | Respaldo, inventario y Cloudflare sin GitHub Actions | VERIFICADO | Sin workflows, build Cloudflare SUCCESS, respaldo confirmado |
| P01 | Mapa del código, importaciones, referencias y duplicados | EN CURSO | Inventario de consumidores, huérfanos solo candidatos y duplicaciones demostradas |
| P02 | Contrato de datos, offline y respaldo | PENDIENTE | Dexie 1–6, blobs manuales, PWA SW, recuperación y transacciones sin pérdida |
| P03 | Coordinador App y navegación | PENDIENTE | Reducir `src/App.tsx` por extracción, sin nuevos estados ni pantallas duplicadas |
| P04 | Excel único y complementos | PENDIENTE | `SheetWorkspace` + `ExcelModulesEnhancer` comparten fórmulas, filas y columnas |
| P05 | Motor financiero USD único | PENDIENTE | Categorías, contratos, anticipos, cobros, gastos e históricos sin duplicidad |
| P06 | Eventos, Calendario, Tareas | PENDIENTE | Un evento y un ID; fechas/recordatorios sincronizados sin tocar fechas manuales |
| P07 | Noah Voz, Imagen y IA | PENDIENTE | Contratos de acciones/validación únicos, 1–5 fotos temporales y cero fotos automáticas almacenadas |
| P08 | Worker y API | PENDIENTE | Un ruteo de API, seguridad preservada y módulos de IA / recordatorios sin cambios de bindings |
| P09 | Deportes MLB/NBA y contexto | PENDIENTE | Servicios, caché y presentación sin llamadas duplicadas ni cambios de resultados |
| P10 | CSS y diseño | PENDIENTE | Sustituir capas duplicadas **con QA visual** Android/iPhone y conservar diseño aprobado |
| P11 | Velocidad, scroll, orientación y PWA offline | PENDIENTE | Mediciones comparativas, service worker, navegación y Excel horizontal funcionando |
| P12 | Aceptación final, documentación y poda de ramas | PENDIENTE | Build Cloudflare, QA real, revisión de backups y candidatos de ramas uno por uno |

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
3. **CSS:** 33 CSS en `src/`; capas `styles`, `viewport-layout`, `visual-polish`, `sheet-focus`, `excel-modules`, `ios-dark-redesign`, `excel-landscape`. Revisar cascada y media queries; cifras de selectores repetidos serían solo candidatos, no defectos probados.
4. **App + Noah:** `App.tsx` concentra rutas, trabajo de IA, navegación y estado; extraer funciones puras/servicios primero.
5. **Ramas:** 74 antes del nuevo respaldo. No borrar ramas `backup-`/`before-` ni históricas sin verificar equivalencia con `main` y referencias.

## Límites de la aceptación
- Build **SUCCESS** ≠ app comprobada físicamente.
- GitHub `main` actualizado ≠ despliegue Cloudflare exitoso.
- Lista de posibles archivos huérfanos ≠ código muerto confirmado.
- Menos líneas ≠ necesariamente mayor calidad.
- No tocar HAVANA V2, CLOUD, EVENTS, QUOTES, otros repos, cuentas o sus datos.
