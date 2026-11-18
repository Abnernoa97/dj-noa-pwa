# Auditorías DJ NOA (solo lectura)

- `audit-structure.mjs`: estructura mínima, bindings Worker, esquema Dexie, ausencia GitHub Actions.
- `audit-candidates.mjs`: grafo de importaciones, candidatas huérfanas y recuento de hojas CSS. Ninguna eliminación.
- `audit-semantic.mjs`: TypeScript AST y PostCSS; 85 archivos PWA/Worker/nube en pausa, cuerpos repetidos, candidatos de equivalencia y conflictos de capas CSS. **Informa sin modificar**.

**Orden del build Cloudflare:** estructura → referencias → semántica → tipos → regresiones → Vite → Wrangler deploy. El informe de coincidencias es de diagnóstico; no abortar por duplicaciones detectadas. Las eliminaciones futuras requieren commit/QA/rollback por grupo.
