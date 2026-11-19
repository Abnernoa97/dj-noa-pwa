# 07 · DJ NOA — ANEXO CSS COMPLETO (P01 / P10)

**Inventario automatizado, 18/11/2026.** Procesado con PostCSS sobre los **33 CSS de `src/`** de DJ NOA, desde el commit `56f7464b08b52154ec12d52325b3a41d4c78fd6c`. El scanner recorre cada regla y sus `@media`; las etapas `from/to` de keyframes no se cuentan como selectores CSS de interfaz.

## Definiciones para no confundir un hallazgo con un defecto

- **183 selectores repetidos entre archivos**: el mismo selector existe en al menos dos hojas diferentes. Puede ser legítimo por cascada, scroll, tamaño de dispositivo o corrección iOS.
- **177 pares selector + contexto de media** tienen al menos una propiedad compartida entre distintos archivos.
- **624 comparaciones de valores de propiedades distintos** en esos grupos; son comparaciones de pares, no 624 errores ni 624 reglas borrables.
- **11 bloques de declaraciones CSS idénticos entre diferentes archivos**, a veces con selectores distintos pero estilo común.
- **3,008 declaraciones `!important`** detectadas; deben revisarse por su motivo, no eliminarse por número.
- La prioridad del CSS depende del orden de `src/main.tsx`: termina con `ios-dark-redesign.css` y después `excel-landscape.css`. Este orden no se altera sin pruebas físicas de scroll, overlays, iPhone, Android y horizontal Excel.

## Parte A · Los 183 selectores repetidos, con todos los archivos/líneas y media

1. **`.sheet-classic`** — 11 apariciones:  `src/features/excel/styles/excel-scroll-fix.css:4 [base]`;  `src/features/excel/styles/sheet-focus.css:14 [base]`;  `src/features/excel/styles/sheet-focus.css:60 [media (max-width:560px) /]`;  `src/features/excel/styles/sheet-focus.css:76 [media (min-width:700px) /]`;  `src/features/excel/styles/sheet.css:1 [base]`;  `src/features/excel/styles/sheet.css:1 [media (max-width:640px) /]`;  `src/styles/core/scroll-fix.css:17 [base]`;  `src/styles/core/scroll-fix.css:61 [base]`;  `src/styles/core/viewport-layout.css:49 [base]`;  `src/styles/core/viewport-layout.css:89 [base]`;  `src/styles/core/viewport-layout.css:100 [base]`
2. **`.home-view::before`** — 11 apariciones:  `src/features/home/styles/home-focus.css:52 [base]`;  `src/features/home/styles/home-focus.css:163 [media (max-height:780px) /]`;  `src/styles/core/styles.css:1 [base]`;  `src/styles/core/styles.css:1 [media (max-width:640px) /]`;  `src/styles/core/styles.css:1 [media (orientation:landscape) and (max-height:620px) /]`;  `src/styles/core/viewport-layout.css:16 [base]`;  `src/styles/core/viewport-layout.css:60 [media (max-height:740px) /]`;  `src/styles/core/viewport-layout.css:70 [base]`;  `src/styles/core/viewport-layout.css:110 [media (max-height:780px) /]`;  `src/styles/core/visual-polish.css:13 [base]`;  `src/styles/core/visual-polish.css:116 [media (max-width:640px) /]`
3. **`.nav-button`** — 10 apariciones:  `src/features/events/styles/events.css:1 [media (max-width:640px) /]`;  `src/styles/core/styles.css:1 [base]`;  `src/styles/core/styles.css:1 [media (max-width:640px) /]`;  `src/styles/core/styles.css:1 [media (orientation:landscape) and (max-height:620px) /]`;  `src/styles/core/viewport-layout.css:31 [base]`;  `src/styles/core/viewport-layout.css:60 [media (max-height:740px) /]`;  `src/styles/core/viewport-layout.css:84 [base]`;  `src/styles/core/viewport-layout.css:113 [media (max-height:780px) /]`;  `src/styles/core/visual-polish.css:22 [base]`;  `src/styles/core/visual-polish.css:117 [media (max-width:640px) /]`
4. **`.home-view::after`** — 9 apariciones:  `src/features/home/styles/home-focus.css:66 [base]`;  `src/features/home/styles/home-focus.css:164 [media (max-height:780px) /]`;  `src/styles/core/styles.css:1 [base]`;  `src/styles/core/styles.css:1 [media (max-width:640px) /]`;  `src/styles/core/styles.css:1 [media (orientation:landscape) and (max-height:620px) /]`;  `src/styles/core/viewport-layout.css:17 [base]`;  `src/styles/core/viewport-layout.css:60 [media (max-height:740px) /]`;  `src/styles/core/viewport-layout.css:71 [base]`;  `src/styles/core/viewport-layout.css:111 [media (max-height:780px) /]`
5. **`.topbar`** — 9 apariciones:  `src/styles/core/styles.css:1 [base]`;  `src/styles/core/styles.css:1 [base]`;  `src/styles/core/styles.css:1 [media (max-width:640px) /]`;  `src/styles/core/styles.css:1 [media (orientation:landscape) and (max-height:620px) /]`;  `src/styles/core/viewport-layout.css:8 [base]`;  `src/styles/core/viewport-layout.css:60 [media (max-height:740px) /]`;  `src/styles/core/viewport-layout.css:64 [base]`;  `src/styles/core/viewport-layout.css:107 [media (max-height:780px) /]`;  `src/styles/core/viewport-layout.css:118 [media (min-width:700px) /]`
6. **`.voice-orb`** — 9 apariciones:  `src/styles/core/styles.css:1 [base]`;  `src/styles/core/styles.css:1 [base]`;  `src/styles/core/styles.css:1 [media (max-width:640px) /]`;  `src/styles/core/styles.css:1 [media (min-width:760px) /]`;  `src/styles/core/styles.css:1 [media (orientation:landscape) and (max-height:620px) /]`;  `src/styles/core/viewport-layout.css:32 [base]`;  `src/styles/core/viewport-layout.css:60 [media (max-height:740px) /]`;  `src/styles/core/viewport-layout.css:85 [base]`;  `src/styles/core/viewport-layout.css:114 [media (max-height:780px) /]`
7. **`.next-event-card`** — 9 apariciones:  `src/styles/core/styles.css:1 [base]`;  `src/styles/core/styles.css:1 [media (max-width:640px) /]`;  `src/styles/core/styles.css:1 [media (min-width:760px) /]`;  `src/styles/core/styles.css:1 [media (orientation:landscape) and (max-height:620px) /]`;  `src/styles/core/viewport-layout.css:18 [base]`;  `src/styles/core/viewport-layout.css:60 [media (max-height:740px) /]`;  `src/styles/core/viewport-layout.css:73 [base]`;  `src/styles/core/viewport-layout.css:112 [media (max-height:780px) /]`;  `src/styles/core/viewport-layout.css:121 [media (min-width:700px) /]`
8. **`.calendar-page`** — 8 apariciones:  `src/features/calendar/styles/calendar.css:1 [base]`;  `src/features/calendar/styles/calendar.css:1 [media (max-width:640px) /]`;  `src/styles/core/scroll-fix.css:17 [base]`;  `src/styles/core/scroll-fix.css:61 [base]`;  `src/styles/core/viewport-layout.css:36 [base]`;  `src/styles/core/viewport-layout.css:89 [base]`;  `src/styles/core/viewport-layout.css:91 [base]`;  `src/styles/core/visual-polish.css:39 [base]`
9. **`.events-page`** — 8 apariciones:  `src/features/events/styles/events-focus.css:12 [base]`;  `src/features/events/styles/events-focus.css:130 [media (max-width:520px) /]`;  `src/features/events/styles/events-focus.css:161 [media (min-width:700px) /]`;  `src/features/events/styles/events.css:1 [base]`;  `src/styles/core/scroll-fix.css:17 [base]`;  `src/styles/core/scroll-fix.css:61 [base]`;  `src/styles/core/viewport-layout.css:52 [base]`;  `src/styles/core/viewport-layout.css:89 [base]`
10. **`.event-editor`** — 8 apariciones:  `src/features/events/styles/events-focus.css:61 [base]`;  `src/features/events/styles/events-focus.css:143 [media (max-width:520px) /]`;  `src/features/events/styles/events-focus.css:165 [media (min-width:700px) /]`;  `src/features/events/styles/events.css:1 [base]`;  `src/features/events/styles/events.css:1 [media (max-width:640px) /]`;  `src/styles/core/overlay-layout.css:13 [base]`;  `src/styles/core/scroll-fix.css:50 [base]`;  `src/styles/core/viewport-layout.css:104 [base]`
11. **`.bottom-nav`** — 8 apariciones:  `src/features/events/styles/events.css:1 [base]`;  `src/features/events/styles/events.css:1 [media (max-width:640px) /]`;  `src/styles/core/styles.css:1 [base]`;  `src/styles/core/styles.css:1 [base]`;  `src/styles/core/styles.css:1 [media (max-width:640px) /]`;  `src/styles/core/styles.css:1 [media (orientation:landscape) and (max-height:620px) /]`;  `src/styles/core/viewport-layout.css:30 [base]`;  `src/styles/core/viewport-layout.css:83 [base]`
12. **`.sheet-classic .excel-row`** — 8 apariciones:  `src/features/excel/styles/excel-scroll-fix.css:20 [base]`;  `src/features/excel/styles/sheet-focus.css:36 [base]`;  `src/features/excel/styles/sheet-focus.css:40 [base]`;  `src/features/excel/styles/sheet-focus.css:67 [media (max-width:560px) /]`;  `src/features/excel/styles/sheet-focus.css:68 [media (max-width:560px) /]`;  `src/features/excel/styles/sheet-focus.css:69 [media (max-width:560px) /]`;  `src/features/excel/styles/sheet-focus.css:79 [media (min-width:700px) /]`;  `src/features/excel/styles/sheet-focus.css:79 [media (min-width:700px) /]`
13. **`.home-view`** — 8 apariciones:  `src/features/home/styles/home-focus.css:44 [base]`;  `src/styles/core/scroll-fix.css:69 [base]`;  `src/styles/core/styles.css:1 [base]`;  `src/styles/core/styles.css:1 [media (max-width:640px) /]`;  `src/styles/core/styles.css:1 [media (min-width:760px) /]`;  `src/styles/core/styles.css:1 [media (orientation:landscape) and (max-height:620px) /]`;  `src/styles/core/viewport-layout.css:15 [base]`;  `src/styles/core/viewport-layout.css:69 [base]`
14. **`.reminders-workspace`** — 8 apariciones:  `src/features/tasks/styles/reminders-focus.css:26 [base]`;  `src/features/tasks/styles/reminders-focus.css:233 [media (max-width:390px) /]`;  `src/features/tasks/styles/reminders-focus.css:252 [media (min-width:700px) /]`;  `src/features/tasks/styles/reminders.css:1 [base]`;  `src/styles/core/scroll-fix.css:17 [base]`;  `src/styles/core/scroll-fix.css:61 [base]`;  `src/styles/core/viewport-layout.css:52 [base]`;  `src/styles/core/viewport-layout.css:89 [base]`
15. **`.reminder-editor`** — 8 apariciones:  `src/features/tasks/styles/reminders.css:1 [base]`;  `src/features/tasks/styles/reminders.css:1 [media (max-width:640px) /]`;  `src/features/tasks/styles/reminders.css:4 [base]`;  `src/features/tasks/styles/reminders.css:105 [media (max-width:560px) /]`;  `src/features/tasks/styles/reminders.css:121 [media (min-width:700px) /]`;  `src/styles/core/overlay-layout.css:13 [base]`;  `src/styles/core/scroll-fix.css:50 [base]`;  `src/styles/core/viewport-layout.css:104 [base]`
16. **`.content`** — 8 apariciones:  `src/styles/core/scroll-fix.css:5 [base]`;  `src/styles/core/styles.css:1 [base]`;  `src/styles/core/styles.css:1 [base]`;  `src/styles/core/viewport-layout.css:11 [base]`;  `src/styles/core/viewport-layout.css:60 [media (max-height:740px) /]`;  `src/styles/core/viewport-layout.css:67 [base]`;  `src/styles/core/viewport-layout.css:109 [media (max-height:780px) /]`;  `src/styles/core/viewport-layout.css:120 [media (min-width:700px) /]`
17. **`.topbar h1`** — 8 apariciones:  `src/styles/core/styles.css:1 [base]`;  `src/styles/core/styles.css:1 [media (max-width:640px) /]`;  `src/styles/core/styles.css:1 [media (orientation:landscape) and (max-height:620px) /]`;  `src/styles/core/viewport-layout.css:9 [base]`;  `src/styles/core/viewport-layout.css:60 [media (max-height:740px) /]`;  `src/styles/core/viewport-layout.css:65 [base]`;  `src/styles/core/viewport-layout.css:108 [media (max-height:780px) /]`;  `src/styles/core/viewport-layout.css:119 [media (min-width:700px) /]`
18. **`.calendar-today-button`** — 7 apariciones:  `src/features/calendar/styles/calendar.css:1 [base]`;  `src/features/calendar/styles/calendar.css:1 [base]`;  `src/features/calendar/styles/calendar.css:1 [media (max-width:640px) /]`;  `src/styles/core/viewport-layout.css:39 [base]`;  `src/styles/core/viewport-layout.css:94 [base]`;  `src/styles/core/visual-polish.css:25 [base]`;  `src/styles/core/visual-polish.css:59 [base]`
19. **`.excel-body`** — 7 apariciones:  `src/features/excel/styles/sheet.css:1 [base]`;  `src/features/excel/styles/sheet.css:1 [media (max-width:640px) /]`;  `src/features/excel/styles/sheet.css:1 [media (min-width:700px) /]`;  `src/styles/core/scroll-fix.css:30 [base]`;  `src/styles/core/viewport-layout.css:49 [base]`;  `src/styles/core/viewport-layout.css:60 [media (max-height:740px) /]`;  `src/styles/core/viewport-layout.css:101 [base]`
20. **`.calendar-nav-button`** — 6 apariciones:  `src/features/calendar/styles/calendar.css:1 [base]`;  `src/features/calendar/styles/calendar.css:1 [base]`;  `src/features/calendar/styles/calendar.css:1 [media (max-width:640px) /]`;  `src/styles/core/viewport-layout.css:39 [base]`;  `src/styles/core/viewport-layout.css:93 [base]`;  `src/styles/core/visual-polish.css:58 [base]`
21. **`.calendar-view-switch button`** — 6 apariciones:  `src/features/calendar/styles/calendar.css:1 [base]`;  `src/features/calendar/styles/calendar.css:1 [media (max-width:640px) /]`;  `src/styles/core/viewport-layout.css:40 [base]`;  `src/styles/core/viewport-layout.css:95 [base]`;  `src/styles/core/visual-polish.css:25 [base]`;  `src/styles/core/visual-polish.css:66 [base]`
22. **`.weekday-row`** — 6 apariciones:  `src/features/calendar/styles/calendar.css:1 [base]`;  `src/features/calendar/styles/calendar.css:1 [base]`;  `src/styles/core/styles.css:1 [base]`;  `src/styles/core/styles.css:1 [base]`;  `src/styles/core/viewport-layout.css:42 [base]`;  `src/styles/core/visual-polish.css:28 [base]`
23. **`.sheet-detail-page`** — 6 apariciones:  `src/features/excel/styles/sheet.css:1 [base]`;  `src/styles/core/overlay-layout.css:46 [base]`;  `src/styles/core/scroll-fix.css:50 [base]`;  `src/styles/core/viewport-layout.css:56 [base]`;  `src/styles/core/viewport-layout.css:57 [base]`;  `src/styles/core/viewport-layout.css:104 [base]`
24. **`.sheet-detail-card input`** — 6 apariciones:  `src/features/excel/styles/sheet.css:1 [base]`;  `src/features/excel/styles/sheet.css:1 [base]`;  `src/styles/core/overlay-layout.css:95 [base]`;  `src/styles/core/overlay-layout.css:105 [base]`;  `src/styles/core/overlay-layout.css:168 [media (max-width:560px) /]`;  `src/styles/core/overlay-layout.css:183 [media (min-width:700px) /]`
25. **`.sheet-detail-card select`** — 6 apariciones:  `src/features/excel/styles/sheet.css:1 [base]`;  `src/features/excel/styles/sheet.css:1 [base]`;  `src/styles/core/overlay-layout.css:95 [base]`;  `src/styles/core/overlay-layout.css:105 [base]`;  `src/styles/core/overlay-layout.css:168 [media (max-width:560px) /]`;  `src/styles/core/overlay-layout.css:183 [media (min-width:700px) /]`
26. **`.sheet-detail-card textarea`** — 6 apariciones:  `src/features/excel/styles/sheet.css:1 [base]`;  `src/features/excel/styles/sheet.css:1 [base]`;  `src/styles/core/overlay-layout.css:95 [base]`;  `src/styles/core/overlay-layout.css:109 [base]`;  `src/styles/core/overlay-layout.css:169 [media (max-width:560px) /]`;  `src/styles/core/overlay-layout.css:184 [media (min-width:700px) /]`
27. **`body`** — 6 apariciones:  `src/styles/core/ios-dark-redesign.css:6 [base]`;  `src/styles/core/ios-dark-redesign.css:7 [base]`;  `src/styles/core/styles.css:1 [base]`;  `src/styles/core/styles.css:1 [base]`;  `src/styles/core/viewport-layout.css:5 [base]`;  `src/styles/core/viewport-layout.css:6 [base]`
28. **`.page-card`** — 6 apariciones:  `src/styles/core/scroll-fix.css:17 [base]`;  `src/styles/core/styles.css:1 [base]`;  `src/styles/core/styles.css:1 [base]`;  `src/styles/core/styles.css:1 [media (max-width:640px) /]`;  `src/styles/core/viewport-layout.css:12 [base]`;  `src/styles/core/viewport-layout.css:88 [base]`
29. **`.topbar-date`** — 6 apariciones:  `src/styles/core/styles.css:1 [base]`;  `src/styles/core/styles.css:1 [media (max-width:640px) /]`;  `src/styles/core/viewport-layout.css:10 [base]`;  `src/styles/core/viewport-layout.css:66 [base]`;  `src/styles/core/visual-polish.css:12 [base]`;  `src/styles/core/visual-polish.css:115 [media (max-width:640px) /]`
30. **`.calendar-date-options`** — 5 apariciones:  `src/features/calendar/styles/calendar-focus.css:308 [base]`;  `src/features/calendar/styles/calendar-focus.css:372 [media (max-width:390px) /]`;  `src/features/calendar/styles/calendar-focus.css:390 [media (min-width:700px) /]`;  `src/styles/core/visual-polish.css:52 [base]`;  `src/styles/core/visual-polish.css:121 [media (max-width:640px) /]`
31. **`.excel-head span`** — 5 apariciones:  `src/features/excel/styles/sheet.css:1 [base]`;  `src/features/excel/styles/sheet.css:1 [media (max-width:640px) /]`;  `src/features/excel/styles/sheet.css:1 [media (min-width:700px) /]`;  `src/styles/core/viewport-layout.css:49 [base]`;  `src/styles/core/visual-polish.css:81 [base]`
32. **`.excel-row>span`** — 5 apariciones:  `src/features/excel/styles/sheet.css:1 [base]`;  `src/features/excel/styles/sheet.css:1 [media (max-width:640px) /]`;  `src/features/excel/styles/sheet.css:1 [media (min-width:700px) /]`;  `src/styles/core/viewport-layout.css:49 [base]`;  `src/styles/core/visual-polish.css:82 [base]`
33. **`.sheet-detail-content`** — 5 apariciones:  `src/features/excel/styles/sheet.css:1 [base]`;  `src/features/excel/styles/sheet.css:1 [media (max-width:640px) /]`;  `src/styles/core/overlay-layout.css:74 [base]`;  `src/styles/core/overlay-layout.css:165 [media (max-width:560px) /]`;  `src/styles/core/overlay-layout.css:181 [media (min-width:700px) /]`
34. **`.sheet-detail-card`** — 5 apariciones:  `src/features/excel/styles/sheet.css:1 [base]`;  `src/features/excel/styles/sheet.css:1 [media (max-width:640px) /]`;  `src/styles/core/overlay-layout.css:79 [base]`;  `src/styles/core/overlay-layout.css:166 [media (max-width:560px) /]`;  `src/styles/core/overlay-layout.css:182 [media (min-width:700px) /]`
35. **`.sheet-detail-primary`** — 5 apariciones:  `src/features/excel/styles/sheet.css:1 [base]`;  `src/features/excel/styles/sheet.css:1 [media (max-width:640px) /]`;  `src/styles/core/overlay-layout.css:85 [base]`;  `src/styles/core/overlay-layout.css:167 [media (max-width:560px) /]`;  `src/styles/core/overlay-layout.css:176 [media (max-width:380px) /]`
36. **`.calendar-topline`** — 4 apariciones:  `src/features/calendar/styles/calendar.css:1 [base]`;  `src/features/calendar/styles/calendar.css:1 [media (max-width:640px) /]`;  `src/styles/core/viewport-layout.css:37 [base]`;  `src/styles/core/visual-polish.css:40 [base]`
37. **`.calendar-title-wrap h2`** — 4 apariciones:  `src/features/calendar/styles/calendar.css:1 [base]`;  `src/features/calendar/styles/calendar.css:1 [media (max-width:640px) /]`;  `src/styles/core/viewport-layout.css:38 [base]`;  `src/styles/core/viewport-layout.css:92 [base]`
38. **`.calendar-actions`** — 4 apariciones:  `src/features/calendar/styles/calendar.css:1 [base]`;  `src/features/calendar/styles/calendar.css:1 [media (max-width:640px) /]`;  `src/styles/core/viewport-layout.css:39 [base]`;  `src/styles/core/visual-polish.css:57 [base]`
39. **`.calendar-overview strong`** — 4 apariciones:  `src/features/calendar/styles/calendar.css:1 [base]`;  `src/features/calendar/styles/calendar.css:1 [media (max-width:640px) /]`;  `src/styles/core/visual-polish.css:62 [base]`;  `src/styles/core/visual-polish.css:123 [media (max-width:640px) /]`
40. **`.calendar-view-switch`** — 4 apariciones:  `src/features/calendar/styles/calendar.css:1 [base]`;  `src/features/calendar/styles/calendar.css:1 [media (max-width:640px) /]`;  `src/styles/core/viewport-layout.css:40 [base]`;  `src/styles/core/visual-polish.css:65 [base]`
41. **`.calendar-grid-rich .calendar-day`** — 4 apariciones:  `src/features/calendar/styles/calendar.css:1 [base]`;  `src/features/calendar/styles/calendar.css:1 [media (max-width:640px) /]`;  `src/styles/core/visual-polish.css:68 [base]`;  `src/styles/core/visual-polish.css:125 [media (max-width:640px) /]`
42. **`.event-editor-head h3`** — 4 apariciones:  `src/features/events/styles/events-focus.css:71 [base]`;  `src/features/events/styles/events-focus.css:145 [media (max-width:520px) /]`;  `src/features/events/styles/events-focus.css:166 [media (min-width:700px) /]`;  `src/features/events/styles/events.css:1 [base]`
43. **`.event-detail-link`** — 4 apariciones:  `src/features/events/styles/events.css:1 [base]`;  `src/styles/core/viewport-layout.css:26 [base]`;  `src/styles/core/viewport-layout.css:81 [base]`;  `src/styles/core/visual-polish.css:17 [base]`
44. **`.sheet-classic .excel-body`** — 4 apariciones:  `src/features/excel/styles/excel-scroll-fix.css:14 [base]`;  `src/features/excel/styles/sheet-focus.css:39 [base]`;  `src/features/excel/styles/sheet-focus.css:67 [media (max-width:560px) /]`;  `src/features/excel/styles/sheet-focus.css:79 [media (min-width:700px) /]`
45. **`.sheet-category-presets button`** — 4 apariciones:  `src/features/excel/styles/sheet-fields.css:1 [base]`;  `src/features/excel/styles/sheet-fields.css:1 [media (max-width:640px) /]`;  `src/styles/core/overlay-layout.css:116 [base]`;  `src/styles/core/overlay-layout.css:171 [media (max-width:560px) /]`
46. **`.sheet-classic-tools label`** — 4 apariciones:  `src/features/excel/styles/sheet.css:1 [base]`;  `src/features/excel/styles/sheet.css:1 [media (max-width:640px) /]`;  `src/styles/core/viewport-layout.css:49 [base]`;  `src/styles/core/visual-polish.css:80 [base]`
47. **`.sheet-classic-tools input`** — 4 apariciones:  `src/features/excel/styles/sheet.css:1 [base]`;  `src/features/excel/styles/sheet.css:1 [media (max-width:640px) /]`;  `src/styles/core/viewport-layout.css:49 [base]`;  `src/styles/core/visual-polish.css:80 [base]`
48. **`.sheet-classic-tools select`** — 4 apariciones:  `src/features/excel/styles/sheet.css:1 [base]`;  `src/features/excel/styles/sheet.css:1 [media (max-width:640px) /]`;  `src/styles/core/viewport-layout.css:49 [base]`;  `src/styles/core/visual-polish.css:80 [base]`
49. **`.excel-row`** — 4 apariciones:  `src/features/excel/styles/sheet.css:1 [base]`;  `src/features/excel/styles/sheet.css:1 [base]`;  `src/features/excel/styles/sheet.css:1 [media (max-width:640px) /]`;  `src/styles/core/viewport-layout.css:49 [base]`
50. **`.sheet-table-hint`** — 4 apariciones:  `src/features/excel/styles/sheet.css:1 [base]`;  `src/features/excel/styles/sheet.css:1 [media (max-width:640px) /]`;  `src/styles/core/viewport-layout.css:49 [base]`;  `src/styles/core/visual-polish.css:83 [base]`
51. **`.sheet-photo-grid`** — 4 apariciones:  `src/features/excel/styles/sheet.css:1 [base]`;  `src/features/excel/styles/sheet.css:1 [media (max-width:640px) /]`;  `src/features/excel/styles/sheet.css:1 [media (min-width:700px) /]`;  `src/styles/core/overlay-layout.css:147 [base]`
52. **`.mlb-club`** — 4 apariciones:  `src/features/sports/styles/mlb-matchups.css:10 [base]`;  `src/features/sports/styles/mlb.css:211 [base]`;  `src/features/sports/styles/mlb.css:260 [media (max-width:420px) /]`;  `src/features/sports/styles/mlb.css:273 [media (max-width:350px) /]`
53. **`.mlb-books>div`** — 4 apariciones:  `src/features/sports/styles/mlb-matchups.css:94 [base]`;  `src/features/sports/styles/mlb-matchups.css:131 [media (max-width:420px) /]`;  `src/features/sports/styles/mlb-matchups.css:139 [media (min-width:700px) /]`;  `src/features/sports/styles/mlb.css:230 [base]`
54. **`button`** — 4 apariciones:  `src/styles/core/ios-dark-redesign.css:7 [base]`;  `src/styles/core/ios-dark-redesign.css:8 [base]`;  `src/styles/core/styles.css:1 [base]`;  `src/styles/core/styles.css:1 [base]`
55. **`.app-shell`** — 4 apariciones:  `src/styles/core/styles.css:1 [base]`;  `src/styles/core/styles.css:1 [media (max-width:640px) /]`;  `src/styles/core/styles.css:1 [media (min-width:760px) /]`;  `src/styles/core/viewport-layout.css:7 [base]`
56. **`.card-heading`** — 4 apariciones:  `src/styles/core/styles.css:1 [base]`;  `src/styles/core/viewport-layout.css:19 [base]`;  `src/styles/core/viewport-layout.css:74 [base]`;  `src/styles/core/visual-polish.css:14 [base]`
57. **`.event-date-block span`** — 4 apariciones:  `src/styles/core/styles.css:1 [base]`;  `src/styles/core/viewport-layout.css:23 [base]`;  `src/styles/core/viewport-layout.css:78 [base]`;  `src/styles/core/visual-polish.css:15 [base]`
58. **`.event-main-copy p`** — 4 apariciones:  `src/styles/core/styles.css:1 [base]`;  `src/styles/core/viewport-layout.css:25 [base]`;  `src/styles/core/viewport-layout.css:80 [base]`;  `src/styles/core/visual-polish.css:16 [base]`
59. **`.direction-button`** — 4 apariciones:  `src/styles/core/styles.css:1 [base]`;  `src/styles/core/viewport-layout.css:26 [base]`;  `src/styles/core/viewport-layout.css:81 [base]`;  `src/styles/core/visual-polish.css:17 [base]`
60. **`.calendar-date-dropdown`** — 3 apariciones:  `src/features/calendar/styles/calendar-focus.css:272 [base]`;  `src/styles/core/visual-polish.css:48 [base]`;  `src/styles/core/visual-polish.css:120 [media (max-width:640px) /]`
61. **`.calendar-date-options button`** — 3 apariciones:  `src/features/calendar/styles/calendar-focus.css:321 [base]`;  `src/styles/core/visual-polish.css:54 [base]`;  `src/styles/core/visual-polish.css:122 [media (max-width:640px) /]`
62. **`.calendar-overview>div`** — 3 apariciones:  `src/features/calendar/styles/calendar.css:1 [base]`;  `src/features/calendar/styles/calendar.css:1 [media (max-width:640px) /]`;  `src/styles/core/visual-polish.css:60 [base]`
63. **`.calendar-grid`** — 3 apariciones:  `src/features/calendar/styles/calendar.css:1 [base]`;  `src/styles/core/styles.css:1 [base]`;  `src/styles/core/styles.css:1 [base]`
64. **`.rich-day-number`** — 3 apariciones:  `src/features/calendar/styles/calendar.css:1 [base]`;  `src/styles/core/visual-polish.css:69 [base]`;  `src/styles/core/visual-polish.css:126 [media (max-width:640px) /]`
65. **`.week-day`** — 3 apariciones:  `src/features/calendar/styles/calendar.css:1 [base]`;  `src/features/calendar/styles/calendar.css:1 [media (max-width:640px) /]`;  `src/styles/core/viewport-layout.css:45 [base]`
66. **`.week-day-head span`** — 3 apariciones:  `src/features/calendar/styles/calendar.css:1 [base]`;  `src/styles/core/viewport-layout.css:45 [base]`;  `src/styles/core/visual-polish.css:33 [base]`
67. **`.week-empty`** — 3 apariciones:  `src/features/calendar/styles/calendar.css:1 [base]`;  `src/styles/core/viewport-layout.css:45 [base]`;  `src/styles/core/visual-polish.css:33 [base]`
68. **`.calendar-selected-preview`** — 3 apariciones:  `src/features/calendar/styles/calendar.css:1 [base]`;  `src/features/calendar/styles/calendar.css:1 [media (max-width:640px) /]`;  `src/styles/core/visual-polish.css:73 [base]`
69. **`.calendar-summary-sheet`** — 3 apariciones:  `src/features/calendar/styles/calendar.css:1 [base]`;  `src/features/calendar/styles/calendar.css:1 [media (max-width:640px) /]`;  `src/styles/core/overlay-layout.css:13 [base]`
70. **`.event-editor-head`** — 3 apariciones:  `src/features/events/styles/events-focus.css:69 [base]`;  `src/features/events/styles/events-focus.css:144 [media (max-width:520px) /]`;  `src/features/events/styles/events.css:1 [base]`
71. **`.events-section-label`** — 3 apariciones:  `src/features/events/styles/events.css:1 [base]`;  `src/styles/core/viewport-layout.css:53 [base]`;  `src/styles/core/visual-polish.css:86 [base]`
72. **`.event-list`** — 3 apariciones:  `src/features/events/styles/events.css:1 [base]`;  `src/styles/core/scroll-fix.css:30 [base]`;  `src/styles/core/viewport-layout.css:53 [base]`
73. **`.event-row`** — 3 apariciones:  `src/features/events/styles/events.css:1 [base]`;  `src/features/events/styles/events.css:1 [media (max-width:640px) /]`;  `src/styles/core/viewport-layout.css:53 [base]`
74. **`.event-row-date span`** — 3 apariciones:  `src/features/events/styles/events.css:1 [base]`;  `src/styles/core/viewport-layout.css:53 [base]`;  `src/styles/core/visual-polish.css:87 [base]`
75. **`.event-row-copy strong`** — 3 apariciones:  `src/features/events/styles/events.css:1 [base]`;  `src/styles/core/viewport-layout.css:53 [base]`;  `src/styles/core/visual-polish.css:88 [base]`
76. **`.event-row-copy span`** — 3 apariciones:  `src/features/events/styles/events.css:1 [base]`;  `src/styles/core/viewport-layout.css:53 [base]`;  `src/styles/core/visual-polish.css:87 [base]`
77. **`.event-editor-backdrop`** — 3 apariciones:  `src/features/events/styles/events.css:1 [base]`;  `src/styles/core/overlay-layout.css:5 [base]`;  `src/styles/core/viewport-layout.css:56 [base]`
78. **`.calendar-event-button`** — 3 apariciones:  `src/features/events/styles/events.css:1 [base]`;  `src/styles/core/viewport-layout.css:42 [base]`;  `src/styles/core/visual-polish.css:30 [base]`
79. **`.sheet-category-presets`** — 3 apariciones:  `src/features/excel/styles/sheet-fields.css:1 [base]`;  `src/features/excel/styles/sheet-fields.css:1 [media (max-width:640px) /]`;  `src/styles/core/overlay-layout.css:112 [base]`
80. **`.sheet-detail-header-spacer`** — 3 apariciones:  `src/features/excel/styles/sheet-focus.css:57 [base]`;  `src/styles/core/overlay-layout.css:73 [base]`;  `src/styles/core/overlay-layout.css:164 [media (max-width:560px) /]`
81. **`.sheet-classic-head`** — 3 apariciones:  `src/features/excel/styles/sheet.css:1 [base]`;  `src/features/excel/styles/sheet.css:1 [media (max-width:640px) /]`;  `src/styles/core/viewport-layout.css:49 [base]`
82. **`.sheet-classic-head h2`** — 3 apariciones:  `src/features/excel/styles/sheet.css:1 [base]`;  `src/features/excel/styles/sheet.css:1 [media (max-width:640px) /]`;  `src/styles/core/viewport-layout.css:49 [base]`
83. **`.sheet-classic-actions button`** — 3 apariciones:  `src/features/excel/styles/sheet.css:1 [base]`;  `src/features/excel/styles/sheet.css:1 [media (max-width:640px) /]`;  `src/styles/core/viewport-layout.css:49 [base]`
84. **`.sheet-mini-summary`** — 3 apariciones:  `src/features/excel/styles/sheet.css:1 [base]`;  `src/features/excel/styles/sheet.css:1 [media (max-width:640px) /]`;  `src/styles/core/viewport-layout.css:49 [base]`
85. **`.sheet-mini-summary span`** — 3 apariciones:  `src/features/excel/styles/sheet.css:1 [base]`;  `src/styles/core/viewport-layout.css:49 [base]`;  `src/styles/core/visual-polish.css:78 [base]`
86. **`.sheet-mini-summary b`** — 3 apariciones:  `src/features/excel/styles/sheet.css:1 [base]`;  `src/styles/core/viewport-layout.css:49 [base]`;  `src/styles/core/visual-polish.css:79 [base]`
87. **`.sheet-classic-tools`** — 3 apariciones:  `src/features/excel/styles/sheet.css:1 [base]`;  `src/features/excel/styles/sheet.css:1 [media (max-width:640px) /]`;  `src/styles/core/viewport-layout.css:49 [base]`
88. **`.excel-frame`** — 3 apariciones:  `src/features/excel/styles/sheet.css:1 [base]`;  `src/styles/core/scroll-fix.css:30 [base]`;  `src/styles/core/scroll-fix.css:45 [base]`
89. **`.excel-letters`** — 3 apariciones:  `src/features/excel/styles/sheet.css:1 [base]`;  `src/features/excel/styles/sheet.css:1 [base]`;  `src/styles/core/viewport-layout.css:49 [base]`
90. **`.excel-head`** — 3 apariciones:  `src/features/excel/styles/sheet.css:1 [base]`;  `src/features/excel/styles/sheet.css:1 [base]`;  `src/styles/core/viewport-layout.css:49 [base]`
91. **`.sheet-detail-header`** — 3 apariciones:  `src/features/excel/styles/sheet.css:1 [base]`;  `src/styles/core/overlay-layout.css:53 [base]`;  `src/styles/core/overlay-layout.css:161 [media (max-width:560px) /]`
92. **`.sheet-detail-header>button`** — 3 apariciones:  `src/features/excel/styles/sheet.css:1 [base]`;  `src/styles/core/overlay-layout.css:59 [base]`;  `src/styles/core/overlay-layout.css:162 [media (max-width:560px) /]`
93. **`.sheet-detail-header strong`** — 3 apariciones:  `src/features/excel/styles/sheet.css:1 [base]`;  `src/styles/core/overlay-layout.css:68 [base]`;  `src/styles/core/overlay-layout.css:163 [media (max-width:560px) /]`
94. **`.sheet-detail-card label>span`** — 3 apariciones:  `src/features/excel/styles/sheet.css:1 [base]`;  `src/styles/core/overlay-layout.css:88 [base]`;  `src/styles/core/overlay-layout.css:170 [media (max-width:560px) /]`
95. **`.sheet-detail-section-title button`** — 3 apariciones:  `src/features/excel/styles/sheet.css:1 [base]`;  `src/styles/core/overlay-layout.css:134 [base]`;  `src/styles/core/overlay-layout.css:172 [media (max-width:560px) /]`
96. **`.sheet-photo-empty`** — 3 apariciones:  `src/features/excel/styles/sheet.css:1 [base]`;  `src/features/excel/styles/sheet.css:1 [base]`;  `src/styles/core/overlay-layout.css:140 [base]`
97. **`.mlb-moneyline`** — 3 apariciones:  `src/features/sports/styles/mlb-matchups.css:34 [base]`;  `src/features/sports/styles/mlb-matchups.css:136 [media (min-width:700px) /]`;  `src/features/sports/styles/mlb.css:222 [base]`
98. **`.mlb-moneyline-values`** — 3 apariciones:  `src/features/sports/styles/mlb-matchups.css:43 [base]`;  `src/features/sports/styles/mlb-matchups.css:128 [media (max-width:420px) /]`;  `src/features/sports/styles/mlb.css:224 [base]`
99. **`.reminder-metrics`** — 3 apariciones:  `src/features/tasks/styles/reminders.css:1 [base]`;  `src/features/tasks/styles/reminders.css:1 [media (max-width:640px) /]`;  `src/styles/core/viewport-layout.css:53 [base]`
100. **`.reminder-metrics>div`** — 3 apariciones:  `src/features/tasks/styles/reminders.css:1 [base]`;  `src/features/tasks/styles/reminders.css:1 [media (max-width:640px) /]`;  `src/styles/core/viewport-layout.css:53 [base]`
101. **`.reminder-section-title`** — 3 apariciones:  `src/features/tasks/styles/reminders.css:1 [base]`;  `src/styles/core/viewport-layout.css:53 [base]`;  `src/styles/core/visual-polish.css:86 [base]`
102. **`.reminder-list-editorial`** — 3 apariciones:  `src/features/tasks/styles/reminders.css:1 [base]`;  `src/styles/core/scroll-fix.css:30 [base]`;  `src/styles/core/viewport-layout.css:53 [base]`
103. **`.reminder-main strong`** — 3 apariciones:  `src/features/tasks/styles/reminders.css:1 [base]`;  `src/styles/core/viewport-layout.css:53 [base]`;  `src/styles/core/visual-polish.css:88 [base]`
104. **`.reminder-main span`** — 3 apariciones:  `src/features/tasks/styles/reminders.css:1 [base]`;  `src/styles/core/viewport-layout.css:53 [base]`;  `src/styles/core/visual-polish.css:87 [base]`
105. **`.reminder-bottom-actions`** — 3 apariciones:  `src/features/tasks/styles/reminders.css:1 [base]`;  `src/styles/core/viewport-layout.css:53 [base]`;  `src/styles/core/visual-polish.css:9 [base]`
106. **`.reminder-editor-backdrop`** — 3 apariciones:  `src/features/tasks/styles/reminders.css:1 [base]`;  `src/styles/core/overlay-layout.css:5 [base]`;  `src/styles/core/viewport-layout.css:56 [base]`
107. **`.reminder-editor-actions`** — 3 apariciones:  `src/features/tasks/styles/reminders.css:1 [base]`;  `src/features/tasks/styles/reminders.css:91 [base]`;  `src/styles/core/overlay-layout.css:22 [base]`
108. **`html`** — 3 apariciones:  `src/styles/core/ios-dark-redesign.css:6 [base]`;  `src/styles/core/styles.css:1 [base]`;  `src/styles/core/viewport-layout.css:5 [base]`
109. **`#root`** — 3 apariciones:  `src/styles/core/ios-dark-redesign.css:6 [base]`;  `src/styles/core/styles.css:1 [base]`;  `src/styles/core/viewport-layout.css:5 [base]`
110. **`.status-pill`** — 3 apariciones:  `src/styles/core/styles.css:1 [base]`;  `src/styles/core/styles.css:1 [media (max-width:640px) /]`;  `src/styles/core/viewport-layout.css:2 [base]`
111. **`.card-heading svg`** — 3 apariciones:  `src/styles/core/styles.css:1 [base]`;  `src/styles/core/viewport-layout.css:20 [base]`;  `src/styles/core/viewport-layout.css:75 [base]`
112. **`.event-date-block`** — 3 apariciones:  `src/styles/core/styles.css:1 [base]`;  `src/styles/core/viewport-layout.css:21 [base]`;  `src/styles/core/viewport-layout.css:76 [base]`
113. **`.event-date-block strong`** — 3 apariciones:  `src/styles/core/styles.css:1 [base]`;  `src/styles/core/viewport-layout.css:22 [base]`;  `src/styles/core/viewport-layout.css:77 [base]`
114. **`.event-main-copy h3`** — 3 apariciones:  `src/styles/core/styles.css:1 [base]`;  `src/styles/core/viewport-layout.css:24 [base]`;  `src/styles/core/viewport-layout.css:79 [base]`
115. **`.empty-state p`** — 3 apariciones:  `src/styles/core/styles.css:1 [base]`;  `src/styles/core/viewport-layout.css:27 [base]`;  `src/styles/core/visual-polish.css:18 [base]`
116. **`.empty-state button`** — 3 apariciones:  `src/styles/core/styles.css:1 [base]`;  `src/styles/core/viewport-layout.css:27 [base]`;  `src/styles/core/visual-polish.css:19 [base]`
117. **`.calendar-day>span`** — 3 apariciones:  `src/styles/core/styles.css:1 [base]`;  `src/styles/core/viewport-layout.css:42 [base]`;  `src/styles/core/visual-polish.css:29 [base]`
118. **`.voice-orb::after`** — 3 apariciones:  `src/styles/core/styles.css:1 [base]`;  `src/styles/core/viewport-layout.css:33 [base]`;  `src/styles/core/viewport-layout.css:86 [base]`
119. **`.calendar-month-metrics strong`** — 3 apariciones:  `src/styles/core/viewport-layout.css:41 [base]`;  `src/styles/core/viewport-layout.css:97 [base]`;  `src/styles/core/visual-polish.css:27 [base]`
120. **`.calendar-date-dropdown-head`** — 2 apariciones:  `src/features/calendar/styles/calendar-focus.css:290 [base]`;  `src/styles/core/visual-polish.css:49 [base]`
121. **`.calendar-date-dropdown-head span`** — 2 apariciones:  `src/features/calendar/styles/calendar-focus.css:299 [base]`;  `src/styles/core/visual-polish.css:50 [base]`
122. **`.calendar-date-dropdown-head button`** — 2 apariciones:  `src/features/calendar/styles/calendar-focus.css:300 [base]`;  `src/styles/core/visual-polish.css:51 [base]`
123. **`.calendar-date-options button.active`** — 2 apariciones:  `src/features/calendar/styles/calendar-focus.css:332 [base]`;  `src/styles/core/visual-polish.css:56 [base]`
124. **`.calendar-overview span`** — 2 apariciones:  `src/features/calendar/styles/calendar.css:1 [base]`;  `src/styles/core/visual-polish.css:61 [base]`
125. **`.calendar-legend`** — 2 apariciones:  `src/features/calendar/styles/calendar.css:1 [base]`;  `src/styles/core/visual-polish.css:63 [base]`
126. **`.calendar-legend i`** — 2 apariciones:  `src/features/calendar/styles/calendar.css:1 [base]`;  `src/styles/core/visual-polish.css:64 [base]`
127. **`.rich-day-dots i`** — 2 apariciones:  `src/features/calendar/styles/calendar.css:1 [base]`;  `src/styles/core/visual-polish.css:64 [base]`
128. **`.calendar-grid-rich .calendar-day.today .rich-day-number`** — 2 apariciones:  `src/features/calendar/styles/calendar.css:1 [base]`;  `src/styles/core/visual-polish.css:70 [base]`
129. **`.rich-day-dots`** — 2 apariciones:  `src/features/calendar/styles/calendar.css:1 [base]`;  `src/styles/core/visual-polish.css:72 [base]`
130. **`.rich-day small`** — 2 apariciones:  `src/features/calendar/styles/calendar.css:1 [base]`;  `src/styles/core/visual-polish.css:71 [base]`
131. **`.week-day-head strong`** — 2 apariciones:  `src/features/calendar/styles/calendar.css:1 [base]`;  `src/styles/core/viewport-layout.css:45 [base]`
132. **`.calendar-selected-preview>span`** — 2 apariciones:  `src/features/calendar/styles/calendar.css:1 [base]`;  `src/styles/core/visual-polish.css:74 [base]`
133. **`.calendar-selected-preview>strong`** — 2 apariciones:  `src/features/calendar/styles/calendar.css:1 [base]`;  `src/styles/core/visual-polish.css:75 [base]`
134. **`.calendar-summary-backdrop`** — 2 apariciones:  `src/features/calendar/styles/calendar.css:1 [base]`;  `src/styles/core/overlay-layout.css:5 [base]`
135. **`.history-list`** — 2 apariciones:  `src/features/events/styles/events.css:1 [base]`;  `src/styles/core/scroll-fix.css:30 [base]`
136. **`.event-row-date strong`** — 2 apariciones:  `src/features/events/styles/events.css:1 [base]`;  `src/styles/core/viewport-layout.css:53 [base]`
137. **`.event-editor-actions`** — 2 apariciones:  `src/features/events/styles/events.css:1 [base]`;  `src/styles/core/overlay-layout.css:22 [base]`
138. **`.calendar-day small`** — 2 apariciones:  `src/features/events/styles/events.css:1 [base]`;  `src/styles/core/styles.css:1 [base]`
139. **`.sheet-classic::-webkit-scrollbar`** — 2 apariciones:  `src/features/excel/styles/excel-scroll-fix.css:12 [base]`;  `src/features/excel/styles/sheet-focus.css:15 [base]`
140. **`.sheet-classic .excel-frame`** — 2 apariciones:  `src/features/excel/styles/excel-scroll-fix.css:20 [base]`;  `src/features/excel/styles/sheet-focus.css:34 [base]`
141. **`.sheet-classic .sheet-table-hint`** — 2 apariciones:  `src/features/excel/styles/excel-scroll-fix.css:25 [base]`;  `src/features/excel/styles/sheet-focus.css:43 [base]`
142. **`.sheet-detail-header span`** — 2 apariciones:  `src/features/excel/styles/sheet.css:1 [base]`;  `src/styles/core/overlay-layout.css:64 [base]`
143. **`.sheet-detail-section-title`** — 2 apariciones:  `src/features/excel/styles/sheet.css:1 [base]`;  `src/styles/core/overlay-layout.css:122 [base]`
144. **`.sheet-detail-section-title span`** — 2 apariciones:  `src/features/excel/styles/sheet.css:1 [base]`;  `src/styles/core/overlay-layout.css:126 [base]`
145. **`.sheet-detail-section-title small`** — 2 apariciones:  `src/features/excel/styles/sheet.css:1 [base]`;  `src/styles/core/overlay-layout.css:130 [base]`
146. **`.sheet-photo-grid figure`** — 2 apariciones:  `src/features/excel/styles/sheet.css:1 [base]`;  `src/styles/core/overlay-layout.css:148 [base]`
147. **`.sheet-custom-toggle`** — 2 apariciones:  `src/features/excel/styles/sheet.css:1 [base]`;  `src/styles/core/overlay-layout.css:149 [base]`
148. **`.sheet-custom-toggle span`** — 2 apariciones:  `src/features/excel/styles/sheet.css:1 [base]`;  `src/styles/core/overlay-layout.css:150 [base]`
149. **`.sheet-custom-toggle b`** — 2 apariciones:  `src/features/excel/styles/sheet.css:1 [base]`;  `src/styles/core/overlay-layout.css:151 [base]`
150. **`.sheet-custom-content`** — 2 apariciones:  `src/features/excel/styles/sheet.css:1 [base]`;  `src/styles/core/overlay-layout.css:153 [base]`
151. **`.sheet-custom-field`** — 2 apariciones:  `src/features/excel/styles/sheet.css:1 [base]`;  `src/styles/core/overlay-layout.css:154 [base]`
152. **`.sheet-custom-field>button`** — 2 apariciones:  `src/features/excel/styles/sheet.css:1 [base]`;  `src/styles/core/overlay-layout.css:155 [base]`
153. **`.sheet-formula-value`** — 2 apariciones:  `src/features/excel/styles/sheet.css:1 [base]`;  `src/styles/core/overlay-layout.css:156 [base]`
154. **`.sheet-new-field`** — 2 apariciones:  `src/features/excel/styles/sheet.css:1 [base]`;  `src/styles/core/overlay-layout.css:157 [base]`
155. **`.sheet-new-field>button`** — 2 apariciones:  `src/features/excel/styles/sheet.css:1 [base]`;  `src/styles/core/overlay-layout.css:158 [base]`
156. **`.mlb-moneyline-label`** — 2 apariciones:  `src/features/sports/styles/mlb-matchups.css:38 [base]`;  `src/features/sports/styles/mlb.css:223 [base]`
157. **`.mlb-books`** — 2 apariciones:  `src/features/sports/styles/mlb-matchups.css:90 [base]`;  `src/features/sports/styles/mlb.css:229 [base]`
158. **`.mlb-books b`** — 2 apariciones:  `src/features/sports/styles/mlb-matchups.css:116 [base]`;  `src/features/sports/styles/mlb.css:232 [base]`
159. **`.reminder-topline`** — 2 apariciones:  `src/features/tasks/styles/reminders.css:1 [base]`;  `src/styles/core/viewport-layout.css:53 [base]`
160. **`.reminder-topline h2`** — 2 apariciones:  `src/features/tasks/styles/reminders.css:1 [base]`;  `src/styles/core/viewport-layout.css:53 [base]`
161. **`.notification-permission`** — 2 apariciones:  `src/features/tasks/styles/reminders.css:1 [base]`;  `src/styles/core/viewport-layout.css:53 [base]`
162. **`.reminder-item`** — 2 apariciones:  `src/features/tasks/styles/reminders.css:1 [base]`;  `src/styles/core/viewport-layout.css:53 [base]`
163. **`:root`** — 2 apariciones:  `src/styles/core/ios-dark-redesign.css:5 [base]`;  `src/styles/core/styles.css:1 [base]`
164. **`input`** — 2 apariciones:  `src/styles/core/ios-dark-redesign.css:7 [base]`;  `src/styles/core/styles.css:1 [base]`
165. **`.sheet-detail-page::-webkit-scrollbar`** — 2 apariciones:  `src/styles/core/overlay-layout.css:52 [base]`;  `src/styles/core/viewport-layout.css:57 [base]`
166. **`.reminder-list`** — 2 apariciones:  `src/styles/core/scroll-fix.css:30 [base]`;  `src/styles/core/styles.css:1 [base]`
167. **`.calendar-agenda`** — 2 apariciones:  `src/styles/core/scroll-fix.css:30 [base]`;  `src/styles/core/viewport-layout.css:44 [base]`
168. **`.calendar-agenda-list`** — 2 apariciones:  `src/styles/core/scroll-fix.css:30 [base]`;  `src/styles/core/viewport-layout.css:44 [base]`
169. **`.calendar-day-summary`** — 2 apariciones:  `src/styles/core/scroll-fix.css:50 [base]`;  `src/styles/core/viewport-layout.css:104 [base]`
170. **`.empty-state`** — 2 apariciones:  `src/styles/core/styles.css:1 [base]`;  `src/styles/core/viewport-layout.css:27 [base]`
171. **`.page-title-row`** — 2 apariciones:  `src/styles/core/styles.css:1 [base]`;  `src/styles/core/viewport-layout.css:53 [base]`
172. **`.page-title-row h2`** — 2 apariciones:  `src/styles/core/styles.css:1 [base]`;  `src/styles/core/viewport-layout.css:53 [base]`
173. **`.round-plus`** — 2 apariciones:  `src/styles/core/styles.css:1 [base]`;  `src/styles/core/viewport-layout.css:53 [base]`
174. **`.calendar-day.today>span`** — 2 apariciones:  `src/styles/core/styles.css:1 [base]`;  `src/styles/core/viewport-layout.css:42 [base]`
175. **`.calendar-month-metrics span`** — 2 apariciones:  `src/styles/core/viewport-layout.css:41 [base]`;  `src/styles/core/visual-polish.css:26 [base]`
176. **`.calendar-more`** — 2 apariciones:  `src/styles/core/viewport-layout.css:42 [base]`;  `src/styles/core/visual-polish.css:30 [base]`
177. **`.agenda-date span`** — 2 apariciones:  `src/styles/core/viewport-layout.css:44 [base]`;  `src/styles/core/visual-polish.css:31 [base]`
178. **`.agenda-copy span`** — 2 apariciones:  `src/styles/core/viewport-layout.css:44 [base]`;  `src/styles/core/visual-polish.css:31 [base]`
179. **`.agenda-copy strong`** — 2 apariciones:  `src/styles/core/viewport-layout.css:44 [base]`;  `src/styles/core/visual-polish.css:32 [base]`
180. **`.week-event span`** — 2 apariciones:  `src/styles/core/viewport-layout.css:45 [base]`;  `src/styles/core/visual-polish.css:33 [base]`
181. **`.week-event strong`** — 2 apariciones:  `src/styles/core/viewport-layout.css:45 [base]`;  `src/styles/core/visual-polish.css:34 [base]`
182. **`.day-event-copy strong`** — 2 apariciones:  `src/styles/core/viewport-layout.css:46 [base]`;  `src/styles/core/visual-polish.css:35 [base]`
183. **`.day-event-copy span`** — 2 apariciones:  `src/styles/core/viewport-layout.css:46 [base]`;  `src/styles/core/visual-polish.css:36 [base]`

## Parte B · Los 177 contextos con propiedades coincidentes entre archivos

1. **`.home-view::before`** · media: `base` · propiedades coincidentes: 1 · comparaciones de valores distintos: 31
2. **`.sheet-classic`** · media: `base` · propiedades coincidentes: 15 · comparaciones de valores distintos: 17
3. **`.nav-button`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 17
4. **`.next-event-card`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 14
5. **`.calendar-today-button`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 13
6. **`.excel-body`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 13
7. **`.calendar-view-switch button`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 13
8. **`.home-view`** · media: `base` · propiedades coincidentes: 5 · comparaciones de valores distintos: 10
9. **`.home-view::after`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 12
10. **`.events-page`** · media: `base` · propiedades coincidentes: 6 · comparaciones de valores distintos: 8
11. **`.reminders-workspace`** · media: `base` · propiedades coincidentes: 6 · comparaciones de valores distintos: 8
12. **`.page-card`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 11
13. **`.calendar-nav-button`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 10
14. **`.topbar-date`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 10
15. **`.card-heading`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 10
16. **`.calendar-date-dropdown`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 10
17. **`.weekday-row`** · media: `base` · propiedades coincidentes: 5 · comparaciones de valores distintos: 7
18. **`.voice-orb`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 9
19. **`.calendar-page`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 9
20. **`.calendar-date-options button`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 9
21. **`.bottom-nav`** · media: `base` · propiedades coincidentes: 1 · comparaciones de valores distintos: 8
22. **`.topbar h1`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 8
23. **`.event-detail-link`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 7
24. **`.direction-button`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 7
25. **`.nav-button`** · media: `media (max-width:640px) / ` · propiedades coincidentes: 0 · comparaciones de valores distintos: 6
26. **`.event-date-block`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 6
27. **`.calendar-date-dropdown-head button`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 6
28. **`.topbar`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 5
29. **`.sheet-detail-page`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 5
30. **`.sheet-detail-card input`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 5
31. **`.sheet-detail-card select`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 5
32. **`.sheet-detail-card textarea`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 5
33. **`.calendar-view-switch`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 5
34. **`.mlb-books>div`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 5
35. **`.event-date-block span`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 5
36. **`.event-main-copy p`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 5
37. **`.events-section-label`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 5
38. **`.sheet-photo-empty`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 5
39. **`.reminder-section-title`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 5
40. **`.calendar-date-dropdown-head`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 5
41. **`.event-editor`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 4
42. **`.calendar-date-options`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 4
43. **`.excel-head span`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 4
44. **`.excel-row>span`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 4
45. **`.sheet-category-presets button`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 4
46. **`.sheet-classic-tools input`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 4
47. **`.sheet-classic-tools select`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 4
48. **`.calendar-event-button`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 4
49. **`.sheet-mini-summary span`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 4
50. **`.sheet-detail-header`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 4
51. **`.sheet-detail-section-title button`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 4
52. **`.card-heading svg`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 4
53. **`.empty-state button`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 4
54. **`.calendar-date-dropdown-head span`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 4
55. **`.sheet-formula-value`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 4
56. **`.calendar-topline`** · media: `base` · propiedades coincidentes: 1 · comparaciones de valores distintos: 3
57. **`.sheet-detail-content`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 3
58. **`.sheet-detail-card`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 3
59. **`.calendar-actions`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 3
60. **`.sheet-table-hint`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 3
61. **`.app-shell`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 3
62. **`.week-day`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 3
63. **`.week-day-head span`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 3
64. **`.week-empty`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 3
65. **`.event-editor-head`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 3
66. **`.event-row-date span`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 3
67. **`.event-row-copy strong`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 3
68. **`.event-row-copy span`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 3
69. **`.sheet-mini-summary b`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 3
70. **`.sheet-detail-card label>span`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 3
71. **`.reminder-main strong`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 3
72. **`.reminder-main span`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 3
73. **`.empty-state p`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 3
74. **`.calendar-day>span`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 3
75. **`.calendar-date-options button.active`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 3
76. **`.rich-day small`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 3
77. **`.sheet-custom-content`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 3
78. **`.sheet-custom-field>button`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 3
79. **`.sheet-new-field`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 3
80. **`.sheet-new-field>button`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 3
81. **`.mlb-moneyline-label`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 3
82. **`:root`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 3
83. **`.bottom-nav`** · media: `media (max-width:640px) / ` · propiedades coincidentes: 0 · comparaciones de valores distintos: 2
84. **`.reminder-editor`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 2
85. **`.calendar-title-wrap h2`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 2
86. **`.calendar-overview strong`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 2
87. **`.calendar-grid-rich .calendar-day`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 2
88. **`.calendar-grid-rich .calendar-day`** · media: `media (max-width:640px) / ` · propiedades coincidentes: 0 · comparaciones de valores distintos: 2
89. **`.event-editor-head h3`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 2
90. **`.sheet-classic-tools label`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 2
91. **`.rich-day-number`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 2
92. **`.calendar-selected-preview`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 2
93. **`.sheet-category-presets`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 2
94. **`.sheet-detail-header-spacer`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 2
95. **`.sheet-classic-actions button`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 2
96. **`.sheet-detail-header>button`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 2
97. **`.sheet-detail-header strong`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 2
98. **`.mlb-moneyline`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 2
99. **`.mlb-moneyline-values`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 2
100. **`.reminder-metrics`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 2
101. **`.reminder-bottom-actions`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 2
102. **`.event-date-block strong`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 2
103. **`.event-main-copy h3`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 2
104. **`.voice-orb::after`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 2
105. **`.calendar-month-metrics strong`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 2
106. **`.calendar-overview span`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 2
107. **`.calendar-legend`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 2
108. **`.calendar-legend i`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 2
109. **`.rich-day-dots i`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 2
110. **`.calendar-grid-rich .calendar-day.today .rich-day-number`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 2
111. **`.rich-day-dots`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 2
112. **`.sheet-detail-header span`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 2
113. **`.sheet-detail-section-title`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 2
114. **`.sheet-detail-section-title span`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 2
115. **`.sheet-detail-section-title small`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 2
116. **`.sheet-custom-field`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 2
117. **`.mlb-books`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 2
118. **`.notification-permission`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 2
119. **`.round-plus`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 2
120. **`.calendar-day.today>span`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 2
121. **`.event-editor-backdrop`** · media: `base` · propiedades coincidentes: 1 · comparaciones de valores distintos: 1
122. **`.reminder-editor-backdrop`** · media: `base` · propiedades coincidentes: 1 · comparaciones de valores distintos: 1
123. **`.mlb-books b`** · media: `base` · propiedades coincidentes: 1 · comparaciones de valores distintos: 1
124. **`.home-view::before`** · media: `media (max-height:780px) / ` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
125. **`.home-view::before`** · media: `media (max-width:640px) / ` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
126. **`.home-view::after`** · media: `media (max-height:780px) / ` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
127. **`body`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
128. **`.topbar-date`** · media: `media (max-width:640px) / ` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
129. **`.sheet-detail-primary`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
130. **`.calendar-overview strong`** · media: `media (max-width:640px) / ` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
131. **`.sheet-classic .excel-body`** · media: `base` · propiedades coincidentes: 2 · comparaciones de valores distintos: 0
132. **`.excel-row`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
133. **`.sheet-photo-grid`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
134. **`.calendar-overview>div`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
135. **`.calendar-grid`** · media: `base` · propiedades coincidentes: 2 · comparaciones de valores distintos: 0
136. **`.calendar-summary-sheet`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
137. **`.event-list`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
138. **`.event-row`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
139. **`.sheet-classic-head`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
140. **`.sheet-classic-head h2`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
141. **`.sheet-mini-summary`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
142. **`.sheet-classic-tools`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
143. **`.excel-letters`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
144. **`.excel-head`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
145. **`.reminder-metrics>div`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
146. **`.reminder-list-editorial`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
147. **`html`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
148. **`#root`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
149. **`.status-pill`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
150. **`.week-day-head strong`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
151. **`.calendar-selected-preview>span`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
152. **`.calendar-selected-preview>strong`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
153. **`.calendar-summary-backdrop`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
154. **`.event-row-date strong`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
155. **`.calendar-day small`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
156. **`.sheet-classic .excel-frame`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
157. **`.sheet-photo-grid figure`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
158. **`.sheet-custom-toggle span`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
159. **`.sheet-custom-toggle b`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
160. **`.reminder-topline`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
161. **`.reminder-topline h2`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
162. **`.reminder-item`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
163. **`.sheet-detail-page::-webkit-scrollbar`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
164. **`.empty-state`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
165. **`.page-title-row`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
166. **`.page-title-row h2`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
167. **`.calendar-month-metrics span`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
168. **`.calendar-more`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
169. **`.agenda-date span`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
170. **`.agenda-copy span`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
171. **`.agenda-copy strong`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
172. **`.week-event span`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
173. **`.week-event strong`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
174. **`.day-event-copy strong`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
175. **`.day-event-copy span`** · media: `base` · propiedades coincidentes: 0 · comparaciones de valores distintos: 1
176. **`.reminder-editor-actions`** · media: `base` · propiedades coincidentes: 1 · comparaciones de valores distintos: 0
177. **`.sheet-classic::-webkit-scrollbar`** · media: `base` · propiedades coincidentes: 1 · comparaciones de valores distintos: 0

## Criterio de depuración futura

1. Separar normalización de estilos idénticos para componentes equivalentes (headers, formularios, cuadros), de reglas válidas que corrigen pantallas independientes.
2. Verificar propiedad por propiedad, en el **mismo media context** y con la misma especificidad, si el valor final se conserva; el conteo aquí no evalúa cascada completa, `@supports`, clases activas ni comportamiento de un dispositivo.
3. Definir un CSS propietario por módulo; lo transversal permanece en `src/styles/core/`.
4. Borrar solo después de comparar Android/iPhone, apertura/cierre, scroll vertical/horizontal, vistas Excel e inicio. Prohibido limpiar `!important` indiscriminadamente.

Este anexo es un inventario completo de **coincidencias identificadas por el scanner**, no prueba de ausencia de equivalencias más complejas.

## Corte de poda segura P10 (18/11/2026): actualización del inventario histórico

La tabla larga de este documento **permanece como fotografía inicial** del commit `56f7464`; sus rutas y líneas pueden cambiar. El auditor de Cloudflare del commit `3ea1565`, **153/153 pruebas y SUCCESS**, registra ahora:

| Indicador CSS | Inventario inicial | Después de eliminación exacta |
|---|---:|---:|
| Archivos CSS cargados | 33 | 33 |
| Selectores en más de una hoja | 183 | **182** |
| Comparaciones de propiedades con valores diferentes | 624 | **600** |
| `!important` | 3,008 | **2,978** |
| Declaraciones más tempranas idénticas que puede quitar el escáner sin cambiar selector, media, propiedad, valor o prioridad | 36 | **0** |
| Bloques CSS enteros con cuerpos idénticos | 11 | **11** |

**Acción aplicada:** retiradas exactamente 36 declaraciones redundantes en `styles.css`, `events.css`, `viewport-layout.css`, `excel-scroll-fix.css` y `mlb.css`. De ellas, 30 usaban `!important`. El valor de scroll Excel que dejó de escribirse en `excel-scroll-fix.css` permanece en su propietario posterior `sheet-focus.css`, y las pruebas se adaptaron para evaluar cascada real de imports. Se mantuvo intacto el orden CSS de `src/main.tsx`.

**Importante:** las otras 2,978 declaraciones `!important`, 182 selectores de capas distintas y 11 bloques completos similares NO son «código muerto confirmado»; la revisión detallada de P10 exige screenshot y QA manual en Android/iPhone, scroll, teclado, overlays, calendario, iOS dark y Excel vertical/horizontal antes de borrar prioridades diferentes. P10 continúa EN CURSO hasta esa comprobación.
