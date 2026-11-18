# CSS transversal de DJ NOA

Esta carpeta contiene la cascada general, viewport, overlays, correcciones de scroll, estilo editorial y la capa final `ios-dark-redesign.css`.

**No modificar el orden de importación en `src/main.tsx` por estética de código.** `excel-landscape.css` se importa después del rediseño iOS. Los estilos propios de Calendario, Eventos, Excel, Noah, Tareas, Inicio y Deportes permanecen en sus carpetas `src/features/*/styles/`.

Inventario exhaustivo de **183 selectores repetidos entre archivos** y 177 contextos con propiedades compartidas en `00-PLAN-MAESTRO-DJ-NOA/07-ANEXO-CSS-COMPLETO.md`. Ninguno se borra sin comprobar prioridad, `@media`, mobile, scroll y QA física.
