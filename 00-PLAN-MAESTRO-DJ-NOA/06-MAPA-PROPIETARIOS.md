# 06 · DJ NOA — MAPA ÚNICO DE CARPETAS Y PROPIETARIOS

**Estructura física auditada, 18/11/2026.** Las carpetas representan una responsabilidad; un mismo comportamiento no se implementa en dos capítulos. El traslado físico de Worker deportes/Noah ya se hizo en `main` y se comprobó en Cloudflare.

```text
DJ NOA
├── 00-PLAN-MAESTRO-DJ-NOA/    planes, bitácora, catálogo y mapa
├── scripts/                   auditorías conservadoras, sin escrituras ni borrados
├── tests/                     contratos de UI, arquitectura, seguridad, finanzas, deportes
├── integration-tests/         transacciones IndexedDB de regresión
├── src/
│   ├── app/                   coordinador, inicio y navegación (sin segundo estado)
│   ├── domains/
│   │   ├── events/            integridad, agenda y mutaciones
│   │   ├── finance/           conciliación USD, históricos y formatos
│   │   ├── noah/              reglas y acciones de IA del cliente
│   │   ├── sheet/             reglas puras de Excel y claves
│   │   └── sports/            cálculos puros de cuotas
│   ├── features/
│   │   ├── calendar/          UI calendario + CSS propio
│   │   ├── events/            UI eventos + CSS propio
│   │   ├── excel/             editor clásico, portal, orientación + CSS
│   │   ├── home/              CSS específico de inicio
│   │   ├── noah/              Voz, Visión, actividades + CSS
│   │   ├── safety/            herramientas de respaldo y seguridad
│   │   ├── sports/            UI MLB, NBA, contexto y CSS
│   │   └── tasks/             UI recordatorios y push cliente
│   ├── services/
│   │   ├── media/             optimización medios **manuales**
│   │   └── storage/           Dexie único, backup/restauración
│   ├── shared/                tipos y normalización básica
│   ├── styles/core/           estilos globales, orden de cascada protegido
│   └── main.tsx               entrada única PWA y orden de importación CSS
├── worker/src/
│   ├── entry.ts               router API exterior y seguridad de origen
│   ├── index.ts               Durable Object, push, rate limit y assets
│   ├── sports/                MLB, NBA, contexto, live, análisis IA
│   └── noah/                  Chat y Visión del Worker
└── dj-noa-cloud/              aislada, en pausa, NO desplegar
```

## Propietarios de contratos

| Contrato | Propietario hoy | Consumidores que deben delegar |
|---|---|---|
| `dj-noa-local`, Dexie 1–6 | `src/services/storage/db.ts` | todos los componentes, nunca segunda Dexie |
| Eventos e identidades | `src/domains/events/eventMutations.ts` y `eventIntegrity.ts` | App, calendario, Noah, UI eventos |
| Honorarios, anticipos, pagos y saldo USD | `src/domains/finance/financialOverview.ts` | App, Excel, calendario, eventos |
| Conversión/formato de dinero visible | `src/domains/finance/moneyIntegrity.ts` | Excel, UI, historial |
| Claves, tipo y coerción de celdas | `src/domains/sheet/sheetValues.ts` | Excel clásico, portal y Noah |
| Validación de acciones de IA de servidor | `worker/src/noah/noahChat.ts` | `noahImage.ts` llama `sanitizeActions` |
| Worker deporte y API en vivo | `worker/src/sports/*`, ruteado por `entry.ts` | UI `src/features/sports` |
| Recordatorios cliente | `src/features/tasks/reminderNotifications.ts` | App y Tareas; Worker envía push |
| Protección de origen y rate limit | `worker/src/entry.ts` | todas las rutas IA/Deportes protegidas |
| CSS común y orden de importación | `src/main.tsx`, `src/styles/core` | estilos de cada feature |

## Próximas integraciones, SIN duplicar lógica

1. **DUP-01/02:** crear helpers de servidor deportes en la carpeta ya establecida; migrar un par idéntico por commit y verificar respuestas MLB/NBA/context/live.
2. **DUP-04/05:** utilidades de IA y snapshots de columnas; no fusionar contextos de servidor con PWA sin contratos por interfaz.
3. **DUP-06:** consolidar escrituras de Excel bajo servicio único; separar cálculo de presentación, conservar las dos superficies hasta pruebas de dispositivo.
4. **DUP-07/08:** fechas/recurrentes y blobs. Validar duplicados por comportamiento, no solo texto similar.
5. **DUP-09:** normalizar CSS por pantalla conservando el orden final actual; revisar iOS y Android físicamente antes de retirar `!important`.

Las referencias a un método o tabla no constituyen un segundo propietario. Las tablas de propietarios reflejan la arquitectura **actual y objetivo**, no una certificación de que todos los consumidores ya estén migrados.

## Corte P01-h · propietarios efectivamente unificados (18/11/2026)

- `worker/src/sports/shared/espnCore.ts`: parses ESPN de MLB/NBA, cuotas/consenso y estado; consumidores de contexto/live/análisis usan los parsers comunes.
- `worker/src/sports/shared/contextCore.ts`: identidad de equipos, fecha lexical, jugador y alineación MLB para Context/Live.
- `src/features/sports/sportsPresentation.ts`: único formateador de tarjetas, probabilidades y favoritos en MLB/NBA, sin compartir caché o peticiones específicas.
- `src/domains/noah/noahSheetSnapshot.ts`: snapshot de columna y prueba de valor Excel en Voz/Visión.
- `src/shared/normalizeText.ts`: también propietario del normalizador del reconocimiento de voz.

**No unificados todavía:** escritor Excel `SheetWorkspace/ExcelModulesEnhancer/noahExcel`, recurrencia cliente/Worker, dos parsing paths IA, CSS con múltiples capas. Preservar sus contratos antes de migrar.
