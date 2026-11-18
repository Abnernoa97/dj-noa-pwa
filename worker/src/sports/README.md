# Worker / Deportes · único capítulo servidor
- `mlb.ts`: datos, calendario y resultados MLB.
- `nba.ts`: datos, calendario y resultados NBA.
- `sportsContext.ts`: contexto de juego, rachas, jugadores, alineaciones.
- `sportsLive.ts`: marcadores, probabilidades e información en directo.
- `sportsAnalysis.ts`: análisis con IA; política de no inventar resultados.

Consumidor externo único: `../entry.ts`. No usar estas funciones desde la PWA; los archivos de interfaz viven en `src/features/sports/`.
**Pendiente P01/P09:** inventario de normalizadores, probabilidades y parsing duplicados entre estos archivos; no fusionar sin comprobar equivalencia semántica.

## Funciones compartidas (DUP-01)

- `shared/espnCore.ts`: fuente única para parseadores de objetos/listas/texto/números, estados de ESPN, avance de fecha, mercado de cuotas y consenso utilizados por **ambos** `mlb.ts` y `nba.ts`.
- No se incluyen `abbr`, `officialStatus`, `getJson`, `teamView`, `sortGames` ni loaders porque tienen diferencias específicas de liga o protocolo que requieren otra auditoría.
- La PWA usa la API existente; no se cambian nombres de ruta, precios de cuota, redondeos ni el fallback de proveedores.

- `shared/contextCore.ts`: normalizador de identidad deportiva y fecha lexical común en Context y Live. `sportsAnalysis` reutiliza parsers `rec/str` sin alterar su tratamiento local de listas.
