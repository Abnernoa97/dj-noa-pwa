# Worker / Noah · servidor de IA
- `noahChat.ts`: conversación, reglas de salida y sanitización de acciones `sanitizeActions`.
- `noahImage.ts`: análisis visual de imágenes, evidencia y validación de acciones.
- Importación interna: `noahImage.ts` usa `./noahChat` como única fuente de sanitización de acciones.
- Entrada externa **única**: `../entry.ts` con autorización de origen y rate limit.

`aiResponse.ts` es el único propietario de `readText` y `parseJsonObject` para chat y visión; ambas rutas conservan exactamente los fallbacks de respuestas IA y JSON. Las normalizaciones de texto quedan separadas porque el chat admite `# Worker / Noah · servidor de IA
- `noahChat.ts`: conversación, reglas de salida y sanitización de acciones `sanitizeActions`.
- `noahImage.ts`: análisis visual de imágenes, evidencia y validación de acciones.
- Importación interna: `noahImage.ts` usa `./noahChat` como única fuente de sanitización de acciones.
- Entrada externa **única**: `../entry.ts` con autorización de origen y rate limit.

 y la visión no. No guardar fotografías automáticamente.

- `aiNormalization.ts`: un único limpiador de acentos con dos políticas explícitas: Chat conserva `$` para importes; Visión no. Reutiliza la implementación sin mezclar criterios de búsqueda.
