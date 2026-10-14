# DJ NOA CLOUD — Generación 1 (fundación aislada)

## Estado: preparación técnica; NO está publicada

Esta carpeta prepara el futuro servicio **DJ NOA CLOUD**, independiente tanto de HAVANA CLOUD como del Worker principal DJ NOA. Se aloja temporalmente en el repositorio de DJ NOA para poder revisar, compilar y probar los archivos con GitHub Actions; se puede extraer sin cambios de aplicación a un repositorio GitHub dedicado cuando esté disponible su creación.

**No modifica ni conecta la PWA existente.** Todavía no sincroniza Eventos, Calendario, Excel, Tareas, Noah, fotos ni archivos.

### Reglas obligatorias de aislamiento

1. Usar un **repositorio GitHub independiente** para el servicio una vez aprovisionado; este subdirectorio es solo el staging aislado.
2. Reutilizar la **cuenta Cloudflare de DJ NOA PWA**, previa comprobación de su account ID, pero desplegar **otro Worker** `dj-noa-cloud-private`, otro Durable Object `DJ_NOA_CLOUD_REGISTRY` y secretos nuevos exclusivos. La cuenta puede coincidir también con la de HAVANA CLOUD; queda prohibido compartir bindings, DO, bases de datos, OAuth, ficheros o rutas entre nubes.
3. Utilizar **un proyecto OAuth de Google y una cuenta Google Drive exclusivos de DJ NOA**. No copiar `client_id`, `client_secret`, refresh tokens, identificadores de carpetas, ni datos de otras apps.
4. Nombre local reservado a esta nube: `dj-noa-cloud-offline-g1` (IndexedDB), `dj-noa-cloud-media-g1` (Cache Storage). La base existente `dj-noa-local` permanece intacta.
5. Identificar todos los recursos remotos como `dncloud:g1:...`; rechazar ids ajenos. No exponer un endpoint capaz de enumerar o copiar recursos de otra nube.
6. Acceso remoto **cerrado por defecto**: solo está definido `GET /api/health`, que responde `setup_required` HTTP 503. Todos los demás endpoints responden 404 hasta implementar y probar autenticación, rate limiting, sesiones, OAuth y autorización por cuenta.
7. **Prohibido** publicar passwords, tokens, fotos, vídeos, bases de datos o backups en GitHub, logs o archivos de configuración.
8. Las migraciones serán no destructivas. Antes de conectar la nube a DJ NOA se probarán backup/restore, conflictos, interrupciones de internet, privacidad y recuperación del iPhone.

### Estructura

- `wrangler.jsonc`: configuración aislada, sin credenciales, del futuro Worker
- `src/entry.ts`: ruta de salud mínima, cerrada por defecto; Durable Object separado (vacío, no accesible públicamente)
- `src/identity.ts`: nombres y claves exclusivos para impedir cruces
- `src/syncContract.ts`: contrato de sincronización, sin escrituras y sin conexiones de red
- `tsconfig.json`: compilación independiente del backend

### Requisitos antes de conectar nada

- Confirmar y configurar el repositorio GitHub nuevo `dj-noa-cloud`, el **account ID de Cloudflare que ya aloja DJ NOA PWA**, y un proyecto Google Cloud exclusivo de DJ NOA CLOUD. No crear otra cuenta Cloudflare.
- Crear `DJ_NOA_CLOUD_ACCESS_PASSWORD`, `DJ_NOA_CLOUD_SESSION_SECRET` y `DJ_NOA_GOOGLE_CLIENT_SECRET` como *secrets* **solo en el nuevo Worker**.
- Implementar sesión segura HttpOnly, anti-CSRF, límites de intentos y pruebas de acceso; después OAuth, Drive y operaciones de archivos.
- Integrar en DJ NOA solo después de un despliegue validado y de pruebas de aislamiento. No usar los datos del hermano como entorno de prueba.

### Comprobaciones automáticas

Ejecutar `npm run typecheck:cloud` y `npm run test:cloud` desde la raíz del repositorio de DJ NOA. El Build Check incluye estos dos comandos.

**Nota de seguridad:** Esta fase **no crea ni conecta** un Worker nuevo a Cloudflare ni una cuenta Google. Se reutilizará la cuenta Cloudflare existente, pero la separación de datos exige credenciales, bindings, recursos y autorizaciones independientes. Las cuotas y la facturación serán compartidas a nivel de cuenta.

## Fase 2A: Google Drive exclusivo (preparación)

La guía de aprovisionamiento se encuentra en [PROVISIONING.md](./PROVISIONING.md).
La implementación `src/googleDriveOAuth.ts` valida **solo la cuenta de Google autorizada**, construye OAuth con PKCE+state y contiene helpers para canje/renovación de tokens; no se importa en las rutas activas, porque faltan sesión protegida, registro de state de uso único y credenciales de una infraestructura realmente independiente.

Ejecutar `npm run test:cloud` para probar aislamiento de identidad, callbacks, permisos OAuth y rechazo de una cuenta ajena. La integración real de Google Drive **no está habilitada**.
