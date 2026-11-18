# DJ NOA — aplicación y mantenimiento

DJ NOA es una PWA React + Vite con información local IndexedDB, Eventos, Calendario, Excel USD, Tareas, Noah Visión/Voz y módulos deportivos. El repositorio es `Abnernoa97/dj-noa-pwa` y su única rama de publicación es `main`.

## Publicación oficial
- **GitHub = fuente de código e historial. Cloudflare Workers Builds = compilación y despliegue.**
- Worker existente: `dj-noa-pwa`. La cuenta de Cloudflare de producción ya está asociada al repositorio y rama `main`.
- Configuración observada el 18/11/2026: build `npm run build`, deploy `npx wrangler deploy`, raíz `/`, auto-build activo.
- **GitHub Actions deshabilitado mediante la eliminación de todos sus workflows.** No reintroducir `.github/workflows/*` mientras se mantenga la política de no consumir minutos GitHub.
- `npm run build` debe ejecutar primero las comprobaciones de estructura, tipos y regresión; no se deben desplazar a GitHub Actions.
- Nunca desplegar ni provisionar `dj-noa-cloud-private` como parte de mantenimiento del PWA.

## Plan maestro único
Abrir [00 · LEER PRIMERO](00-PLAN-MAESTRO-DJ-NOA/00-LEER-PRIMERO.md) y seguir el [01 · TABLERO ÚNICO](00-PLAN-MAESTRO-DJ-NOA/01-TABLERO-MAESTRO.md). Las demás notas son documentación de ese mismo plan:
- [02 · Auditoría y arquitectura](00-PLAN-MAESTRO-DJ-NOA/02-AUDITORIA-Y-ARQUITECTURA.md)
- [03 · Protocolo de trabajo y Cloudflare](00-PLAN-MAESTRO-DJ-NOA/03-PROTOCOLO-Y-PUBLICACION.md)
- [04 · Bitácora y decisiones](00-PLAN-MAESTRO-DJ-NOA/04-BITACORA.md)
- [05 · Catálogo completo de funciones y candidatos](00-PLAN-MAESTRO-DJ-NOA/05-CATALOGO-DUPLICACIONES.md)
- [06 · Mapa único de propietarios y carpetas](00-PLAN-MAESTRO-DJ-NOA/06-MAPA-PROPIETARIOS.md)
- [07 · Anexo CSS: todos los selectores/contextos coincidentes](00-PLAN-MAESTRO-DJ-NOA/07-ANEXO-CSS-COMPLETO.md)

## Contratos que no deben romperse
- Base Dexie `dj-noa-local` y sus versiones de esquema, registros, fotos guardadas manualmente y respaldos locales.
- USD como única moneda operativa nueva; registros históricos de otras monedas se conservan sin renombrarlos ni convertirlos.
- Evento/Calendario/Excel/Tareas comparten `eventId` y las fechas independientes de anticipos no siguen automáticamente la fecha del evento.
- Noah Visión **no guarda** automáticamente imágenes originales; la función de fotos manuales sigue separada.
- No alterar otros repositorios, proyectos Cloudflare, cuentas, recursos ni credenciales.
- No reorganizar todo de golpe ni declarar limpio lo que aún no tiene comprobación.

## Comandos
- `npm ci`: instalación reproducible para builds.
- `npm run audit:structure`: lectura y control de estructura (no elimina nada).
- `npm run audit:candidates`: mapa de dependencias, posibles huérfanos y capas CSS (solo lectura; no borra nada).
- `npm run audit:semantics`: inventario AST de funciones repetidas, autores de datos y reglas CSS de todas las carpetas PWA/Worker/nube pausada. **No borra ni modifica archivos**.
- `npm run typecheck`: TypeScript PWA y Worker.
- `npm run typecheck:cloud`: TypeScript de la nube privada en pausa; verificación solamente.
- `npm run test:ai`: regresiones locales.
- `npm run build`: puerta de Cloudflare; auditoría, tipos, pruebas y Vite.

La aplicación en producción y la prueba física del teléfono son comprobaciones **distintas** del build. Consultar Cloudflare y probar Android/iPhone antes de cerrar un cambio visual, de orientación, multimedia u offline.
