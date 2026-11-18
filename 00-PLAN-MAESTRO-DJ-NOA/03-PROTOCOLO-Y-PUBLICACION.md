# 03 · PROTOCOLO DE LIMPIEZA, PRUEBAS Y PUBLICACIÓN CLOUDFLARE

## ÚNICA RUTA OFICIAL
`GitHub main` (solo código) → `Cloudflare Workers Builds` → `npm run build` → `npx wrangler deploy` → Worker `dj-noa-pwa`, con el `wrangler.jsonc` existente.

Observado por API el 18/11/2026: conexión GitHub activa a repo `Abnernoa97/dj-noa-pwa`, rama `main`, build/deploy automáticos, caché de compilación, último build anterior de commit `31d47ae` SUCCESS y despliegue Wrangler de 100 %. **No confundir Cloudflare Builds con GitHub Actions.**

No usar GitHub Actions, scripts `workflow_dispatch`, GitHub Pages, AppDeploy, Vercel ni pasos de deployment que consuman los 2,000 minutos GitHub. No recrear `.github/workflows` sin petición expresa.

**La comprobación ocurre en Cloudflare** porque `npm run build` ejecuta guard de estructura, types, suites y bundling antes de publicar. Si falla una comprobación, el deploy de ese build debe detenerse. No declarar la publicación hasta verificar en Cloudflare el hash exacto, outcome y deployment.

## Seguridad antes de cambiar código
1. Anotar el SHA `main` y mantener respaldo fijo no movible.
2. Clasificar la tarea con un ID Pxx y listar los archivos afectados. Preservar servicios/estados/UX.
3. Antes de eliminar una función/archivo, buscar referencias de importaciones, JSX, CSS, rutas, Worker, service worker y tests. Incluir referencias indirectas.
4. Comparar mismo input → mismo output en datos/eventos, además de prueba negativa de lo que NO cambia.
5. No ejecutar nunca limpieza automática de IndexedDB, Cache Storage, OPFS ni `localStorage`.
6. No cambiar el worker `dj-noa-pwa`, `REMINDER_SCHEDULER`, `AI`, `ASSETS` ni los nombres de almacenamiento.
7. Inspeccionar controles de costos y recursos antes de introducir nube, R2, D1 u otra capacidad.
8. Compilar y pasar todas las pruebas. Revisar diff y trazabilidad.
9. Publicar de manera controlada en `main`, comprobar Cloudflare build/deployment y luego teléfono.
10. Actualizar el tablero y la bitácora con SHA, resultados y pendientes.

## Política de ramas
- `main` es la única rama de publicación de DJ NOA.
- Ramas `backup-` y `before-` se inventarían antes de eliminar; no se fusionan ni borran por nombre o edad.
- No reabrir variantes `stage`, `experimental` o viejas que dupliquen la lógica sin un análisis de diferencia respecto a `main`.
- Para eliminar una rama: comprobar si contiene commits únicos, PR abierta, referencias en el plan, backup necesario, despliegue o trabajo todavía no integrado; registrar en `04-BITACORA`.
- En esta primera tanda **no se elimina ninguna rama**.

## Criterios de aceptación
- Test de tipos PWA+Worker y nube privada staged (solo typecheck).
- Tests de IA, eventos, dinero USD, fotos sin persistencia, Excel horizontal, integridad y navegación.
- La ruta de integración `integration-tests` con emulación IndexedDB requiere su dependencia de prueba en entorno aislado; no introducirla en producción sin necesidad.
- Preservar el motor de notificaciones, asociación `eventId`, fecha manual de pagos y fotos adjuntas manualmente.
- Capturas/QA Android e iPhone cuando cambian gestos, teclado, scroll, orientación, offline o multimedia.
- Después de la publicación, si falla alguna comprobación: detener nuevos cambios, comparar versión con el respaldo y revertir **código** sin borrar ni modificar datos del dispositivo.

## Protección de alcance
Otros repositorios no se modifican. El subproyecto `dj-noa-cloud/` permanece en preparación, no se despliega ni comparte DB o credenciales. La cuenta `DJ NOAH` independiente tampoco se toca. Para DJ NOA PWA se usa exclusivamente su Worker Cloudflare actual y su cuenta de producción ya verificados.
