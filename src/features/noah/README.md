# Capítulo Noah · Interfaz

- `NoahVoice.tsx`: conversación y voz.
- `NoahImageIntake.tsx`: selección, revisión y aprobación de análisis visual.
- `NoahActionOverlay.tsx`: estado visual de acciones.
- `styles/`: apariencia Noah mantenida en su orden original de la cascada.
- Las reglas, validación y escritura se encuentran en `src/domains/noah/`, no en componentes duplicados.
- Las fotos utilizadas por Visión no se incorporan a galerías salvo subida manual del usuario.

- `noahActionSteps.ts`: única función de presentación de pasos/progreso de Noah, extraída de App, sin acceso a IndexedDB ni red.

## Worker de IA

Las rutas de voz/chat y visión están físicamente en `worker/src/noah/`. `worker/src/entry.ts` mantiene origen/ratelimit y conserva los mismos endpoints. No duplicar los sanitizadores ni operaciones de escritura en componentes de UI.
