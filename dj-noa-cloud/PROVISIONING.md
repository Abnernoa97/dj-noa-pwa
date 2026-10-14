# DJ NOA CLOUD — Fase 2A: aprovisionamiento independiente

**Estado: credenciales y cuentas pendientes.** Este documento no crea cuentas por sí mismo y no autoriza compartir las cuentas, tokens o datos de HAVANA CLOUD.

## 1. Repositorio independiente

Crear un repositorio **privado** con nombre sugerido `dj-noa-cloud` bajo la cuenta GitHub independiente destinada al proyecto. El conector de GitHub disponible en este entorno puede editar repositorios existentes, pero no crear cuentas ni repositorios nuevos.

El código preparado está dentro de `dj-noa-pwa/dj-noa-cloud/`. Cuando exista el nuevo repositorio, se trasladará **solo el código de esa carpeta**, con los ajustes necesarios para una raíz independiente, sin copiar otros datos, claves, historial de usuario ni referencias de HAVANA CLOUD. No hacer un fork del repositorio HAVANA CLOUD.

No ejecutar un despliegue de este Worker desde la cuenta Cloudflare de HAVANA CLOUD ni modificar su configuración.

## 2. Cuenta Cloudflare separada

Crear una cuenta Cloudflare exclusivamente para DJ NOA CLOUD. Es imprescindible comprobar el **account ID nuevo** desde su propio dashboard antes de configurar un Worker, sin incluirlo en archivos compartidos innecesariamente.

- Worker previsto: `dj-noa-cloud-private`
- Binding Durable Object: `DJ_NOA_CLOUD_REGISTRY`
- Clase DO: `DJNoaCloudRegistry`
- SQLite privado, sin migraciones del Worker de HAVANA CLOUD ni del Worker DJ NOA
- Dominio HTTPS exclusivo de DJ NOA CLOUD, que no sea la URL de ninguna otra aplicación
- Los límites de uso, gastos y secretos pertenecerán exclusivamente a esa cuenta

La configuración actual mantiene `workers_dev: false` y **no contiene routes**: está preparada para un entorno sin publicación involuntaria. Un despliegue válido necesitará una ruta/dominio propios tras verificar la cuenta correcta.

## 3. Cuenta de Drive y proyecto OAuth exclusivos

Usar una cuenta de Google y un proyecto de Google Cloud nuevos o independientes, asignados únicamente a DJ NOA CLOUD. Configurar en ese proyecto el consentimiento OAuth y un cliente OAuth tipo **Web application**, con redirect URI exacto:

`https://<host-independiente-de-dj-noa-cloud>/api/oauth/google/callback`

El origen `DJ_NOA_CLOUD_ORIGIN` es esa URL HTTPS sin barra final ni ruta. No usar el OAuth Client ID, Client Secret ni la redirect URI de HAVANA CLOUD.

Scopes previstos: `openid`, `email` y `https://www.googleapis.com/auth/drive.file`. El scope `drive.file` limita el acceso a archivos creados o autorizados para esta aplicación; no implica acceso automático a todo el contenido preexistente del Drive. Un flujo Google Picker o una estrategia explícita será necesario si se pretende gestionar archivos anteriores sin ampliar permisos.

Variables de entorno exclusivas del Worker:
- `DJ_NOA_CLOUD_ORIGIN`: origen HTTPS exclusivo (variable no secreta)
- `DJ_NOA_GOOGLE_CLIENT_ID`: cliente OAuth del proyecto DJ NOA (variable; tratar como configuración, no reutilizar)
- `DJ_NOA_ALLOWED_GOOGLE_EMAIL`: email autorizado de la cuenta exclusiva; exact match y `email_verified`
- `DJ_NOA_GOOGLE_CLIENT_SECRET`: secreto exclusivamente en Cloudflare **Secrets**, nunca en GitHub

Credenciales adicionales a crear más adelante, sin reutilizar contraseñas:
- `DJ_NOA_CLOUD_ACCESS_PASSWORD`: contraseña servidor de acceso privado
- `DJ_NOA_CLOUD_SESSION_SECRET`: secreto de firma de cookies de sesión

Ninguna de estas variables debe contener datos pertenecientes a HAVANA CLOUD.

## 4. Implementación actual, sin conectar

`src/googleDriveOAuth.ts` prepara validación de configuración aislada, URL Google OAuth con PKCE S256 y state, canje de código por tokens, verificación estricta del email permitido y renovación de acceso.

**No hay endpoints OAuth habilitados, ni sesiones, cookies, tokens almacenados ni llamadas a Google activas en producción.** No habilitar endpoints de Drive hasta implementar y probar:
1. Login de DJ NOA CLOUD, cookie HttpOnly+Secure, expiración, CSRF y rate limiting
2. Registro servidor de `state` y `code_verifier` por sesión con expiración y uso único, validado al volver de Google
3. Verificación de identidad de Google antes de almacenar refresh tokens, cifrado de datos sensibles, control de acceso por cuenta y revocación
4. API Drive con autorización por archivo/carpeta, paginación, cuota, límites y observabilidad privada
5. Confirmación de backups y restauración en dispositivo de prueba antes de sincronizar datos reales

## 5. Barreras verificables

- GitHub principal DJ NOA: `Abnernoa97/dj-noa-pwa`, fuente existente no modificada salvo archivos de preparación del cloud y pruebas
- Nuevo servicio GitHub: pendiente de creación
- Nueva cuenta Cloudflare: pendiente de creación
- Cuenta Drive/cliente OAuth: pendiente de conexión
- HAVANA CLOUD: **sin acceso ni sincronización**
- Cloudflare Worker principal DJ NOA: **sin rutas ni imports a `dj-noa-cloud/`**
- Backup del estado anterior: `backup-before-dj-noa-cloud-g1-20261013`

## 6. Validación

El CI verifica:
`npm run typecheck:cloud`, `npm run test:cloud`, `npm run test:ai`, `npm run build`, y `wrangler deploy --dry-run` para ambos Workers.

**Una compilación correcta no prueba la existencia de cuentas independientes ni la publicación real del Worker.** Esas comprobaciones deben realizarse después del aprovisionamiento externo.
