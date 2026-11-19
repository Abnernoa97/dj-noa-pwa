# CSS de DJ NOA · Orden único de carga y propietarios

**Control estructural P10:** los 33 archivos de estilo conservan exactamente el orden previo. `src/main.tsx` es la única entrada de CSS y esta tabla es descriptiva, no una autorización para reorganizar la cascada sin pruebas.

El principio de organización es **un propietario por componente, no un segundo CSS de parches**. Los archivos de `features/*/styles/` definen controles propios de Calendario, Eventos, Excel, Recordatorios, Noah y Deportes. Los de `styles/core/` contienen estructura transversal, scroll y los ajustes de dispositivo. Las últimas hojas son históricamente sensibles al orden.

| Orden | Hoja | Propietario | Capa de precedencia |
|---:|---|---|---|
| 1 | `styles/core/styles.css` | Interfaz transversal | 1 · Base |
| 2 | `features/events/styles/events.css` | Módulo events | 1 · Base |
| 3 | `features/events/styles/event-hub.css` | Módulo events | 1 · Base |
| 4 | `features/calendar/styles/calendar.css` | Módulo calendar | 1 · Base |
| 5 | `features/excel/styles/sheet.css` | Módulo excel | 1 · Base |
| 6 | `features/excel/styles/sheet-fields.css` | Módulo excel | 1 · Base |
| 7 | `features/tasks/styles/reminders.css` | Módulo tasks | 1 · Base |
| 8 | `styles/core/viewport-layout.css` | Interfaz transversal | 1 · Base |
| 9 | `features/noah/styles/noah-voice.css` | Módulo noah | 1 · Base |
| 10 | `features/noah/styles/noah-image.css` | Módulo noah | 1 · Base |
| 11 | `features/noah/styles/noah-actions.css` | Módulo noah | 1 · Base |
| 12 | `features/noah/styles/noah-calendar-live.css` | Módulo noah | 1 · Base |
| 13 | `features/safety/styles/data-safety.css` | Módulo safety | 1 · Base |
| 14 | `styles/core/visual-polish.css` | Interfaz transversal | 2 · Correcciones |
| 15 | `features/excel/styles/excel-scroll-fix.css` | Módulo excel | 2 · Correcciones |
| 16 | `styles/core/scroll-fix.css` | Interfaz transversal | 2 · Correcciones |
| 17 | `features/calendar/styles/calendar-focus.css` | Módulo calendar | 3 · UI específica |
| 18 | `features/calendar/styles/calendar-week-day.css` | Módulo calendar | 3 · UI específica |
| 19 | `features/events/styles/events-focus.css` | Módulo events | 3 · UI específica |
| 20 | `features/excel/styles/sheet-focus.css` | Módulo excel | 3 · UI específica |
| 21 | `features/excel/styles/excel-modules.css` | Módulo excel | 3 · UI específica |
| 22 | `features/tasks/styles/reminders-focus.css` | Módulo tasks | 3 · UI específica |
| 23 | `styles/core/overlay-layout.css` | Interfaz transversal | 3 · UI específica |
| 24 | `features/home/styles/home-focus.css` | Módulo home | 3 · UI específica |
| 25 | `features/sports/styles/mlb.css` | Módulo sports | 3 · UI específica |
| 26 | `features/sports/styles/mlb-matchups.css` | Módulo sports | 3 · UI específica |
| 27 | `features/sports/styles/nba.css` | Módulo sports | 3 · UI específica |
| 28 | `features/sports/styles/sports-detail.css` | Módulo sports | 3 · UI específica |
| 29 | `features/sports/styles/hard-rock-market.css` | Módulo sports | 3 · UI específica |
| 30 | `features/sports/styles/sports-context.css` | Módulo sports | 3 · UI específica |
| 31 | `features/sports/styles/sports-realtime.css` | Módulo sports | 3 · UI específica |
| 32 | `styles/core/ios-dark-redesign.css` | Interfaz transversal | 4 · Dispositivos |
| 33 | `features/excel/styles/excel-landscape.css` | Módulo excel | 4 · Dispositivos |

## Reglas de mantenimiento

- **No modificar el orden de los imports CSS** como táctica de limpieza. Comparar antes y después el valor computado de propiedades críticas, en el contexto `@media` correcto.
- Reglas compartidas de distinta especificidad o contexto no son automáticamente duplicados. El escáner existente `scripts/audit-css-prunable.mjs` identifica únicamente declaraciones anteriores idénticas en contexto/selector/valor/prioridad.
- Las pantallas `sheet-classic`, `calendar-page`, `events-page` y los overlays requieren pruebas de scroll, teclado y orientación. iOS y paisaje Excel se quedan al final.
- 36 declaraciones estrictamente redundantes ya retiradas; quedan 2,978 `!important`, 182 selectores presentes en varios archivos y 11 bloques de CSS idénticos detectados por similitud. **P10 sigue EN CURSO** hasta QA visual Android/iPhone, no sólo pruebas sintéticas.
- Al crear un componente, añadir sus estilos a la carpeta de su feature; no añadir `!important` como parche automático. La etapa final sólo debería contener diferencias reales por plataforma.
