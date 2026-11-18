# Worker / Noah · servidor de IA
- `noahChat.ts`: conversación, reglas de salida y sanitización de acciones `sanitizeActions`.
- `noahImage.ts`: análisis visual de imágenes, evidencia y validación de acciones.
- Importación interna: `noahImage.ts` usa `./noahChat` como única fuente de sanitización de acciones.
- Entrada externa **única**: `../entry.ts` con autorización de origen y rate limit.

Pendiente P01/P07: fusionar con pruebas las utilidades equivalentes `readText`, `parseJsonObject`, `normalize` y formateos; no cambiar contratos de la IA ni guardar fotografías automáticamente.
