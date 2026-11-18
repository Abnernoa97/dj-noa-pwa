# 00 · DJ NOA — LEER PRIMERO

**Corte inicial histórico:** 18 de noviembre de 2026. El tablero `01-TABLERO-MAESTRO.md` es el único plan vigente; los documentos `05`, `06` y `07` son sus inventarios técnicos, NO planes paralelos.

**Actualización verificada 18/11/2026:** una sola `main` (74 ramas eliminadas y auditadas), `src/` organizado por dominios/funciones, Worker con carpetas `sports/` y `noah/`, auditor semántico permanente y **97/97 pruebas + Cloudflare SUCCESS** en la reorganización. Cualquier cifra de ramas/archivos siguiente corresponde a la línea base histórica, no al estado de hoy.

## Misión
Reducir duplicaciones reales, acoplamiento, archivos innecesarios y complejidad del mantenimiento de DJ NOA **sin cambiar su comportamiento, borrar datos, reinventar la interfaz o consumir minutos de GitHub Actions**.

## Línea base verificada antes de limpiar
- GitHub: `Abnernoa97/dj-noa-pwa`, `main` = `31d47ae5b9d90ebd86709ebc755240318f2b783a`.
- **Respaldo histórico:** `backup-before-djnoa-master-reorganization-20261118` existió en ese commit. La referencia de esa rama se eliminó después de auditarla; el commit correspondiente permanece en el historial de `main`.
- Recuento previo: **74 ramas**, **117 archivos Git**, **33 CSS bajo `src/`**, **39 TS/TSX bajo `src/`**, **13 tests** y **3 workflows GitHub Actions**. Los contadores describen inventario, no defectos.
- Arquitectura visible: `src/App.tsx` (~783 líneas), `src/SheetWorkspace.tsx` (~556), `src/ExcelModulesEnhancer.tsx` (~348), `src/ios-dark-redesign.css` (~39 kB), `worker/src/noahChat.ts` (~30 kB).
- Datos locales: Dexie `dj-noa-local` versiones 1–6 y siete tablas; esta fase no migra ni borra ninguna.
- Cloudflare comprobado por API: Worker existente `dj-noa-pwa` en cuenta de producción, conectado a GitHub `main`; build `npm run build` y deploy `npx wrangler deploy`, auto-build activado; último build observado para commit `31d47ae` fue `success`, con deployment 100 %.
- `dj-noa-cloud/` es código separado experimental y **no** debe activarse, mezclarse ni borrarse por una limpieza de PWA.

## Lo aprendido de otros proyectos, sin copiar sus dependencias
1. **HAVANA NICE V2:** módulos por dominio (`app/features/services`), entrada única y paquetes compartidos solo cuando existen dos consumidores reales; auditoría de importaciones y componentes carga diferida.
2. **HAVANA QUOTES:** `scripts/project-audit.mjs`, CI local previo al build y organización `src/features`, `src/shared`, `worker`; GitHub almacena el código pero **Cloudflare Workers Builds publica**.
3. **HAVANA EVENTS:** Estado maestro y módulos separados para calendario, listas, sincronización y analítica, preservando IDs y contratos.
4. **HAVANA CLOUD:** inventario, fases con criterios verificables, matriz de deuda, protocolo de rollback, bitácora y distinción entre test sintético y QA física.

No hay en la lista de repositorios conectados un repositorio identificable llamado literalmente «HAVANA GLOW»; no atribuirle estructuras sin revisar su fuente exacta.

## Reglas innegociables
- Un solo tablero actualizado en `01`. Estado por tarea: **PENDIENTE / EN CURSO / VERIFICADO / BLOQUEADO**, con evidencia concreta.
- **Nunca copiar carpetas enteras de otro producto.** Reutilizar patrones, no credenciales, DB, rutas ni CSS ajeno.
- **Una sola implementación por capacidad**, pero no eliminar un módulo sin demostrar que ya no tiene consumidores y que existe ruta alternativa probada.
- Preservar los nombres de IndexedDB, claves locales, tabla, migraciones y contratos; ni `indexedDB.deleteDatabase` ni limpiar cachés como táctica de refactor.
- El usuario sigue trabajando con la misma PWA; las modificaciones se publican encima sin exigir desinstalar.
- La lógica existente de dólares, anticipo/fee/pagos, Noah Vision sin blobs, fecha de evento vs fecha de pago y navegación nativa es contrato.
- Para publicación usar **solo Cloudflare Workers Builds**, no GitHub Actions, AppDeploy, Vercel ni otro sistema.
- El Worker `dj-noa-pwa` y sus bindings `AI`, `REMINDER_SCHEDULER` y `ASSETS` no cambian por un reordenamiento.
- No limpiar automáticamente ramas: cada respaldo o investigación tiene que catalogarse como conservable, fusionada, obsoleta comprobada o incierta.
- Antes de dar una fase por cerrada: auditoría de referencias, pruebas, resultado Cloudflare, rollback y QA relevante.

**Siguiente paso tras la fase de gobernanza:** abrir `01-TABLERO-MAESTRO.md`, comenzar P01 y registrar evidencia de cada candidato. Nada de declarar «100 %» mientras P01–P12 sigan abiertas.
